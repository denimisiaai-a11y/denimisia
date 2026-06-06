'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  listAdminReturns,
  type ReturnListItem,
  type ReturnReason,
  type ReturnStatus,
} from '@/lib/api-returns';

const BDT_FORMATTER = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'code',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatBDT(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(n)) return '—';
  return BDT_FORMATTER.format(n);
}

function buildPageWindow(current: number, total: number, windowSize = 5): number[] {
  if (total <= 0) return [];
  if (total <= windowSize) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = Math.floor(windowSize / 2);
  let start = current - half;
  let end = current + half;
  if (start < 1) {
    start = 1;
    end = windowSize;
  }
  if (end > total) {
    end = total;
    start = total - windowSize + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

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

type Tab =
  | 'all'
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'RECEIVED'
  | 'INSPECTING'
  | 'REFUNDED'
  | 'sla';

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'INSPECTING', label: 'Inspecting' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'sla', label: 'Past SLA' },
];

function tabToFilter(tab: Tab): {
  status?: ReturnStatus[];
  slaOverdue?: boolean;
} {
  if (tab === 'sla') return { slaOverdue: true };
  if (tab === 'all') return {};
  return { status: [tab] };
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  const d = new Date(then);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface SlaCellProps {
  deadline: string;
  status: ReturnStatus;
}

function SlaCell({ deadline, status }: SlaCellProps) {
  const dl = new Date(deadline).getTime();
  if (!Number.isFinite(dl)) return <span className="text-secondary">—</span>;
  const diff = dl - Date.now();
  const slaActive = status === 'REQUESTED' || status === 'UNDER_REVIEW';
  if (slaActive && diff < 0) {
    const overdueHours = Math.floor(-diff / 3_600_000);
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-error">
        Overdue {overdueHours}h
      </span>
    );
  }
  if (!slaActive) {
    return <span className="text-secondary">—</span>;
  }
  const hoursLeft = Math.floor(diff / 3_600_000);
  if (hoursLeft < 1) {
    const minutesLeft = Math.max(0, Math.floor(diff / 60_000));
    return (
      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
        {minutesLeft}m left
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-secondary">{hoursLeft}h left</span>
  );
}

export default function ReturnsListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [items, setItems] = useState<ReturnListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fetchReturns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const filter = tabToFilter(tab);
      const data = await listAdminReturns(
        { ...filter, page, limit },
        token,
      );
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [token, tab, page]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const getCustomerLabel = (item: ReturnListItem): { name: string; email: string } => {
    // NOTE: The /admin/returns list endpoint does not currently include
    // order.user details — only guest fields are exposed. For logged-in
    // customer orders we fall back to a placeholder until the API is
    // extended (or join order.user in a future task).
    if (item.guestName || item.guestEmail) {
      return {
        name: item.guestName ?? '—',
        email: item.guestEmail ?? '',
      };
    }
    if (item.order) {
      return { name: 'Customer', email: '' };
    }
    return { name: '—', email: '' };
  };

  const getOrderShort = (item: ReturnListItem): string => {
    if (!item.order) return '—';
    return `#${item.order.id.slice(0, 8).toUpperCase()}`;
  };

  const stats = useMemo(() => {
    const counts = {
      open: 0,
      refunded: 0,
      overdue: 0,
    };
    const now = Date.now();
    for (const it of items) {
      if (it.status === 'REFUNDED') counts.refunded += 1;
      if (it.status !== 'REFUNDED' && it.status !== 'CLOSED' && it.status !== 'CANCELLED') {
        counts.open += 1;
      }
      if (
        (it.status === 'REQUESTED' || it.status === 'UNDER_REVIEW') &&
        new Date(it.slaDeadline).getTime() < now
      ) {
        counts.overdue += 1;
      }
    }
    return counts;
  }, [items]);

  return (
    <>
      {/* Header */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Returns
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Every reversal, every refund, archived with intent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/returns/metrics"
            className="px-6 py-2 bg-surface-container-highest text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
          >
            Metrics
          </Link>
          <Link
            href="/returns/manual"
            className="px-6 py-2 bg-primary text-on-primary text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity duration-300 ease-editorial"
          >
            + Manual return
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Total Returns
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-on-surface">
            {total.toLocaleString()}
          </h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Open (this page)
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-on-surface">
            {stats.open.toLocaleString()}
          </h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Refunded (this page)
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-on-surface">
            {stats.refunded.toLocaleString()}
          </h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Past SLA (this page)
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-error">
            {stats.overdue.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
        {TAB_OPTIONS.map((opt) => {
          const active = tab === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setTab(opt.value);
                setPage(1);
              }}
              className={`whitespace-nowrap px-6 py-2 rounded-sm text-xs font-semibold uppercase tracking-widest transition-colors duration-300 ease-editorial ${
                active
                  ? 'bg-inverse-surface text-inverse-on-surface'
                  : 'bg-surface-container-high text-secondary hover:text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-error/10 text-error text-xs font-semibold uppercase tracking-widest rounded-sm">
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-surface-container-lowest rounded-sm shadow-[0_20px_40px_rgba(27,28,28,0.03)] overflow-hidden border border-outline-variant/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  RTN #
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Type
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Customer
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Order #
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Status
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Reason
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Fault
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Requested
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  SLA
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-right">
                  Items
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-right">
                  Refund
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-12 text-center text-xs font-semibold uppercase tracking-widest text-secondary"
                  >
                    Loading returns...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-16 text-center"
                  >
                    <p className="text-sm font-semibold uppercase tracking-widest text-secondary">
                      No returns yet
                    </p>
                    <p className="mt-2 text-xs text-secondary/70">
                      Customer returns and manual entries will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.REQUESTED;
                  const customer = getCustomerLabel(item);
                  const itemCount = item.items.reduce(
                    (sum, i) => sum + (i.quantity ?? 0),
                    0,
                  );
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-container-low/50 transition-colors duration-300 ease-editorial cursor-pointer group"
                      onClick={() => router.push(`/returns/${item.id}`)}
                    >
                      <td className="px-6 py-5">
                        <span className="font-headline text-sm font-semibold text-on-surface tracking-wide">
                          {item.rtnNumber}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-block px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${
                            item.isManual
                              ? 'bg-primary/10 text-primary'
                              : 'bg-surface-container-highest text-on-surface'
                          }`}
                        >
                          {item.isManual ? 'Manual' : 'Customer'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-semibold text-on-surface">
                          {customer.name}
                        </p>
                        {customer.email && (
                          <p className="text-[10px] text-secondary mt-1 tracking-tight">
                            {customer.email}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs text-secondary font-medium tracking-wide">
                          {getOrderShort(item)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-block px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${cfg.classes}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-xs text-secondary font-medium">
                        {REASON_LABELS[item.reason] ?? item.reason}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-block px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${
                            item.fault === 'US'
                              ? 'bg-error/10 text-error'
                              : 'bg-surface-container-highest text-on-surface'
                          }`}
                        >
                          {item.fault === 'US' ? 'Us' : 'Customer'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-xs text-secondary font-medium">
                        {formatRelative(item.requestedAt)}
                      </td>
                      <td className="px-6 py-5">
                        <SlaCell deadline={item.slaDeadline} status={item.status} />
                      </td>
                      <td className="px-6 py-5 text-right text-xs text-secondary font-medium">
                        {itemCount}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-xs font-semibold text-on-surface">
                          {item.refundTxn ? formatBDT(item.refundTxn.amount) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-5 border-t border-outline-variant/10 flex items-center justify-between">
            <p className="text-xs text-secondary font-medium uppercase tracking-wider">
              Showing {(page - 1) * limit + 1}&ndash;
              {Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 w-8 flex items-center justify-center border border-outline-variant/20 rounded-sm text-secondary hover:bg-surface-container transition-colors duration-300 ease-editorial disabled:opacity-40"
                aria-label="Previous page"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {buildPageWindow(page, totalPages).map((pageNum) => {
                const active = page === pageNum;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    aria-label={`Page ${pageNum}`}
                    aria-current={active ? 'page' : undefined}
                    className={`h-8 w-8 flex items-center justify-center rounded-sm text-xs font-bold transition-colors duration-300 ease-editorial ${
                      active
                        ? 'bg-inverse-surface text-inverse-on-surface'
                        : 'border border-outline-variant/20 text-secondary hover:bg-surface-container'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 w-8 flex items-center justify-center border border-outline-variant/20 rounded-sm text-secondary hover:bg-surface-container transition-colors duration-300 ease-editorial disabled:opacity-40"
                aria-label="Next page"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
