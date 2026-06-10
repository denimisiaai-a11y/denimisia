'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';
import { ImportOrdersModal } from '@/components/orders/import-orders-modal';

const BDT_FORMATTER = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'code',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatBDT(amount: number): string {
  if (Number.isNaN(amount)) return BDT_FORMATTER.format(0);
  return BDT_FORMATTER.format(amount);
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

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

interface StatusBadge {
  label: string;
  classes: string;
}

const STATUS_CONFIG: Record<OrderStatus, StatusBadge> = {
  PENDING: {
    label: 'Pending',
    classes: 'bg-surface-container-highest text-on-surface',
  },
  CONFIRMED: {
    label: 'Confirmed',
    classes: 'bg-surface-container text-on-surface',
  },
  PROCESSING: {
    label: 'Processing',
    classes: 'bg-primary/10 text-primary',
  },
  SHIPPED: {
    label: 'Shipped',
    classes: 'bg-inverse-surface text-inverse-on-surface',
  },
  DELIVERED: {
    label: 'Delivered',
    classes: 'bg-surface-container text-on-surface',
  },
  CANCELLED: {
    label: 'Cancelled',
    classes: 'bg-error/10 text-error',
  },
};

type StatusFilter = '' | OrderStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface Order {
  id: string;
  orderNumber?: string;
  user?: {
    name?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phones?: string[];
  };
  guestEmail?: string;
  guestName?: string;
  guestPhone?: string;
  items?: { quantity: number }[];
  customer?: { name?: string; email?: string };
  total: number;
  status: OrderStatus;
  createdAt: string;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

interface GlobalStats {
  // `total` is the all-statuses count so the "Total Orders" card stays
  // accurate when the user is filtered to a specific status. Without it
  // the card mirrors the current filter and shows 0 whenever the active
  // tab has no rows.
  total: number;
  pending: number;
  processing: number;
  shipped: number;
  delivered: number;
}

export default function OrdersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const data = await adminFetch<OrdersResponse>(
        `/orders/admin/all?${query.toString()}`,
        token,
      );
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const countFor = async (status?: OrderStatus): Promise<number> => {
        const qs = new URLSearchParams({ page: '1', limit: '1' });
        if (status) qs.set('status', status);
        const data = await adminFetch<OrdersResponse>(
          `/orders/admin/all?${qs.toString()}`,
          token,
        );
        return data.total ?? 0;
      };
      // Each stat card now matches its corresponding tab exactly — clicking
      // PENDING shows the same count of rows the card advertises. The previous
      // behaviour summed PENDING + CONFIRMED for the "Pending" card while the
      // tab filtered strictly, which produced the bug where the card said "2"
      // but the table said "No orders found".
      const [total, pending, processing, shipped, delivered] = await Promise.all([
        countFor(),
        countFor('PENDING'),
        countFor('PROCESSING'),
        countFor('SHIPPED'),
        countFor('DELIVERED'),
      ]);
      setGlobalStats({
        total,
        pending,
        processing,
        shipped,
        delivered,
      });
    } catch {
      setGlobalStats(null);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, statusFilter]);

  const handleExport = useCallback(() => {
    setActionError('');
    try {
      if (orders.length === 0) {
        setActionError('No orders to export on this page.');
        return;
      }
      const escapeCsv = (value: string): string => {
        if (/[",\n]/.test(value)) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };
      const formatName = (o: Order): string => {
        if (o.user) {
          const combined = [o.user.firstName, o.user.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
          if (combined) return combined;
          if (o.user.name) return o.user.name;
          if (o.user.email) return o.user.email;
        }
        if (o.guestName) return o.guestName;
        if (o.customer?.name) return o.customer.name;
        return 'Guest';
      };
      const formatItemCount = (o: Order): number =>
        (o.items ?? []).reduce((sum, it) => sum + (it.quantity ?? 0), 0);
      // Local time so the admin (BDT) reads it naturally; raw ISO Z forces
      // UTC and requires mental math on every row. Sortable shape preserved.
      const formatDate = (iso: string): string => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };
      const header = [
        'Order #',
        'Customer',
        'Email',
        'Phone',
        'Items',
        'Status',
        'Total (BDT)',
        'Date',
      ];
      const rows = orders.map((o) => [
        o.orderNumber ?? o.id,
        formatName(o),
        o.user?.email ?? o.guestEmail ?? '',
        o.user?.phones?.[0] ?? o.guestPhone ?? '',
        String(formatItemCount(o)),
        o.status,
        String(o.total),
        formatDate(o.createdAt),
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => escapeCsv(String(cell))).join(','))
        .join('\n');
      // Excel needs a UTF-8 BOM to render non-ASCII (BDT , é, accented names)
      // correctly. Without it the file opens as Windows-1252 and mangles
      // anything outside that codepage.
      const blob = new Blob(['﻿' + csv], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `orders-page-${page}-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to export orders');
    }
  }, [orders, page]);

  const handlePrintManifest = useCallback(() => {
    try {
      document.body.classList.add('print-manifest');
      window.print();
    } finally {
      setTimeout(() => {
        document.body.classList.remove('print-manifest');
      }, 500);
    }
  }, []);

  const stats = useMemo(() => {
    const counts = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
    };
    for (const o of orders) {
      if (o.status === 'PENDING' || o.status === 'CONFIRMED') counts.pending += 1;
      else if (o.status === 'PROCESSING') counts.processing += 1;
      else if (o.status === 'SHIPPED') counts.shipped += 1;
      else if (o.status === 'DELIVERED') counts.delivered += 1;
    }
    return counts;
  }, [orders]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCustomerName = (order: Order): string => {
    // API User has firstName + lastName, not a single `name` field. Fall
    // back to guest fields for orders placed without an account.
    const fullName = [order.user?.firstName, order.user?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return (
      fullName ||
      order.user?.name ||
      order.guestName ||
      order.customer?.name ||
      'Unknown'
    );
  };

  const getCustomerEmail = (order: Order): string => {
    return (
      order.user?.email ?? order.guestEmail ?? order.customer?.email ?? ''
    );
  };

  const getDisplayId = (order: Order): string => {
    return order.orderNumber ?? order.id.slice(0, 8).toUpperCase();
  };

  return (
    <>
      {/* Header Section */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Orders
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Every transaction, every handoff, archived with intent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="px-6 py-2 bg-surface-container-highest text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
          >
            Import History
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-6 py-2 bg-surface-container-highest text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
          >
            Export
          </button>
          <button
            type="button"
            onClick={handlePrintManifest}
            className="px-6 py-2 bg-primary text-on-primary text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity duration-300 ease-editorial"
          >
            Print Manifest
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            {globalStats ? 'Total Orders' : 'Total Orders (this page)'}
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-on-surface">
            {(globalStats ? globalStats.total : total).toLocaleString()}
          </h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            {globalStats ? 'Pending' : 'Pending (this page)'}
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-on-surface">
            {(globalStats ? globalStats.pending : stats.pending).toLocaleString()}
          </h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            {globalStats ? 'Shipped' : 'Shipped (this page)'}
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-on-surface">
            {(globalStats ? globalStats.shipped : stats.shipped).toLocaleString()}
          </h3>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            {globalStats ? 'Delivered' : 'Delivered (this page)'}
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-on-surface">
            {(globalStats ? globalStats.delivered : stats.delivered).toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
        {FILTER_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value;
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => {
                setStatusFilter(opt.value);
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
      {actionError && <Banner tone="error" message={actionError} />}

      {/* Data Table */}
      <div className="bg-surface-container-lowest rounded-sm shadow-[0_20px_40px_rgba(27,28,28,0.03)] overflow-hidden border border-outline-variant/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Order ID
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Patron
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Contribution
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Status
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Placed
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-xs font-semibold uppercase tracking-widest text-secondary"
                  >
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-xs font-semibold uppercase tracking-widest text-secondary"
                  >
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING;
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-surface-container-low/50 transition-colors duration-300 ease-editorial cursor-pointer group"
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <td className="px-6 py-5">
                        <span className="font-headline text-sm font-semibold text-on-surface tracking-wide">
                          #{getDisplayId(order)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-semibold text-on-surface">
                          {getCustomerName(order)}
                        </p>
                        {getCustomerEmail(order) && (
                          <p className="text-[10px] text-secondary mt-1 tracking-tight">
                            {getCustomerEmail(order)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-on-surface">
                          {formatBDT(order.total)}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-block px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest ${cfg.classes}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-xs text-secondary font-medium">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Link
                          href={`/orders/${order.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
                        >
                          View
                          <span className="material-symbols-outlined text-sm">
                            arrow_forward
                          </span>
                        </Link>
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
      <ImportOrdersModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          void fetchOrders();
        }}
        apiBase={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}
        token={token}
      />
    </>
  );
}
