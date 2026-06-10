'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';
import { Modal } from '@/components/modal';
import { ImportCsvModal } from '@/components/customers/import-csv-modal';

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

interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phones?: string[];
  isActive?: boolean;
  createdAt: string;
  totalOrders?: number;
  totalSpent?: number;
}

interface CustomersResponse {
  users?: Customer[];
  total?: number;
  page?: number;
  limit?: number;
}

type SegmentFilter = 'ALL' | 'VIP' | 'ACTIVE' | 'NEW' | 'DORMANT';

const SEGMENT_LABELS: Record<SegmentFilter, string> = {
  ALL: 'All Members',
  VIP: 'VIP Archive',
  ACTIVE: 'Active Patrons',
  NEW: 'New Arrivals',
  DORMANT: 'Dormant',
};

const DORMANT_THRESHOLD_DAYS = 30;

function getInitials(firstName: string, lastName: string): string {
  const first = firstName?.[0] ?? '';
  const last = lastName?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '—';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `\BDT ${value.toLocaleString()}`;
}

function classifySegment(customer: Customer): Exclude<SegmentFilter, 'ALL'> {
  const orders = customer.totalOrders ?? 0;
  const spent = customer.totalSpent ?? 0;
  const createdAt = new Date(customer.createdAt);
  const ageDays = Number.isNaN(createdAt.getTime())
    ? 0
    : Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  if (orders >= 5 || spent >= 100000) return 'VIP';
  if (orders === 0 && ageDays > DORMANT_THRESHOLD_DAYS) return 'DORMANT';
  if (orders >= 1) return 'ACTIVE';
  return 'NEW';
}

function segmentBadge(
  segment: Exclude<SegmentFilter, 'ALL'>,
): { label: string; classes: string } {
  if (segment === 'VIP') {
    return {
      label: 'VIP',
      classes: 'bg-primary/10 text-primary',
    };
  }
  if (segment === 'NEW') {
    return {
      label: 'New',
      classes: 'bg-surface-container-high text-on-surface',
    };
  }
  if (segment === 'DORMANT') {
    return {
      label: 'Dormant',
      classes: 'bg-error/10 text-error',
    };
  }
  return {
    label: 'Active',
    classes: 'bg-surface-container text-secondary',
  };
}

export default function CustomersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.accessToken;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [segment, setSegment] = useState<SegmentFilter>('ALL');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionError, setActionError] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [minOrders, setMinOrders] = useState<string>('');
  const [minLtv, setMinLtv] = useState<string>('');
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const loadCustomers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        role: 'CUSTOMER',
        page: String(page),
        limit: String(limit),
      });
      const data = await adminFetch<CustomersResponse | Customer[]>(
        `/users?${query.toString()}`,
        token,
      );
      if (Array.isArray(data)) {
        setCustomers(data);
        setTotalCount(data.length);
      } else {
        const list = Array.isArray(data.users) ? data.users : [];
        setCustomers(list);
        setTotalCount(typeof data.total === 'number' ? data.total : list.length);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
      setCustomers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const minOrdersNum = minOrders === '' ? null : Number(minOrders);
    const minLtvNum = minLtv === '' ? null : Number(minLtv);
    return customers.filter((c) => {
      if (segment !== 'ALL' && classifySegment(c) !== segment) return false;
      if (minOrdersNum != null && !Number.isNaN(minOrdersNum)) {
        if ((c.totalOrders ?? 0) < minOrdersNum) return false;
      }
      if (minLtvNum != null && !Number.isNaN(minLtvNum)) {
        if ((c.totalSpent ?? 0) < minLtvNum) return false;
      }
      return true;
    });
  }, [customers, segment, minOrders, minLtv]);

  const handleExport = useCallback(() => {
    setActionError('');
    try {
      if (filteredCustomers.length === 0) {
        setActionError('No customers to export.');
        return;
      }
      const escapeCsv = (value: string): string =>
        /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      const header = ['id', 'name', 'email', 'phone', 'orders', 'lifetimeValue', 'registered'];
      const rows = filteredCustomers.map((c) => [
        c.id,
        `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        c.email,
        c.phones?.[0] ?? '',
        String(c.totalOrders ?? 0),
        String(c.totalSpent ?? 0),
        c.createdAt,
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => escapeCsv(String(cell))).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `customers-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to export customers');
    }
  }, [filteredCustomers]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setAddError('');
    if (!addForm.email || !addForm.firstName) {
      setAddError('First name and email are required.');
      return;
    }
    setAddBusy(true);
    try {
      await adminFetch('/users', token, {
        method: 'POST',
        body: JSON.stringify({
          firstName: addForm.firstName,
          lastName: addForm.lastName,
          email: addForm.email,
          phone: addForm.phone || undefined,
        }),
      });
      setAddOpen(false);
      setAddForm({ firstName: '', lastName: '', email: '', phone: '' });
      await loadCustomers();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to add customer';
      if (/already exists/i.test(message)) {
        setAddError(
          'This email is already registered. The customer can update their own profile by signing in.',
        );
      } else {
        setAddError(message);
      }
    } finally {
      setAddBusy(false);
    }
  };

  const stats = useMemo(() => {
    const total = customers.length;
    const vipCount = customers.filter((c) => classifySegment(c) === 'VIP').length;
    const vipPct = total > 0 ? Math.round((vipCount / total) * 100) : 0;

    const spentValues = customers
      .map((c) => c.totalSpent)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    const avgLTV =
      spentValues.length > 0
        ? Math.round(spentValues.reduce((sum, v) => sum + v, 0) / spentValues.length)
        : null;

    return { total, vipCount, vipPct, avgLTV };
  }, [customers]);

  return (
    <>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Clientele
          </h2>
          <p className="text-secondary font-body mt-2 text-sm tracking-wide">
            Managing the collective of Denimisia patrons and editorial contributors.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="px-6 py-2 bg-surface-container-highest text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
          >
            Export List
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="px-6 py-2 bg-surface-container-highest text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/30 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="px-6 py-2 bg-primary text-on-primary text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity duration-300 ease-editorial"
          >
            Add Customer
          </button>
        </div>
      </div>

      {/* Filter Segments */}
      <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2">
        {(Object.keys(SEGMENT_LABELS) as SegmentFilter[]).map((key) => {
          const active = segment === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSegment(key)}
              className={`whitespace-nowrap px-6 py-2 rounded-sm text-xs font-semibold uppercase tracking-widest transition-colors duration-300 ease-editorial ${
                active
                  ? 'bg-inverse-surface text-inverse-on-surface'
                  : 'bg-surface-container-high text-secondary hover:text-on-surface'
              }`}
            >
              {SEGMENT_LABELS[key]}
            </button>
          );
        })}
        <div className="h-4 w-px bg-outline-variant/30 mx-2" />
        <button
          type="button"
          onClick={() => setShowMoreFilters((v) => !v)}
          aria-expanded={showMoreFilters}
          className="flex items-center gap-2 whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
        >
          <span className="material-symbols-outlined text-sm">filter_list</span> More Filters
        </button>
      </div>

      {/* Extra filter panel */}
      {showMoreFilters && (
        <div className="mb-8 flex flex-wrap items-end gap-4 bg-surface-container-low p-4 rounded-sm border border-outline-variant/10">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="minOrders"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
            >
              Min Orders
            </label>
            <input
              id="minOrders"
              type="number"
              min="0"
              value={minOrders}
              onChange={(e) => setMinOrders(e.target.value)}
              className="px-3 py-2 bg-surface-container text-on-surface text-xs border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="minLtv"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
            >
              Min Lifetime Value
            </label>
            <input
              id="minLtv"
              type="number"
              min="0"
              value={minLtv}
              onChange={(e) => setMinLtv(e.target.value)}
              className="px-3 py-2 bg-surface-container text-on-surface text-xs border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setMinOrders('');
              setMinLtv('');
            }}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Error */}
      {error && <Banner tone="error" message={error} />}
      {actionError && <Banner tone="error" message={actionError} />}

      {/* Data Table Container */}
      <div className="bg-surface-container-lowest rounded-sm shadow-[0_20px_40px_rgba(27,28,28,0.03)] overflow-hidden border border-outline-variant/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Participant
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Reach &amp; Context
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Engagements
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Total Contribution
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Induction
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs font-semibold uppercase tracking-widest text-secondary">
                    Loading clientele...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs font-semibold uppercase tracking-widest text-secondary">
                    No participants found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const seg = classifySegment(customer);
                  const badge = segmentBadge(seg);
                  const initials = getInitials(customer.firstName, customer.lastName);
                  const fullName =
                    `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
                    customer.email;
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => router.push(`/customers/${customer.id}`)}
                      className="cursor-pointer hover:bg-surface-container-low/30 transition-colors duration-300 ease-editorial group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-surface-container-high rounded-sm flex items-center justify-center flex-shrink-0 text-secondary text-xs font-bold uppercase tracking-widest">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-on-surface">{fullName}</p>
                            <span
                              className={`inline-block px-2 py-0.5 mt-1 text-[9px] font-bold uppercase tracking-widest rounded-sm ${badge.classes}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs text-on-surface">{customer.email}</p>
                        <p className="text-[10px] text-secondary mt-1 tracking-tight">
                          {customer.phones?.[0] ?? '—'}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-sm text-on-surface font-medium">
                        {typeof customer.totalOrders === 'number'
                          ? `${customer.totalOrders} ${customer.totalOrders === 1 ? 'Order' : 'Orders'}`
                          : '—'}
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-on-surface">
                          {formatCurrency(customer.totalSpent)}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-xs text-secondary font-medium">
                        {formatDate(customer.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-5 border-t border-outline-variant/10 flex items-center justify-between">
          <p className="text-xs text-secondary font-medium uppercase tracking-wider">
            Showing {filteredCustomers.length} of {totalCount} participants
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
              disabled={page >= totalPages}
              className="h-8 w-8 flex items-center justify-center border border-outline-variant/20 rounded-sm text-secondary hover:bg-surface-container transition-colors duration-300 ease-editorial disabled:opacity-40"
              aria-label="Next page"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid (Bento Style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <div className="bg-surface-container-low p-8 rounded-sm border border-outline-variant/5">
          <div className="flex items-center justify-between mb-4">
            <span className="material-symbols-outlined text-primary">diversity_3</span>
            <span className="text-[10px] font-bold text-secondary tracking-tighter uppercase">
              Live Count
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Total Collective
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-1 text-on-surface">
            {stats.total.toLocaleString()}
          </h3>
        </div>
        <div className="bg-surface-container-low p-8 rounded-sm border border-outline-variant/5">
          <div className="flex items-center justify-between mb-4">
            <span className="material-symbols-outlined text-secondary">diamond</span>
            <span className="text-[10px] font-bold text-secondary tracking-tighter uppercase">
              {stats.total > 0 ? `${stats.vipPct}% of total` : '—'}
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            VIP Archivists
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-1 text-on-surface">
            {stats.vipCount.toLocaleString()}
          </h3>
        </div>
        <div className="bg-primary text-on-primary p-8 rounded-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="material-symbols-outlined">analytics</span>
            <span className="text-[10px] font-bold opacity-80 tracking-tighter uppercase">
              Lifetime Avg
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">
            Average Lifetime Value
          </p>
          <h3 className="font-headline text-3xl font-semibold mt-1">
            {stats.avgLTV !== null ? formatCurrency(stats.avgLTV) : '—'}
          </h3>
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Customer"
        description="Creates a customer record immediately. No password or email is sent — the customer can later sign up with this email to claim the account."
        width="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              disabled={addBusy}
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary transition-colors hover:text-on-surface disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-participant-form"
              disabled={addBusy}
              className="atelier-shadow-sm px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] bg-inverse-surface text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
            >
              {addBusy ? 'Saving…' : 'Add Customer'}
            </button>
          </>
        }
      >
        <form
          id="add-participant-form"
          onSubmit={handleAddSubmit}
          className="space-y-4"
        >
          {addError && <Banner tone="error" message={addError} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="add-firstName"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                First Name
              </label>
              <input
                id="add-firstName"
                type="text"
                required
                value={addForm.firstName}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, firstName: e.target.value }))
                }
                className="mt-1 w-full px-3 py-2 bg-surface-container text-on-surface text-sm border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label
                htmlFor="add-lastName"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                Last Name
              </label>
              <input
                id="add-lastName"
                type="text"
                value={addForm.lastName}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, lastName: e.target.value }))
                }
                className="mt-1 w-full px-3 py-2 bg-surface-container text-on-surface text-sm border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="add-email"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
            >
              Email
            </label>
            <input
              id="add-email"
              type="email"
              required
              value={addForm.email}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, email: e.target.value }))
              }
              className="mt-1 w-full px-3 py-2 bg-surface-container text-on-surface text-sm border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label
              htmlFor="add-phone"
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
            >
              Phone (optional)
            </label>
            <input
              id="add-phone"
              type="tel"
              value={addForm.phone}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="mt-1 w-full px-3 py-2 bg-surface-container text-on-surface text-sm border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary"
            />
          </div>
        </form>
      </Modal>

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          void loadCustomers();
        }}
        apiBase={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}
        token={token}
      />
    </>
  );
}
