'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import {
  getReturnByRtn,
  lookupReturnAsGuest,
  cancelReturn,
  type ReturnRecord,
  type ReturnReason,
  type ReturnStatus,
} from '@/lib/api';
import { formatPrice } from '@/lib/utils';

const REASON_LABEL: Record<ReturnReason, string> = {
  DEFECTIVE: 'Defective product',
  DAMAGED_IN_TRANSIT: 'Damaged in transit',
  NOT_AS_DESCRIBED: 'Not as described',
  WRONG_ITEM_SENT: 'Wrong item sent',
  WRONG_SIZE: 'Wrong size',
  CHANGED_MIND: 'Changed mind',
};

const STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IN_TRANSIT: 'In transit',
  RECEIVED: 'Received',
  INSPECTING: 'Inspecting',
  INSPECTED_PASS: 'Inspection passed',
  INSPECTED_FAIL: 'Inspection failed',
  RETURNED_TO_CUSTOMER: 'Returned to you',
  REFUNDED: 'Refunded',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

// Ordered list of milestones for the visual progress timeline.
const TIMELINE_STEPS: ReturnStatus[] = [
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'RECEIVED',
  'INSPECTING',
  'REFUNDED',
  'CLOSED',
];

// Map an actual status onto its current/expected step in the timeline.
function statusOrdinal(status: ReturnStatus): number {
  switch (status) {
    case 'REQUESTED':
      return 0;
    case 'UNDER_REVIEW':
      return 1;
    case 'APPROVED':
    case 'IN_TRANSIT':
      return 2;
    case 'RECEIVED':
      return 3;
    case 'INSPECTING':
    case 'INSPECTED_PASS':
    case 'INSPECTED_FAIL':
      return 4;
    case 'REFUNDED':
    case 'RETURNED_TO_CUSTOMER':
      return 5;
    case 'CLOSED':
      return 6;
    case 'REJECTED':
    case 'CANCELLED':
      // Terminal — show the request step highlighted; the status pill
      // communicates the outcome separately.
      return 0;
    default:
      return 0;
  }
}

const STATUS_BADGE: Record<ReturnStatus, string> = {
  REQUESTED: 'bg-warning/10 text-warning',
  UNDER_REVIEW: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-error/10 text-error',
  IN_TRANSIT: 'bg-ink/10 text-ink',
  RECEIVED: 'bg-ink/10 text-ink',
  INSPECTING: 'bg-ink/10 text-ink',
  INSPECTED_PASS: 'bg-success/10 text-success',
  INSPECTED_FAIL: 'bg-error/10 text-error',
  RETURNED_TO_CUSTOMER: 'bg-muted-bg text-muted',
  REFUNDED: 'bg-success/10 text-success',
  CLOSED: 'bg-muted-bg text-muted',
  CANCELLED: 'bg-error/10 text-error',
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ReturnTrackingPage() {
  const params = useParams<{ rtnNumber: string }>();
  const rtnNumber = params.rtnNumber;
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [data, setData] = useState<ReturnRecord | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsGuest, setNeedsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  // Guest lookup state (persisted in sessionStorage so cancel works after
  // a fresh page load post-submission).
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const [flash, setFlash] = useState<string | null>(null);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Read any flash + stashed guest creds from sessionStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const f = sessionStorage.getItem(`return-flash:${rtnNumber}`);
      if (f) {
        setFlash(f);
        sessionStorage.removeItem(`return-flash:${rtnNumber}`);
      }
      const stashed = sessionStorage.getItem(`return-guest:${rtnNumber}`);
      if (stashed) {
        const parsed = JSON.parse(stashed) as { email?: string; phone?: string };
        if (parsed.email) setGuestEmail(parsed.email);
        if (parsed.phone) setGuestPhone(parsed.phone);
      }
    } catch {
      // ignore — non-fatal
    }
  }, [rtnNumber]);

  // First attempt: if authenticated, try the authed lookup. Fall through
  // to guest mode on permission/not-found errors.
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (sessionStatus === 'authenticated' && accessToken) {
        try {
          const found = await getReturnByRtn(rtnNumber, accessToken);
          if (!cancelled) {
            setData(found);
            setNeedsGuest(false);
            setAuthError(null);
          }
          return;
        } catch (err: unknown) {
          // Authed user but this return is not theirs (or doesn't exist).
          // Still allow guest verification in case they have phone/email.
          const message =
            err instanceof Error ? err.message : 'Could not load return.';
          if (!cancelled) {
            setAuthError(message);
            setNeedsGuest(true);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        if (!cancelled) {
          setNeedsGuest(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, accessToken, rtnNumber]);

  // If we have stashed guest creds and we're in guest mode, auto-attempt
  // lookup once on mount.
  useEffect(() => {
    if (!needsGuest || data || !guestEmail || !guestPhone) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await lookupReturnAsGuest(rtnNumber, guestEmail, guestPhone);
        if (!cancelled) {
          setData(found);
          setNeedsGuest(false);
        }
      } catch {
        // silent — user can submit the form manually
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only run when we first move into guest mode with prefilled creds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGuest, rtnNumber]);

  const handleGuestSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setGuestError(null);
      if (!isValidEmail(guestEmail)) {
        setGuestError('Please enter a valid email.');
        return;
      }
      if (!guestPhone.trim()) {
        setGuestError('Please enter the phone number on the order.');
        return;
      }
      setGuestBusy(true);
      try {
        const found = await lookupReturnAsGuest(
          rtnNumber,
          guestEmail.trim(),
          guestPhone.trim(),
        );
        setData(found);
        setNeedsGuest(false);
        try {
          sessionStorage.setItem(
            `return-guest:${rtnNumber}`,
            JSON.stringify({
              email: guestEmail.trim(),
              phone: guestPhone.trim(),
            }),
          );
        } catch {
          // ignore
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not find a return with those details.';
        setGuestError(message);
      } finally {
        setGuestBusy(false);
      }
    },
    [rtnNumber, guestEmail, guestPhone],
  );

  const handleCancel = useCallback(async () => {
    if (!data) return;
    if (
      !window.confirm(
        'Cancel this return request? This cannot be undone, though you may submit a new request.',
      )
    ) {
      return;
    }
    setCancelError(null);
    setCancelling(true);
    try {
      await cancelReturn(rtnNumber, {
        accessToken: accessToken ?? undefined,
        email: data.order ? guestEmail || undefined : guestEmail || undefined,
        phone: guestPhone || undefined,
      });
      setData({ ...data, status: 'CANCELLED' });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not cancel the request.';
      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  }, [data, rtnNumber, accessToken, guestEmail, guestPhone]);

  const currentStep = useMemo(
    () => (data ? statusOrdinal(data.status) : 0),
    [data],
  );

  if (loading || sessionStatus === 'loading') {
    return (
      <div className="mx-auto max-w-3xl px-6 pt-24 pb-20 lg:px-12">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading return...
        </div>
      </div>
    );
  }

  if (needsGuest && !data) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 pb-20 lg:px-12">
        <Link
          href="/returns"
          className="mb-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-muted hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to returns
        </Link>
        <h1 className="text-xl font-medium uppercase tracking-[0.15em] text-ink">
          Verify return {rtnNumber}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Enter the email and phone on the original order to view this return.
        </p>
        {authError && (
          <p className="mt-3 text-xs text-muted">
            (Signed-in lookup failed: {authError})
          </p>
        )}
        <form onSubmit={handleGuestSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-ink">
              Email
            </span>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="w-full rounded-sm border border-border bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-ink">
              Phone
            </span>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full rounded-sm border border-border bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
              required
            />
          </label>
          {guestError && <p className="text-sm text-error">{guestError}</p>}
          <button
            type="submit"
            disabled={guestBusy}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-ink bg-ink px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-paper transition hover:opacity-90 disabled:opacity-60"
          >
            {guestBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            View my return
          </button>
        </form>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-6 pt-24 pb-20 lg:px-12">
        <p className="text-sm text-error">
          We could not load this return. Please try again later.
        </p>
      </div>
    );
  }

  const isCancellable = data.status === 'REQUESTED';

  return (
    <div className="mx-auto max-w-3xl px-6 pt-24 pb-20 lg:px-12">
      <Link
        href="/returns"
        className="mb-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to returns
      </Link>

      {flash && (
        <div className="mb-6 rounded-sm border border-success/40 bg-success/5 px-4 py-3 text-sm text-success">
          {flash}
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Return
          </p>
          <h1 className="mt-1 text-2xl font-medium uppercase tracking-[0.15em] text-ink">
            {data.rtnNumber}
          </h1>
          <p className="mt-1 text-xs text-muted">
            Requested{' '}
            {new Date(data.requestedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <span
          className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] ${
            STATUS_BADGE[data.status]
          }`}
        >
          {STATUS_LABEL[data.status]}
        </span>
      </header>

      {/* Timeline */}
      {data.status !== 'CANCELLED' && data.status !== 'REJECTED' && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink">
            Progress
          </h2>
          <ol className="space-y-3">
            {TIMELINE_STEPS.map((step, idx) => {
              const completed = idx < currentStep;
              const current = idx === currentStep;
              return (
                <li key={step} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                      completed
                        ? 'border-ink bg-ink text-paper'
                        : current
                          ? 'border-ink bg-paper text-ink animate-pulse'
                          : 'border-border bg-paper text-muted'
                    }`}
                  >
                    {completed ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="text-[10px]">{idx + 1}</span>
                    )}
                  </span>
                  <span
                    className={`text-sm ${
                      completed || current ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {STATUS_LABEL[step]}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Reason + description */}
      <section className="mt-8 rounded-sm border border-border p-5">
        <p className="text-xs uppercase tracking-[0.1em] text-muted">Reason</p>
        <p className="mt-1 text-sm text-ink">{REASON_LABEL[data.reason]}</p>
        {data.description && (
          <>
            <p className="mt-4 text-xs uppercase tracking-[0.1em] text-muted">
              Description
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
              {data.description}
            </p>
          </>
        )}
        <p className="mt-4 text-xs uppercase tracking-[0.1em] text-muted">
          Return shipping
        </p>
        <p className="mt-1 text-sm text-ink">
          {data.customerShipsBack
            ? 'You arrange and pay for return shipping.'
            : 'We arrange and pay for pickup.'}
        </p>
      </section>

      {/* Items */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink">
          Items
        </h2>
        <ul className="space-y-2">
          {data.items.map((item) => {
            const oi = item.orderItem;
            // Bundle-component lines override the display so the
            // customer sees the actual tee / piece they're returning,
            // not the parent bundle's name.
            const isBundleComponent = !!item.bundleComponentVariantId;
            const productName = isBundleComponent
              ? item.bundleComponentName ?? 'Bundle item'
              : oi?.product?.name ?? 'Item';
            const image = oi?.product?.images?.[0];
            const sizeColor = [
              isBundleComponent ? item.bundleComponentColor : null,
              isBundleComponent ? item.bundleComponentSize : null,
            ]
              .filter(Boolean)
              .join(' / ');
            const unitPrice = oi?.unitPrice ? Number(oi.unitPrice) : null;
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-sm border border-border p-3"
              >
                {image ? (
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-sm bg-muted-bg">
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-14 w-14 flex-shrink-0 rounded-sm bg-muted-bg" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {productName}
                    {sizeColor ? ` (${sizeColor})` : ''}
                  </p>
                  {isBundleComponent && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">
                      Bundle component
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted">
                    Qty: {item.quantity}
                    {unitPrice !== null
                      ? ` • ${formatPrice(unitPrice)} each`
                      : ''}
                  </p>
                </div>
                {item.inspectionResult && (
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      item.inspectionResult === 'PASS'
                        ? 'bg-success/10 text-success'
                        : 'bg-error/10 text-error'
                    }`}
                  >
                    {item.inspectionResult}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Photos */}
      {data.photos.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink">
            Photos
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {data.photos.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square overflow-hidden rounded-sm border border-border bg-muted-bg"
              >
                <Image src={url} alt="Return photo" fill sizes="120px" className="object-cover" unoptimized />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Refund */}
      {data.refundAmount && (
        <section className="mt-8 rounded-sm border border-success/40 bg-success/5 p-5">
          <p className="text-xs uppercase tracking-[0.1em] text-success">
            Refund issued
          </p>
          <p className="mt-1 text-lg font-medium text-ink">
            {formatPrice(Number(data.refundAmount))}
          </p>
          <p className="mt-1 text-xs text-muted">
            Method: {data.refundMethod === 'BANK_TRANSFER' ? 'Bank transfer' : 'Cash'}
            {data.refundReference ? ` • Ref ${data.refundReference}` : ''}
            {data.refundedAt
              ? ` • ${new Date(data.refundedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`
              : ''}
          </p>
        </section>
      )}

      {/* Cancel */}
      {isCancellable && (
        <section className="mt-10 border-t border-border pt-6">
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-error px-5 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-error transition hover:bg-error hover:text-paper disabled:opacity-60"
          >
            {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
            Cancel request
          </button>
          {cancelError && (
            <p className="mt-2 text-sm text-error">{cancelError}</p>
          )}
        </section>
      )}
    </div>
  );
}
