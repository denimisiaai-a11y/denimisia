'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, ArrowLeft } from 'lucide-react';
import {
  createReturn,
  type CreateReturnPayload,
  type ReturnReason,
} from '@/lib/api';
import { formatPrice } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// Reasons that the API rejects without photos. Mirror of
// `requiresPhotos()` in apps/api/src/modules/returns/returns.state-machine.ts.
const PHOTO_REQUIRED: ReadonlySet<ReturnReason> = new Set<ReturnReason>([
  'DEFECTIVE',
  'DAMAGED_IN_TRANSIT',
  'NOT_AS_DESCRIBED',
  'WRONG_ITEM_SENT',
]);

const REASON_OPTIONS: { value: ReturnReason; label: string }[] = [
  { value: 'DEFECTIVE', label: 'Defective product' },
  { value: 'DAMAGED_IN_TRANSIT', label: 'Damaged in transit' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'WRONG_ITEM_SENT', label: 'Wrong item sent' },
  { value: 'WRONG_SIZE', label: 'Wrong size' },
  { value: 'CHANGED_MIND', label: 'Changed my mind' },
];

const RETURN_WINDOW_DAYS = 7;
const MAX_PHOTOS = 5;

interface OrderItemView {
  id: string;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
  product?: { name?: string | null; slug?: string | null; images?: string[] } | null;
  variant?: { size?: string | null; color?: string | null } | null;
  snapshot?: unknown;
}

interface OrderView {
  id: string;
  status: string;
  total: string | number;
  createdAt: string;
  items: OrderItemView[];
}

function itemDisplayName(item: OrderItemView): string {
  const base =
    item.product?.name ??
    (item.snapshot && typeof item.snapshot === 'object'
      ? ((item.snapshot as Record<string, unknown>).productName as string)
      : null) ??
    'Item';
  const parts = [item.variant?.color, item.variant?.size].filter(
    (p): p is string => Boolean(p),
  );
  return parts.length ? `${base} (${parts.join(' / ')})` : base;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function NewReturnPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? null;
  const isAuthed = sessionStatus === 'authenticated' && Boolean(accessToken);

  // Mode toggle: 'guest' or 'auth'. Auto-selects 'auth' once session loads.
  const [mode, setMode] = useState<'auth' | 'guest'>('guest');
  useEffect(() => {
    if (sessionStatus === 'authenticated') setMode('auth');
    else if (sessionStatus === 'unauthenticated') setMode('guest');
  }, [sessionStatus]);

  // Auth-mode: list of user's orders.
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Selected order in either mode.
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    searchParams.get('order') ?? '',
  );
  const [order, setOrder] = useState<OrderView | null>(null);

  // Guest lookup fields.
  const [guestOrderId, setGuestOrderId] = useState<string>(
    searchParams.get('order') ?? '',
  );
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestLookupBusy, setGuestLookupBusy] = useState(false);
  const [guestLookupError, setGuestLookupError] = useState<string | null>(null);

  // Form fields.
  const [reason, setReason] = useState<ReturnReason | ''>('');
  const [description, setDescription] = useState('');
  const [photosText, setPhotosText] = useState('');
  const [itemSelections, setItemSelections] = useState<
    Record<string, { selected: boolean; quantity: number }>
  >({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load orders when authed.
  useEffect(() => {
    if (mode !== 'auth' || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/orders?limit=50`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          if (!cancelled) setOrdersError('Could not load your orders.');
          return;
        }
        const list: OrderView[] = Array.isArray(json.data?.orders)
          ? json.data.orders
          : Array.isArray(json.data)
            ? json.data
            : [];
        // Only orders eligible for a return: DELIVERED within window.
        const cutoff = Date.now() - RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        const eligible = list.filter((o) => {
          if (o.status !== 'DELIVERED') return false;
          const t = new Date(o.createdAt).getTime();
          // createdAt is a proxy when statusHistory is not available
          // client-side; server enforces the strict 7-day-from-delivery
          // window and surfaces an error on submit. We use createdAt only
          // to hide obviously expired orders from the dropdown.
          return Number.isFinite(t) && t >= cutoff - 30 * 24 * 60 * 60 * 1000;
        });
        if (!cancelled) setOrders(eligible);
      } catch {
        if (!cancelled) setOrdersError('Network error. Please try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, accessToken]);

  // When user picks an order from dropdown, sync the working order view.
  useEffect(() => {
    if (mode !== 'auth' || !orders) return;
    const found = orders.find((o) => o.id === selectedOrderId) ?? null;
    setOrder(found);
    setItemSelections({});
  }, [mode, orders, selectedOrderId]);

  const handleGuestLookup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setGuestLookupError(null);
      const id = guestOrderId.trim();
      const email = guestEmail.trim();
      const phone = guestPhone.trim();
      if (!id || !email || !phone) {
        setGuestLookupError('Order number, email, and phone are required.');
        return;
      }
      if (!isValidEmail(email)) {
        setGuestLookupError('Please enter a valid email address.');
        return;
      }
      setGuestLookupBusy(true);
      try {
        const params = new URLSearchParams({ id, email });
        const res = await fetch(`/api/orders/lookup?${params.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success || !json.data) {
          setGuestLookupError(
            'We could not find an order matching those details. Check the order number and email.',
          );
          setOrder(null);
          return;
        }
        const found: OrderView = json.data;
        if (found.status !== 'DELIVERED') {
          setGuestLookupError(
            'This order is not yet eligible for return. Returns open once your order is delivered.',
          );
          setOrder(null);
          return;
        }
        setOrder(found);
        setItemSelections({});
      } catch {
        setGuestLookupError('Network error. Please try again.');
      } finally {
        setGuestLookupBusy(false);
      }
    },
    [guestOrderId, guestEmail, guestPhone],
  );

  const toggleItem = (id: string) => {
    setItemSelections((prev) => {
      const cur = prev[id] ?? { selected: false, quantity: 1 };
      return { ...prev, [id]: { ...cur, selected: !cur.selected } };
    });
  };

  const setItemQty = (id: string, qty: number, max: number) => {
    const clamped = Math.max(1, Math.min(qty, max));
    setItemSelections((prev) => {
      const cur = prev[id] ?? { selected: true, quantity: 1 };
      return { ...prev, [id]: { ...cur, quantity: clamped } };
    });
  };

  const parsedPhotos = useMemo(() => {
    return photosText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_PHOTOS);
  }, [photosText]);

  const photoValidationError = useMemo(() => {
    if (parsedPhotos.length === 0) return null;
    for (const url of parsedPhotos) {
      try {
        const u = new URL(url);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') {
          return `Not a valid URL: ${url}`;
        }
      } catch {
        return `Not a valid URL: ${url}`;
      }
    }
    return null;
  }, [parsedPhotos]);

  const selectedItems = useMemo(
    () =>
      Object.entries(itemSelections)
        .filter(([, v]) => v.selected && v.quantity >= 1)
        .map(([orderItemId, v]) => ({ orderItemId, quantity: v.quantity })),
    [itemSelections],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!order) {
      setSubmitError('Please select an order first.');
      return;
    }
    if (!reason) {
      setSubmitError('Please select a reason for the return.');
      return;
    }
    if (selectedItems.length === 0) {
      setSubmitError('Pick at least one item to return.');
      return;
    }
    if (PHOTO_REQUIRED.has(reason) && parsedPhotos.length === 0) {
      setSubmitError(
        'Photos are required for this reason. Please add at least one photo URL.',
      );
      return;
    }
    if (photoValidationError) {
      setSubmitError(photoValidationError);
      return;
    }

    const payload: CreateReturnPayload = {
      orderId: order.id,
      reason,
      description: description.trim() || undefined,
      photos: parsedPhotos,
      items: selectedItems,
    };
    if (mode === 'guest') {
      payload.guestEmail = guestEmail.trim();
      payload.guestPhone = guestPhone.trim();
    }

    setSubmitting(true);
    try {
      const result = await createReturn(
        payload,
        mode === 'auth' && accessToken ? accessToken : undefined,
      );
      // Stash a flash notice for the tracking page.
      try {
        sessionStorage.setItem(
          `return-flash:${result.rtnNumber}`,
          'Request received. We will contact you within 48 hours. Terms apply.',
        );
        if (mode === 'guest') {
          sessionStorage.setItem(
            `return-guest:${result.rtnNumber}`,
            JSON.stringify({ email: guestEmail.trim(), phone: guestPhone.trim() }),
          );
        }
      } catch {
        // sessionStorage may be unavailable (private mode). Non-fatal.
      }
      router.push(`/returns/${result.rtnNumber}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not submit your return. Please try again.';
      setSubmitError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 pt-24 pb-20 lg:px-12">
      <Link
        href="/returns"
        className="mb-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-muted hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to returns
      </Link>

      <h1 className="text-2xl font-medium uppercase tracking-[0.15em] text-ink">
        Start a return
      </h1>
      <p className="mt-2 text-sm text-muted">
        Returns are accepted within {RETURN_WINDOW_DAYS} days of delivery.
      </p>

      {/* Mode toggle (hidden when authed — auth flow is faster) */}
      {sessionStatus !== 'loading' && (
        <div className="mt-6 flex gap-1 rounded-sm border border-border p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('auth')}
            disabled={!isAuthed}
            className={`flex-1 rounded-sm px-3 py-2 uppercase tracking-[0.1em] transition ${
              mode === 'auth'
                ? 'bg-ink text-paper'
                : 'text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50'
            }`}
          >
            {isAuthed ? 'My orders' : 'Sign in for faster lookup'}
          </button>
          <button
            type="button"
            onClick={() => setMode('guest')}
            className={`flex-1 rounded-sm px-3 py-2 uppercase tracking-[0.1em] transition ${
              mode === 'guest' ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
            }`}
          >
            Guest lookup
          </button>
        </div>
      )}

      {/* Mode A: authed order picker */}
      {mode === 'auth' && (
        <section className="mt-8">
          {orders === null && !ordersError && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your orders...
            </div>
          )}
          {ordersError && (
            <p className="text-sm text-error">{ordersError}</p>
          )}
          {orders && orders.length === 0 && (
            <p className="text-sm text-muted">
              No delivered orders found within the {RETURN_WINDOW_DAYS}-day
              return window.{' '}
              <Link href="/account/orders" className="text-ink underline">
                View all orders
              </Link>
            </p>
          )}
          {orders && orders.length > 0 && (
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-ink">
                Pick an order
              </span>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full rounded-sm border border-border bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
              >
                <option value="">— Select —</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id.slice(-8).toUpperCase()} —{' '}
                    {new Date(o.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    — {formatPrice(Number(o.total))}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}

      {/* Mode B: guest lookup */}
      {mode === 'guest' && !order && (
        <form onSubmit={handleGuestLookup} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-ink">
              Order number
            </span>
            <input
              type="text"
              value={guestOrderId}
              onChange={(e) => setGuestOrderId(e.target.value)}
              className="w-full rounded-sm border border-border bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
              required
            />
          </label>
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
          {guestLookupError && (
            <p className="text-sm text-error">{guestLookupError}</p>
          )}
          <button
            type="submit"
            disabled={guestLookupBusy}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-ink bg-ink px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-paper transition hover:opacity-90 disabled:opacity-60"
          >
            {guestLookupBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            Find my order
          </button>
        </form>
      )}

      {/* Items + form (both modes once order is loaded) */}
      {order && (
        <form onSubmit={handleSubmit} className="mt-10 space-y-8">
          <div className="rounded-sm border border-border p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-muted">
              Returning items from
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              Order #{order.id.slice(-8).toUpperCase()} —{' '}
              {formatPrice(Number(order.total))}
            </p>
          </div>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink">
              Items to return
            </h2>
            <ul className="space-y-2">
              {order.items.map((item) => {
                const sel = itemSelections[item.id] ?? {
                  selected: false,
                  quantity: 1,
                };
                const image = item.product?.images?.[0];
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-sm border border-border p-3"
                  >
                    <label className="flex flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={sel.selected}
                        onChange={() => toggleItem(item.id)}
                        className="mt-1 h-4 w-4 accent-ink"
                      />
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
                          {itemDisplayName(item)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          Ordered: {item.quantity} •{' '}
                          {formatPrice(Number(item.unitPrice))} each
                        </p>
                      </div>
                    </label>
                    {sel.selected && (
                      <label className="flex items-center gap-2 text-xs text-muted">
                        Qty
                        <input
                          type="number"
                          min={1}
                          max={item.quantity}
                          value={sel.quantity}
                          onChange={(e) =>
                            setItemQty(
                              item.id,
                              Number(e.target.value),
                              item.quantity,
                            )
                          }
                          className="w-16 rounded-sm border border-border bg-paper px-2 py-1 text-sm text-ink focus:border-ink focus:outline-none"
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-ink">
                Reason
              </span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReturnReason)}
                className="w-full rounded-sm border border-border bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                required
              >
                <option value="">— Select a reason —</option>
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-ink">
                Description{' '}
                <span className="font-normal text-muted">(optional)</span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full rounded-sm border border-border bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                placeholder="Tell us a bit more about what's wrong (optional)."
              />
            </label>
          </section>

          <section>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-ink">
                Photos{' '}
                {reason && PHOTO_REQUIRED.has(reason) ? (
                  <span className="font-normal text-error">(required)</span>
                ) : (
                  <span className="font-normal text-muted">(optional)</span>
                )}
              </span>
              <textarea
                value={photosText}
                onChange={(e) => setPhotosText(e.target.value)}
                rows={3}
                className="w-full rounded-sm border border-border bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
                placeholder={`Paste up to ${MAX_PHOTOS} image URLs, one per line.\nExample: https://i.imgur.com/abc.jpg`}
              />
              <p className="mt-1 text-xs text-muted">
                {parsedPhotos.length} of {MAX_PHOTOS} photos added.
                {' '}
                If you do not have a hosting URL, upload your photos to imgur.com
                first and paste the direct image links here.
              </p>
              {photoValidationError && (
                <p className="mt-1 text-xs text-error">{photoValidationError}</p>
              )}
            </label>
          </section>

          {submitError && (
            <p className="rounded-sm border border-error bg-error/5 px-3 py-2 text-sm text-error">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-sm border border-ink bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-paper transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit return request
          </button>
          <p className="mt-2 text-xs text-muted">
            By submitting, you agree to our{' '}
            <Link href="/returns" className="underline">
              return policy
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}

export default function NewReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-6 pt-24 pb-20 lg:px-12">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </div>
      }
    >
      <NewReturnPageInner />
    </Suspense>
  );
}
