'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { ConfirmModal } from '@/components/modal';

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

interface Discount {
  id: string;
  code: string;
  type: DiscountType;
  value: number | string;
  minOrderAmount: number | string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  applicableProductIds: string[];
  applicableCategoryIds: string[];
}

interface DiscountListResponse {
  discounts: Discount[];
  total: number;
  page: number;
  limit: number;
}

interface DiscountFormData {
  code: string;
  type: DiscountType;
  value: string;
  minOrderAmount: string;
  maxUses: string;
  startDate: string;
  endDate: string;
}

type DiscountStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';
type TabFilter = 'ALL' | 'ACTIVE' | 'SCHEDULED' | 'EXPIRED';
type TypeFilter = 'ALL' | DiscountType;
type StatusFilter = 'ALL' | DiscountStatus;

const EMPTY_FORM: DiscountFormData = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  minOrderAmount: '',
  maxUses: '',
  startDate: '',
  endDate: '',
};

const TABS: { id: TabFilter; label: string }[] = [
  { id: 'ALL', label: 'All Codes' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'SCHEDULED', label: 'Scheduled' },
  { id: 'EXPIRED', label: 'Expired' },
];

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStatus(discount: Discount, now: Date): DiscountStatus {
  if (!discount.isActive) return 'INACTIVE';
  if (discount.endDate && new Date(discount.endDate) < now) return 'EXPIRED';
  if (discount.startDate && new Date(discount.startDate) > now) return 'SCHEDULED';
  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) return 'EXPIRED';
  return 'ACTIVE';
}

function formatDate(value: string | null): string {
  if (!value) return 'No Expiry';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatValue(discount: Discount): string {
  const numeric = toNumber(discount.value);
  if (discount.type === 'PERCENTAGE') return `${numeric}%`;
  if (discount.type === 'FREE_SHIPPING') return 'FREE SHIP';
  return `BDT ${numeric.toLocaleString()}`;
}

function typeLabel(type: DiscountType): string {
  if (type === 'PERCENTAGE') return 'Percentage';
  if (type === 'FIXED_AMOUNT') return 'Fixed';
  return 'Free Shipping';
}

function subtitleFor(type: DiscountType): string {
  if (type === 'PERCENTAGE') return 'Percentage Off';
  if (type === 'FIXED_AMOUNT') return 'Fixed Discount';
  return 'Free Shipping Offer';
}

function truncateDateInput(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function DiscountsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscountFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const loadDiscounts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await adminFetch<DiscountListResponse | Discount[]>('/discounts', token);
      const list = Array.isArray(data) ? data : (data?.discounts ?? []);
      setDiscounts(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load discounts');
      setDiscounts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const statusByDiscount = useMemo(() => {
    const map = new Map<string, DiscountStatus>();
    for (const d of discounts) {
      map.set(d.id, getStatus(d, now));
    }
    return map;
  }, [discounts, now]);

  const stats = useMemo(() => {
    let active = 0;
    let totalUses = 0;
    let totalImpact = 0;
    let topPerformer: Discount | null = null;

    for (const d of discounts) {
      const status = statusByDiscount.get(d.id);
      if (status === 'ACTIVE') active += 1;
      totalUses += d.usedCount ?? 0;
      const value = toNumber(d.value);
      if (d.type === 'FIXED_AMOUNT') {
        totalImpact += value * (d.usedCount ?? 0);
      }
      if (!topPerformer || (d.usedCount ?? 0) > (topPerformer.usedCount ?? 0)) {
        topPerformer = d;
      }
    }

    return { active, totalUses, totalImpact, topPerformer };
  }, [discounts, statusByDiscount]);

  const filteredDiscounts = useMemo(() => {
    return discounts.filter((d) => {
      if (activeTab !== 'ALL' && statusByDiscount.get(d.id) !== activeTab) return false;
      if (typeFilter !== 'ALL' && d.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && statusByDiscount.get(d.id) !== statusFilter) return false;
      return true;
    });
  }, [activeTab, discounts, statusByDiscount, typeFilter, statusFilter]);

  const downloadCsv = useCallback(() => {
    const header = ['Code', 'Type', 'Value', 'Used', 'Max', 'Status', 'Start', 'End'];
    const rows = filteredDiscounts.map((d) => [
      d.code,
      d.type,
      String(toNumber(d.value)),
      String(d.usedCount ?? 0),
      d.maxUses === null ? '' : String(d.maxUses),
      statusByDiscount.get(d.id) ?? '',
      d.startDate ?? '',
      d.endDate ?? '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredDiscounts, statusByDiscount]);

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function openEditForm(discount: Discount) {
    setForm({
      code: discount.code,
      type: discount.type,
      value: String(toNumber(discount.value)),
      minOrderAmount:
        discount.minOrderAmount !== null && discount.minOrderAmount !== undefined
          ? String(toNumber(discount.minOrderAmount))
          : '',
      maxUses: discount.maxUses !== null ? String(discount.maxUses) : '',
      startDate: truncateDateInput(discount.startDate),
      endDate: truncateDateInput(discount.endDate),
    });
    setEditingId(discount.id);
    setShowForm(true);
    setError(null);
  }

  function updateField<K extends keyof DiscountFormData>(key: K, value: DiscountFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    // Validation (bugs 3 + 4): end date must be in the future; percent 0<v<=100.
    if (form.endDate && new Date(form.endDate) <= new Date()) {
      setError('End date must be in the future');
      return;
    }
    if (form.type === 'PERCENTAGE') {
      const pct = parseFloat(form.value);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        setError('Percentage must be between 0 and 100');
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        const updatePayload: Record<string, unknown> = {
          value: parseFloat(form.value),
        };
        // Bug 2: include minOrderAmount in the PATCH payload.
        if (form.minOrderAmount) {
          updatePayload.minOrderAmount = parseFloat(form.minOrderAmount);
        } else {
          updatePayload.minOrderAmount = null;
        }
        if (form.maxUses) updatePayload.maxUses = parseInt(form.maxUses, 10);
        if (form.endDate) updatePayload.endDate = new Date(form.endDate).toISOString();

        await adminFetch(`/discounts/${editingId}`, token, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload),
        });
      } else {
        const createPayload: Record<string, unknown> = {
          code: form.code.toUpperCase().trim(),
          type: form.type,
          value: parseFloat(form.value),
        };
        if (form.minOrderAmount) createPayload.minOrderAmount = parseFloat(form.minOrderAmount);
        if (form.maxUses) createPayload.maxUses = parseInt(form.maxUses, 10);
        if (form.startDate) createPayload.startDate = new Date(form.startDate).toISOString();
        if (form.endDate) createPayload.endDate = new Date(form.endDate).toISOString();

        await adminFetch('/discounts', token, {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });
      }
      setShowForm(false);
      setEditingId(null);
      await loadDiscounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save discount');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeleting(true);
    try {
      await adminFetch(`/discounts/${id}`, token, { method: 'DELETE' });
      setDeleteConfirm(null);
      await loadDiscounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete discount');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="pb-12">
      {/* Editorial Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div className="max-w-2xl">
          <nav className="flex items-center space-x-2 text-[10px] uppercase tracking-widest text-secondary mb-4">
            <span>Atelier</span>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-on-surface font-bold">Discounts</span>
          </nav>
          <h2 className="text-5xl font-headline font-semibold tracking-tight text-on-surface leading-none uppercase">
            Promotions <span className="text-primary">&amp;</span> Incentives
          </h2>
          <p className="mt-6 text-secondary leading-relaxed max-w-lg font-light">
            Manage your seasonal campaigns and exclusive atelier offers. Every code reflects the value of the craftsmanship within.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={openCreateForm}
            className="px-6 py-4 bg-primary text-on-primary text-xs font-bold tracking-[0.15em] uppercase rounded-sm flex items-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Create New Discount
          </button>
        </div>
      </section>

      {error && (
        <div className="mb-8 border border-primary/20 bg-primary/5 px-6 py-4 text-sm text-primary">
          {error}
        </div>
      )}

      {/* Stats Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
        <div className="p-8 bg-surface-container-lowest border border-outline-variant/15 col-span-1">
          <p className="text-[10px] uppercase tracking-widest text-secondary mb-2">Active Now</p>
          <p className="text-3xl font-headline font-semibold text-on-surface">{stats.active}</p>
        </div>
        <div className="p-8 bg-surface-container-lowest border border-outline-variant/15 col-span-1">
          <p className="text-[10px] uppercase tracking-widest text-secondary mb-2">Total Redeemed</p>
          <p className="text-3xl font-headline font-semibold text-on-surface">
            {stats.totalUses.toLocaleString()}
          </p>
        </div>
        <div className="p-8 bg-surface-container-lowest border border-outline-variant/15 col-span-1">
          <p className="text-[10px] uppercase tracking-widest text-secondary mb-2">Fixed Discount Impact</p>
          <p className="text-3xl font-headline font-semibold text-on-surface">
            BDT {stats.totalImpact >= 1000
              ? `${(stats.totalImpact / 1000).toFixed(1)}k`
              : stats.totalImpact.toLocaleString()}
          </p>
        </div>
        <div className="relative overflow-hidden col-span-1 bg-primary/90">
          <div className="absolute inset-0 bg-primary/80 flex flex-col justify-center p-8 backdrop-blur-[2px]">
            <p className="text-[10px] uppercase tracking-widest text-on-primary mb-2 opacity-80">
              Top Performer
            </p>
            <p className="text-xl font-headline font-bold text-on-primary uppercase tracking-wider truncate">
              {stats.topPerformer?.code ?? 'No data'}
            </p>
          </div>
        </div>
      </section>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="mb-16 bg-surface-container-lowest border border-outline-variant/15 p-8">
          <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-on-surface">
            {editingId ? 'Edit Discount' : 'Create Discount'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-secondary">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingId)}
                  value={form.code}
                  onChange={(e) => updateField('code', e.target.value)}
                  placeholder="SUMMER24"
                  className="w-full bg-transparent border-b border-outline-variant/30 py-2 text-sm font-headline tracking-widest uppercase text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-secondary">
                  Type
                </label>
                <select
                  disabled={Boolean(editingId)}
                  value={form.type}
                  onChange={(e) => updateField('type', e.target.value as DiscountType)}
                  className="w-full bg-transparent border-b border-outline-variant/30 py-2 text-sm text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED_AMOUNT">Fixed Amount</option>
                  <option value="FREE_SHIPPING">Free Shipping</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-secondary">
                  Value * {form.type === 'PERCENTAGE' ? '(%)' : '(BDT )'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step={form.type === 'PERCENTAGE' ? '1' : '0.01'}
                  max={form.type === 'PERCENTAGE' ? '100' : undefined}
                  value={form.value}
                  onChange={(e) => updateField('value', e.target.value)}
                  className="w-full bg-transparent border-b border-outline-variant/30 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-secondary">
                  Min Order (BDT )
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minOrderAmount}
                  onChange={(e) => updateField('minOrderAmount', e.target.value)}
                  placeholder="No minimum"
                  className="w-full bg-transparent border-b border-outline-variant/30 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-secondary">
                  Max Uses
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxUses}
                  onChange={(e) => updateField('maxUses', e.target.value)}
                  placeholder="Unlimited"
                  className="w-full bg-transparent border-b border-outline-variant/30 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-secondary">
                  Start Date
                </label>
                <input
                  type="date"
                  disabled={Boolean(editingId)}
                  value={form.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  className="w-full bg-transparent border-b border-outline-variant/30 py-2 text-sm text-on-surface focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-widest text-secondary">
                  End Date
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  className="w-full bg-transparent border-b border-outline-variant/30 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-primary text-on-primary text-[10px] font-bold uppercase tracking-[0.2em] rounded-sm hover:scale-105 transition-transform disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Update Discount' : 'Create Discount'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-6 py-3 border border-outline-variant/30 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Data Table Container */}
      <div className="bg-surface-container-lowest border border-outline-variant/15 overflow-hidden">
        <div className="px-8 py-6 flex items-center justify-between bg-surface-container-low/30 border-b border-outline-variant/10">
          <div className="flex items-center space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  activeTab === tab.id
                    ? 'text-xs font-bold uppercase tracking-widest border-b-2 border-primary pb-1 text-on-surface'
                    : 'text-xs font-medium uppercase tracking-widest text-secondary hover:text-on-surface transition-colors pb-1'
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`p-2 transition-colors ${showFilters ? 'text-primary' : 'text-secondary hover:text-primary'}`}
              aria-label="Filter"
              aria-pressed={showFilters}
            >
              <span className="material-symbols-outlined">filter_list</span>
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="p-2 text-secondary hover:text-primary transition-colors"
              aria-label="Download CSV"
            >
              <span className="material-symbols-outlined">download</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="px-8 py-4 flex flex-wrap items-center gap-4 border-b border-outline-variant/10 bg-surface-container-low/20">
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-secondary">
              Type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="bg-transparent border-b border-outline-variant/30 py-1 text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="ALL">All</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed</option>
                <option value="FREE_SHIPPING">Free Shipping</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-secondary">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-transparent border-b border-outline-variant/30 py-1 text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="EXPIRED">Expired</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="ml-auto text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors"
            >
              Reset
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-xs uppercase tracking-widest text-secondary">
            Loading discounts...
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <div className="p-16 text-center text-xs uppercase tracking-widest text-secondary">
            No discount codes in this view.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-outline-variant/10">
                <th className="px-8 py-6 text-[10px] uppercase tracking-[0.2em] font-semibold text-secondary">
                  Code
                </th>
                <th className="px-8 py-6 text-[10px] uppercase tracking-[0.2em] font-semibold text-secondary">
                  Type
                </th>
                <th className="px-8 py-6 text-[10px] uppercase tracking-[0.2em] font-semibold text-secondary">
                  Value
                </th>
                <th className="px-8 py-6 text-[10px] uppercase tracking-[0.2em] font-semibold text-secondary">
                  Usage
                </th>
                <th className="px-8 py-6 text-[10px] uppercase tracking-[0.2em] font-semibold text-secondary">
                  Status
                </th>
                <th className="px-8 py-6 text-[10px] uppercase tracking-[0.2em] font-semibold text-secondary">
                  Expiry Date
                </th>
                <th className="px-8 py-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filteredDiscounts.map((discount) => {
                const status = statusByDiscount.get(discount.id) ?? 'ACTIVE';
                const used = discount.usedCount ?? 0;
                const max = discount.maxUses;
                const usagePct = max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
                const rowMuted = status === 'EXPIRED' || status === 'INACTIVE';

                const statusStyles: Record<DiscountStatus, string> = {
                  ACTIVE:
                    'bg-green-50 text-green-700 border border-green-100',
                  SCHEDULED:
                    'bg-blue-50 text-blue-700 border border-blue-100',
                  EXPIRED:
                    'bg-surface-container text-secondary',
                  INACTIVE:
                    'bg-surface-container text-secondary',
                };

                return (
                  <tr
                    key={discount.id}
                    className={`hover:bg-surface-container-low/40 transition-colors group ${rowMuted ? 'opacity-60' : ''}`}
                  >
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-headline font-bold text-sm tracking-widest text-on-surface">
                          {discount.code}
                        </span>
                        <span className="text-[10px] text-secondary mt-1 uppercase">
                          {subtitleFor(discount.type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-medium text-secondary">
                        {typeLabel(discount.type)}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-semibold text-on-surface">
                        {formatValue(discount)}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5 max-w-[120px]">
                        <div className="flex justify-between text-[10px] uppercase tracking-tighter text-on-surface">
                          <span>
                            {used} / {max ?? '\u221E'}
                          </span>
                          {max ? <span>{usagePct}%</span> : <span className="text-secondary">Unlimited</span>}
                        </div>
                        {max ? (
                          <div className="h-1 bg-surface-container rounded-full overflow-hidden">
                            <div
                              className={
                                status === 'EXPIRED' || status === 'INACTIVE'
                                  ? 'h-full bg-secondary'
                                  : 'h-full bg-primary'
                              }
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                        ) : (
                          <div
                            className="h-1 rounded-full border-t border-dashed border-outline-variant/60"
                            aria-hidden
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm ${statusStyles[status]}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs text-secondary">
                        {formatDate(discount.endDate)}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditForm(discount)}
                          className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(discount.id)}
                          className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="px-8 py-6 flex items-center justify-between border-t border-outline-variant/10">
          <span className="text-xs text-secondary">
            Showing {filteredDiscounts.length} of {discounts.length} promotions
          </span>
        </div>
      </div>

      {/* Secondary Promotional Card Grid */}
      <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="relative group aspect-[21/9] overflow-hidden rounded-sm bg-inverse-surface">
          <div className="absolute inset-0 bg-gradient-to-r from-inverse-surface/90 to-inverse-surface/40 flex flex-col justify-center px-12">
            <span className="text-[10px] uppercase tracking-widest text-inverse-on-surface/60 mb-2">
              Coming Soon
            </span>
            <h3 className="text-inverse-on-surface font-headline text-2xl font-bold uppercase tracking-widest">
              Referral Engine
            </h3>
            <p className="text-inverse-on-surface/70 text-xs mt-2 max-w-xs leading-relaxed">
              Incentivize your atelier community to share the craft. Auto-generate codes for successful referrals.
            </p>
            <button
              type="button"
              disabled
              className="mt-6 text-inverse-on-surface/80 text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 opacity-60 cursor-not-allowed bg-transparent border-0 p-0"
            >
              Configure Settings
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
        <div className="bg-surface-container-high/30 border border-dashed border-outline-variant flex flex-col items-center justify-center p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-secondary mb-4">auto_awesome</span>
          <span className="text-[10px] uppercase tracking-widest text-secondary mb-2">Coming Soon</span>
          <h3 className="text-on-surface font-headline text-lg font-bold uppercase tracking-widest">
            Smart Bundles
          </h3>
          <p className="text-secondary text-xs mt-2 max-w-xs leading-relaxed">
            Let the atelier&apos;s AI suggest product bundles based on seasonal inventory and customer behavior.
          </p>
          <button
            type="button"
            disabled
            className="mt-6 px-6 py-2 border border-outline-variant text-on-surface text-[10px] font-bold uppercase tracking-widest opacity-60 cursor-not-allowed"
          >
            Preview Tool
          </button>
        </div>
      </section>

      <ConfirmModal
        open={deleteConfirm !== null}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) return handleDelete(deleteConfirm);
        }}
        title="Delete Discount"
        message={
          deleteConfirm
            ? `Delete discount "${discounts.find((d) => d.id === deleteConfirm)?.code ?? ''}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />
    </div>
  );
}
