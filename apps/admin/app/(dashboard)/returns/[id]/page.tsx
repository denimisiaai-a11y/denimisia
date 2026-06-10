'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import {
  approveReturn,
  getAdminReturnDetail,
  inspectReturn,
  issueRefund,
  markReceivedReturn,
  rejectReturn,
  returnToCustomer,
  reviewReturn,
  startInspection,
  type ReturnDetail,
  type ReturnFault,
  type ReturnItemDetail,
  type ReturnReason,
  type ReturnStatus,
} from '@/lib/api-returns';
import { Banner } from '@/components/admin-ui';
import { Modal } from '@/components/modal';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const BDT_FORMATTER = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBDT(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(n)) return '—';
  return BDT_FORMATTER.format(n);
}

function toMoney(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Status / reason / fault config — matches the list page chip palette
// ---------------------------------------------------------------------------

interface StatusBadge {
  label: string;
  classes: string;
}

const STATUS_CONFIG: Record<ReturnStatus, StatusBadge> = {
  REQUESTED: {
    label: 'Requested',
    classes: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
  UNDER_REVIEW: {
    label: 'Under review',
    classes: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  },
  APPROVED: {
    label: 'Approved',
    classes: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  REJECTED: {
    label: 'Rejected',
    classes: 'bg-error/10 text-error',
  },
  IN_TRANSIT: {
    label: 'In transit',
    classes: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  },
  RECEIVED: {
    label: 'Received',
    classes: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  INSPECTING: {
    label: 'Inspecting',
    classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  INSPECTED_PASS: {
    label: 'Inspected · pass',
    classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  INSPECTED_FAIL: {
    label: 'Inspected · fail',
    classes: 'bg-error/10 text-error',
  },
  RETURNED_TO_CUSTOMER: {
    label: 'Returned to customer',
    classes: 'bg-surface-container-highest text-on-surface',
  },
  REFUNDED: {
    label: 'Refunded',
    classes: 'bg-green-500/10 text-green-700 dark:text-green-300',
  },
  CLOSED: {
    label: 'Closed',
    classes: 'bg-surface-container-highest text-on-surface',
  },
  CANCELLED: {
    label: 'Cancelled',
    classes: 'bg-surface-container-highest text-on-surface',
  },
};

const REASON_LABELS: Record<ReturnReason, string> = {
  DEFECTIVE: 'Defective',
  DAMAGED_IN_TRANSIT: 'Damaged in transit',
  NOT_AS_DESCRIBED: 'Not as described',
  WRONG_ITEM_SENT: 'Wrong item sent',
  WRONG_SIZE: 'Wrong size',
  CHANGED_MIND: 'Changed mind',
};

const FAULT_LABELS: Record<ReturnFault, string> = {
  US: 'Our fault',
  CUSTOMER: 'Customer',
};

const TERMINAL_STATUSES: ReturnStatus[] = [
  'REJECTED',
  'CANCELLED',
  'CLOSED',
  'RETURNED_TO_CUSTOMER',
  'REFUNDED',
];

// ---------------------------------------------------------------------------
// Item display helpers
// ---------------------------------------------------------------------------

// Bundle-component lines bypass the OrderItem.product fallback so the
// admin sees the actual constituent (e.g. "Crew Tee — Black / M") rather
// than the parent bundle's metadata. Manual lines retain their existing
// manual* override behavior.
function isBundleComponent(item: ReturnItemDetail): boolean {
  return !!item.bundleComponentVariantId;
}

function itemDisplayName(item: ReturnItemDetail): string {
  if (isBundleComponent(item)) {
    return item.bundleComponentName ?? 'Bundle component';
  }
  if (item.orderItem?.product?.name) return item.orderItem.product.name;
  if (item.manualProductName) return item.manualProductName;
  return 'Item';
}

function itemDisplayImage(item: ReturnItemDetail): string | null {
  // For bundle components we still surface the parent bundle's image
  // (constituents inherit the bundle hero in the snapshot). The bundle
  // field on the order item carries it through.
  if (isBundleComponent(item)) {
    return (
      item.orderItem?.bundle?.image ??
      item.orderItem?.product?.images?.[0] ??
      null
    );
  }
  return item.orderItem?.product?.images?.[0] ?? null;
}

function itemSize(item: ReturnItemDetail): string | null {
  if (isBundleComponent(item)) return item.bundleComponentSize;
  return item.orderItem?.variant?.size ?? item.manualSize ?? null;
}

function itemColor(item: ReturnItemDetail): string | null {
  if (isBundleComponent(item)) return item.bundleComponentColor;
  return item.orderItem?.variant?.color ?? item.manualColor ?? null;
}

function itemSku(item: ReturnItemDetail): string | null {
  // Bundle constituents are referenced by variantId, not SKU. We surface
  // the variantId in the SKU column so the warehouse team has a unique
  // identifier to scan/match against; the manual SKU fallback applies
  // for manual lines only.
  if (isBundleComponent(item)) return item.bundleComponentVariantId;
  return item.orderItem?.variant?.sku ?? item.manualSku ?? null;
}

function itemUnitPrice(item: ReturnItemDetail): string {
  return item.orderItem?.unitPrice ?? item.manualUnitPrice ?? '0';
}

// ---------------------------------------------------------------------------
// SLA pill
// ---------------------------------------------------------------------------

function SlaPill({ deadline, status }: { deadline: string; status: ReturnStatus }) {
  const dl = new Date(deadline).getTime();
  if (!Number.isFinite(dl)) return null;
  const diff = dl - Date.now();
  const slaActive = status === 'REQUESTED' || status === 'UNDER_REVIEW';
  if (!slaActive) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
        SLA · n/a
      </span>
    );
  }
  if (diff < 0) {
    const hours = Math.floor(-diff / 3_600_000);
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-error/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-error">
        SLA · Overdue {hours}h
      </span>
    );
  }
  const hoursLeft = Math.floor(diff / 3_600_000);
  if (hoursLeft < 4) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
        SLA · {hoursLeft}h left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-surface-container-highest px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
      SLA · {hoursLeft}h left
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [ret, setRet] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<
    { tone: 'success' | 'error' | 'info'; message: string } | null
  >(null);

  // Modal flags
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [overrideRefundOpen, setOverrideRefundOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);

  // Form fields
  const [rejectReason, setRejectReason] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [approveCarrier, setApproveCarrier] = useState('');
  const [approvePickup, setApprovePickup] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [receiveTracking, setReceiveTracking] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [refundReference, setRefundReference] = useState('');
  const [refundNotes, setRefundNotes] = useState('');

  // Inspect form (inline)
  const [inspectResults, setInspectResults] = useState<
    Record<string, { result: 'PASS' | 'FAIL'; restock: boolean }>
  >({});
  const [inspectNotes, setInspectNotes] = useState('');

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchDetail = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getAdminReturnDetail(id, token);
      setRet(data);
      // Pre-fill inspection form when entering INSPECTING
      if (data.status === 'INSPECTING') {
        setInspectResults((prev) => {
          const next: typeof prev = {};
          for (const it of data.items) {
            next[it.id] = prev[it.id] ?? {
              result: it.inspectionResult ?? 'PASS',
              restock: it.restock,
            };
          }
          return next;
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load return');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // -------------------------------------------------------------------------
  // Action runners
  // -------------------------------------------------------------------------

  const runAction = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      if (!token) return;
      setBusy(true);
      setBanner(null);
      try {
        await fn();
        setBanner({ tone: 'success', message: `${label} succeeded.` });
        await fetchDetail();
        router.refresh();
      } catch (err: unknown) {
        setBanner({
          tone: 'error',
          message: err instanceof Error ? err.message : `${label} failed`,
        });
      } finally {
        setBusy(false);
      }
    },
    [token, fetchDetail, router],
  );

  const handleStartReview = () => {
    setReviewerNotes('');
    setReviewOpen(true);
  };

  const submitReview = async () => {
    if (!token) return;
    setReviewOpen(false);
    await runAction('Start review', () =>
      reviewReturn(id, token, { reviewerNotes: reviewerNotes.trim() || undefined }),
    );
  };

  const openReject = () => {
    setRejectReason('');
    setRejectOpen(true);
  };

  const submitReject = async () => {
    if (!token) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setBanner({ tone: 'error', message: 'Rejection reason is required.' });
      return;
    }
    setRejectOpen(false);
    await runAction('Reject return', () =>
      rejectReturn(id, token, { rejectionReason: trimmed }),
    );
  };

  const openApprove = () => {
    setApproveCarrier(ret?.carrier ?? '');
    const existing = ret?.pickupAddress;
    setApprovePickup(
      existing && typeof existing === 'object'
        ? JSON.stringify(existing, null, 2)
        : '',
    );
    setApproveNotes('');
    setApproveOpen(true);
  };

  const submitApprove = async () => {
    if (!token) return;
    let pickup: Record<string, unknown> | null = null;
    const raw = approvePickup.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          pickup = parsed as Record<string, unknown>;
        } else {
          setBanner({
            tone: 'error',
            message: 'Pickup address must be a JSON object.',
          });
          return;
        }
      } catch {
        setBanner({ tone: 'error', message: 'Pickup address is not valid JSON.' });
        return;
      }
    }
    setApproveOpen(false);
    await runAction('Approve return', () =>
      approveReturn(id, token, {
        carrier: approveCarrier.trim() || undefined,
        pickupAddress: pickup,
        approvalNotes: approveNotes.trim() || undefined,
      }),
    );
  };

  const openMarkReceived = () => {
    setReceiveTracking(ret?.trackingNumber ?? '');
    setReceiveNotes('');
    setReceiveOpen(true);
  };

  const submitMarkReceived = async () => {
    if (!token) return;
    setReceiveOpen(false);
    await runAction('Mark received', () =>
      markReceivedReturn(id, token, {
        trackingNumber: receiveTracking.trim() || undefined,
        receivedNotes: receiveNotes.trim() || undefined,
      }),
    );
  };

  const submitStartInspection = async () => {
    if (!token) return;
    await runAction('Start inspection', () => startInspection(id, token));
  };

  const submitCompleteInspection = async () => {
    if (!token || !ret) return;
    const itemResults = ret.items.map((it) => {
      const r = inspectResults[it.id] ?? { result: 'PASS' as const, restock: true };
      return {
        returnItemId: it.id,
        inspectionResult: r.result,
        restock: r.restock,
      };
    });
    await runAction('Complete inspection', () =>
      inspectReturn(id, token, {
        itemResults,
        inspectionNotes: inspectNotes.trim() || undefined,
      }),
    );
  };

  const submitReturnToCustomer = async () => {
    if (!token) return;
    await runAction('Return to customer', () => returnToCustomer(id, token));
  };

  const openRefund = (override: boolean) => {
    const fallback =
      ret?.refundAmount ??
      ret?.items.reduce((sum, it) => sum + toMoney(it.itemRefundAmount), 0).toFixed(2);
    setRefundAmount(typeof fallback === 'string' ? fallback : String(fallback ?? ''));
    setRefundMethod('CASH');
    setRefundReference('');
    setRefundNotes('');
    if (override) setOverrideRefundOpen(true);
    else setRefundOpen(true);
  };

  const submitRefund = async (override: boolean) => {
    if (!token) return;
    const amount = Number.parseFloat(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBanner({ tone: 'error', message: 'Enter a valid refund amount.' });
      return;
    }
    const reference = refundReference.trim();
    if (!reference) {
      setBanner({ tone: 'error', message: 'Refund reference is required.' });
      return;
    }
    if (override) setOverrideRefundOpen(false);
    else setRefundOpen(false);
    await runAction(override ? 'Override refund' : 'Issue refund', () =>
      issueRefund(id, token, {
        amount,
        method: refundMethod,
        reference,
        notes: refundNotes.trim() || undefined,
        overrideFromFail: override ? true : undefined,
      }),
    );
  };

  // -------------------------------------------------------------------------
  // Derived view data
  // -------------------------------------------------------------------------

  const customerLabel = useMemo(() => {
    if (!ret) return { name: '—', email: '', phone: '' };
    if (ret.guestName || ret.guestEmail || ret.guestPhone) {
      return {
        name: ret.guestName ?? '—',
        email: ret.guestEmail ?? '',
        phone: ret.guestPhone ?? '',
      };
    }
    if (ret.userId) {
      return {
        name: `Customer #${ret.userId.slice(0, 8).toUpperCase()}`,
        email: '',
        phone: '',
      };
    }
    return { name: '—', email: '', phone: '' };
  }, [ret]);

  const statusCfg = ret ? STATUS_CONFIG[ret.status] : null;

  const timeline = useMemo(() => {
    if (!ret) return [];
    const events: { label: string; iso: string }[] = [];
    if (ret.requestedAt) events.push({ label: 'Requested', iso: ret.requestedAt });
    if (ret.reviewedAt) events.push({ label: 'Reviewed', iso: ret.reviewedAt });
    if (ret.approvedAt) events.push({ label: 'Approved', iso: ret.approvedAt });
    if (ret.receivedAt) events.push({ label: 'Received', iso: ret.receivedAt });
    if (ret.inspectedAt) events.push({ label: 'Inspected', iso: ret.inspectedAt });
    if (ret.refundedAt) events.push({ label: 'Refunded', iso: ret.refundedAt });
    if (ret.closedAt) events.push({ label: 'Closed', iso: ret.closedAt });
    return events;
  }, [ret]);

  const isTerminal = ret ? TERMINAL_STATUSES.includes(ret.status) : false;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
          Loading return...
        </p>
      </div>
    );
  }

  if (error || !ret) {
    return (
      <>
        <div className="mb-6">
          <Link
            href="/returns"
            className="text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface"
          >
            &larr; Back to returns
          </Link>
        </div>
        <Banner tone="error" message={error || 'Return not found.'} />
      </>
    );
  }

  return (
    <>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/returns"
          className="text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface"
        >
          &larr; Back to returns
        </Link>
      </div>

      {banner && (
        <Banner
          tone={banner.tone === 'info' ? 'info' : banner.tone}
          message={banner.message}
        />
      )}

      {/* Header card */}
      <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Return
              </p>
              <h1 className="font-headline mt-1 text-3xl font-semibold uppercase tracking-[0.1em] text-on-surface">
                {ret.rtnNumber}
              </h1>
              <p className="mt-2 font-body text-xs text-secondary">
                Requested {formatDateTime(ret.requestedAt)}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              {statusCfg && (
                <span
                  className={`inline-block px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${statusCfg.classes}`}
                >
                  {statusCfg.label}
                </span>
              )}
              <SlaPill deadline={ret.slaDeadline} status={ret.status} />
              <span
                className={`inline-block px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${
                  ret.fault === 'US'
                    ? 'bg-error/10 text-error'
                    : 'bg-surface-container-highest text-on-surface'
                }`}
              >
                Fault · {FAULT_LABELS[ret.fault]}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Reason · {REASON_LABELS[ret.reason] ?? ret.reason}
              </span>
            </div>
          </div>
          {ret.description && (
            <div className="mt-5 border-t border-outline-variant/10 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Customer description
              </p>
              <p className="mt-2 font-body text-sm text-on-surface">{ret.description}</p>
            </div>
          )}
        </div>

        {/* Refund summary card */}
        <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Refund
          </p>
          {ret.refundTxn ? (
            <>
              <h3 className="font-headline mt-2 text-3xl font-semibold text-on-surface">
                {formatBDT(ret.refundTxn.amount)}
              </h3>
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-secondary">Method</dt>
                  <dd className="font-semibold text-on-surface">
                    {ret.refundTxn.method.replace('_', ' ')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-secondary">Reference</dt>
                  <dd className="font-mono text-on-surface">{ret.refundTxn.reference}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-secondary">Issued</dt>
                  <dd className="text-on-surface">
                    {formatDateTime(ret.refundTxn.issuedAt)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <h3 className="font-headline mt-2 text-3xl font-semibold text-on-surface">
                —
              </h3>
              <p className="mt-2 text-xs text-secondary">No refund issued yet.</p>
            </>
          )}
        </div>
      </section>

      {/* Customer + order cards */}
      <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Customer
            </p>
            {ret.isManual && (
              <span className="inline-block px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary">
                Manual return
              </span>
            )}
          </div>
          <h3 className="font-headline mt-2 text-xl font-semibold text-on-surface">
            {customerLabel.name}
          </h3>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
            {customerLabel.email && (
              <div>
                <dt className="text-secondary">Email</dt>
                <dd className="mt-1 text-on-surface">{customerLabel.email}</dd>
              </div>
            )}
            {customerLabel.phone && (
              <div>
                <dt className="text-secondary">Phone</dt>
                <dd className="mt-1 text-on-surface">{customerLabel.phone}</dd>
              </div>
            )}
            {ret.carrier && (
              <div>
                <dt className="text-secondary">Carrier</dt>
                <dd className="mt-1 text-on-surface">{ret.carrier}</dd>
              </div>
            )}
            {ret.trackingNumber && (
              <div>
                <dt className="text-secondary">Tracking #</dt>
                <dd className="mt-1 font-mono text-on-surface">{ret.trackingNumber}</dd>
              </div>
            )}
          </dl>
          {ret.pickupAddress && (
            <div className="mt-4 rounded-sm bg-surface-container-low/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Pickup address
              </p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-on-surface">
                {JSON.stringify(ret.pickupAddress, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Linked order */}
        <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Order
          </p>
          {ret.order ? (
            <>
              <Link
                href={`/orders/${ret.order.id}`}
                className="font-headline mt-2 inline-block text-xl font-semibold uppercase tracking-[0.1em] text-on-surface hover:text-primary transition-colors"
              >
                #{ret.order.id.slice(0, 8).toUpperCase()}
              </Link>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-secondary">Status</dt>
                  <dd className="font-semibold text-on-surface">{ret.order.status}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-secondary">Total</dt>
                  <dd className="text-on-surface">{formatBDT(ret.order.total)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-secondary">Line items</dt>
                  <dd className="text-on-surface">{ret.order.items.length}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-2 text-sm text-secondary">No linked order (manual return).</p>
          )}
        </div>
      </section>

      {/* Photos */}
      {ret.photos.length > 0 && (
        <section className="mb-8 bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Photos ({ret.photos.length})
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {ret.photos.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setPhotoOpen(url)}
                className="relative aspect-square overflow-hidden rounded-sm border border-outline-variant/10 bg-surface-container hover:opacity-80 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Return photo ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Items table */}
      <section className="mb-8 bg-surface-container-lowest rounded-sm border border-outline-variant/5 overflow-hidden">
        <header className="border-b border-outline-variant/10 px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Return items ({ret.items.length})
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/40">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Item
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Size / Color
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  SKU
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary text-right">
                  Qty
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary text-right">
                  Unit price
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Inspection
                </th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Restock
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {ret.items.map((it) => {
                const img = itemDisplayImage(it);
                const size = itemSize(it);
                const color = itemColor(it);
                return (
                  <tr key={it.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-sm bg-surface-container">
                          {img ? (
                            <Image
                              src={img}
                              alt={itemDisplayName(it)}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-secondary">
                              —
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-on-surface">
                            {itemDisplayName(it)}
                          </p>
                          {isBundleComponent(it) && (
                            <span className="mt-0.5 inline-block rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-primary">
                              Bundle component
                              {it.orderItem?.bundle?.name
                                ? ` · ${it.orderItem.bundle.name}`
                                : ''}
                            </span>
                          )}
                          {it.orderItem?.product?.slug && !isBundleComponent(it) && (
                            <Link
                              href={`/catalog/products/${it.orderItem.product.slug}`}
                              className="text-[11px] text-secondary hover:text-on-surface"
                            >
                              View product
                            </Link>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-secondary">
                      {[size, color].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface">
                      {itemSku(it) ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-on-surface">
                      {it.quantity}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-on-surface">
                      {formatBDT(itemUnitPrice(it))}
                    </td>
                    <td className="px-6 py-4">
                      {it.inspectionResult ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest ${
                            it.inspectionResult === 'PASS'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-error/10 text-error'
                          }`}
                        >
                          {it.inspectionResult}
                        </span>
                      ) : (
                        <span className="text-xs text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface">
                      {it.restock ? 'Yes' : 'No'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Notes */}
      {(ret.reviewerNotes || ret.inspectionNotes || ret.rejectionReason) && (
        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {ret.reviewerNotes && (
            <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Reviewer notes
              </p>
              <p className="mt-2 font-body text-sm text-on-surface whitespace-pre-wrap">
                {ret.reviewerNotes}
              </p>
            </div>
          )}
          {ret.inspectionNotes && (
            <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Inspection notes
              </p>
              <p className="mt-2 font-body text-sm text-on-surface whitespace-pre-wrap">
                {ret.inspectionNotes}
              </p>
            </div>
          )}
          {ret.rejectionReason && (
            <div className="bg-surface-container-lowest rounded-sm border border-error/30 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-error">
                Rejection reason
              </p>
              <p className="mt-2 font-body text-sm text-on-surface whitespace-pre-wrap">
                {ret.rejectionReason}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Timeline */}
      <section className="mb-8 bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
          Timeline
        </p>
        <ol className="mt-5 space-y-4">
          {timeline.map((evt, idx) => (
            <li key={`${evt.label}-${evt.iso}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-primary" />
                {idx < timeline.length - 1 && (
                  <div className="mt-1 h-8 w-px bg-outline-variant/40" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface">
                  {evt.label}
                </p>
                <p className="text-[11px] text-secondary">{formatDateTime(evt.iso)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Inspect inline form */}
      {ret.status === 'INSPECTING' && (
        <section className="mb-8 bg-surface-container-lowest rounded-sm border border-amber-500/30 p-6">
          <header className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
              Inspection
            </p>
            <h3 className="font-headline mt-1 text-xl font-semibold text-on-surface">
              Record per-item results
            </h3>
            <p className="mt-1 text-xs text-secondary">
              Mark each item PASS or FAIL and indicate whether to restock.
            </p>
          </header>
          <div className="space-y-3">
            {ret.items.map((it) => {
              const current = inspectResults[it.id] ?? {
                result: 'PASS' as const,
                restock: true,
              };
              return (
                <div
                  key={it.id}
                  className="grid grid-cols-1 gap-3 rounded-sm bg-surface-container-low/40 p-4 md:grid-cols-[1fr_auto_auto] md:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      {itemDisplayName(it)}
                    </p>
                    <p className="text-[11px] text-secondary">
                      Qty {it.quantity} · {itemSku(it) ?? 'no sku'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(['PASS', 'FAIL'] as const).map((r) => {
                      const active = current.result === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() =>
                            setInspectResults((prev) => ({
                              ...prev,
                              [it.id]: { ...current, result: r },
                            }))
                          }
                          className={`px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            active
                              ? r === 'PASS'
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-error/20 text-error'
                              : 'bg-surface-container-highest text-secondary hover:text-on-surface'
                          }`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-on-surface">
                    <input
                      type="checkbox"
                      checked={current.restock}
                      onChange={(e) =>
                        setInspectResults((prev) => ({
                          ...prev,
                          [it.id]: { ...current, restock: e.target.checked },
                        }))
                      }
                      className="h-4 w-4"
                    />
                    Restock
                  </label>
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Inspection notes (optional)
            </label>
            <textarea
              value={inspectNotes}
              onChange={(e) => setInspectNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              placeholder="Optional notes for the record"
            />
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={submitCompleteInspection}
              disabled={busy}
              className="atelier-shadow-sm bg-inverse-surface px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Complete inspection'}
            </button>
          </div>
        </section>
      )}

      {/* Action panel */}
      <section className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6 sticky bottom-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Next actions
            </p>
            {statusCfg && (
              <h3 className="font-headline mt-1 text-base font-semibold uppercase tracking-[0.15em] text-on-surface">
                Currently · {statusCfg.label}
              </h3>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ret.status === 'REQUESTED' && (
              <>
                <button
                  type="button"
                  onClick={handleStartReview}
                  disabled={busy}
                  className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
                >
                  Start review
                </button>
                <button
                  type="button"
                  onClick={openReject}
                  disabled={busy}
                  className="bg-error/10 text-error px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-error/20 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {ret.status === 'UNDER_REVIEW' && (
              <>
                <button
                  type="button"
                  onClick={openApprove}
                  disabled={busy}
                  className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={openReject}
                  disabled={busy}
                  className="bg-error/10 text-error px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-error/20 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {(ret.status === 'APPROVED' || ret.status === 'IN_TRANSIT') && (
              <button
                type="button"
                onClick={openMarkReceived}
                disabled={busy}
                className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
              >
                Mark received
              </button>
            )}
            {ret.status === 'RECEIVED' && (
              <button
                type="button"
                onClick={submitStartInspection}
                disabled={busy}
                className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
              >
                Start inspection
              </button>
            )}
            {ret.status === 'INSPECTED_PASS' && (
              <button
                type="button"
                onClick={() => openRefund(false)}
                disabled={busy}
                className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
              >
                Issue refund
              </button>
            )}
            {ret.status === 'INSPECTED_FAIL' && (
              <>
                <button
                  type="button"
                  onClick={submitReturnToCustomer}
                  disabled={busy}
                  className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
                >
                  Ship back to customer
                </button>
                <button
                  type="button"
                  onClick={() => openRefund(true)}
                  disabled={busy}
                  className="bg-amber-500/15 text-amber-700 dark:text-amber-300 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                >
                  Override · refund anyway
                </button>
              </>
            )}
            {isTerminal && (
              <span className="inline-flex items-center gap-2 rounded-sm bg-surface-container-highest px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
                <span className="material-symbols-outlined text-base">lock</span>
                Closed · no further actions
              </span>
            )}
          </div>
        </div>
      </section>

      {/* -------------------- Modals -------------------- */}

      {/* Photo lightbox */}
      <Modal
        open={photoOpen !== null}
        onClose={() => setPhotoOpen(null)}
        title="Return photo"
        width="lg"
      >
        {photoOpen && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoOpen}
            alt="Return photo full size"
            className="mx-auto max-h-[60vh] w-auto object-contain"
          />
        )}
      </Modal>

      {/* Review modal */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Start review"
        description="Move this return into UNDER_REVIEW and optionally leave a note."
        width="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              disabled={busy}
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary hover:text-on-surface disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitReview}
              disabled={busy}
              className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Start review'}
            </button>
          </>
        }
      >
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Reviewer notes (optional)
          </span>
          <textarea
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
            placeholder="Optional notes for the record"
          />
        </label>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject return"
        description="Provide a reason — the customer may see this."
        width="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              disabled={busy}
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary hover:text-on-surface disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitReject}
              disabled={busy}
              className="atelier-shadow-sm bg-[#c62828] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Reject'}
            </button>
          </>
        }
      >
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Reason (required)
          </span>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            required
            className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
            placeholder="e.g. Outside the 7-day window per policy"
          />
        </label>
      </Modal>

      {/* Approve modal */}
      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve return"
        description={
          ret.fault === 'US'
            ? 'Our fault — we typically arrange pickup. Provide carrier + address.'
            : 'Customer fault — they ship back. Carrier/address optional.'
        }
        width="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setApproveOpen(false)}
              disabled={busy}
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary hover:text-on-surface disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitApprove}
              disabled={busy}
              className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Approve'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Carrier
            </span>
            <input
              type="text"
              value={approveCarrier}
              onChange={(e) => setApproveCarrier(e.target.value)}
              className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              placeholder="e.g. Pathao, RedX"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Pickup address (JSON, optional)
            </span>
            <textarea
              value={approvePickup}
              onChange={(e) => setApprovePickup(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 font-mono text-xs text-on-surface focus:border-primary focus:outline-none"
              placeholder='{\n  "name": "...",\n  "phone": "...",\n  "address": "...",\n  "city": "Dhaka"\n}'
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Approval notes (optional)
            </span>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              placeholder="Optional notes for the record"
            />
          </label>
        </div>
      </Modal>

      {/* Mark received modal */}
      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title="Mark received"
        description="Confirm the package landed in the warehouse."
        width="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setReceiveOpen(false)}
              disabled={busy}
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary hover:text-on-surface disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitMarkReceived}
              disabled={busy}
              className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface disabled:opacity-50"
            >
              {busy ? 'Working...' : 'Mark received'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Tracking number (optional)
            </span>
            <input
              type="text"
              value={receiveTracking}
              onChange={(e) => setReceiveTracking(e.target.value)}
              className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
              placeholder="Carrier tracking #"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Received notes (optional)
            </span>
            <textarea
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              placeholder="Condition of package, etc."
            />
          </label>
        </div>
      </Modal>

      {/* Refund modals — same fields, distinct titles */}
      {([
        { open: refundOpen, override: false, title: 'Issue refund' },
        {
          open: overrideRefundOpen,
          override: true,
          title: 'Override · refund despite FAIL',
        },
      ] as const).map((cfg) => (
        <Modal
          key={cfg.title}
          open={cfg.open}
          onClose={() => (cfg.override ? setOverrideRefundOpen(false) : setRefundOpen(false))}
          title={cfg.title}
          description={
            cfg.override
              ? 'This bypasses the FAIL inspection. Use sparingly and document why.'
              : 'Record cash or bank-transfer refund. The order is updated automatically.'
          }
          width="md"
          footer={
            <>
              <button
                type="button"
                onClick={() =>
                  cfg.override ? setOverrideRefundOpen(false) : setRefundOpen(false)
                }
                disabled={busy}
                className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary hover:text-on-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitRefund(cfg.override)}
                disabled={busy}
                className={
                  'atelier-shadow-sm px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] disabled:opacity-50 ' +
                  (cfg.override
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-inverse-surface text-inverse-on-surface')
                }
              >
                {busy ? 'Working...' : cfg.override ? 'Override refund' : 'Issue refund'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Amount (BDT, required)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                placeholder="0.00"
              />
            </label>
            <fieldset>
              <legend className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Method (required)
              </legend>
              <div className="mt-2 flex gap-2">
                {(['CASH', 'BANK_TRANSFER'] as const).map((m) => {
                  const active = refundMethod === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRefundMethod(m)}
                      className={`px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        active
                          ? 'bg-inverse-surface text-inverse-on-surface'
                          : 'bg-surface-container-highest text-secondary hover:text-on-surface'
                      }`}
                    >
                      {m === 'CASH' ? 'Cash' : 'Bank transfer'}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Reference (required)
              </span>
              <input
                type="text"
                value={refundReference}
                onChange={(e) => setRefundReference(e.target.value)}
                required
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
                placeholder="Cash voucher # or txn ID"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Notes (optional)
              </span>
              <textarea
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                placeholder="Why, when, who"
              />
            </label>
          </div>
        </Modal>
      ))}
    </>
  );
}
