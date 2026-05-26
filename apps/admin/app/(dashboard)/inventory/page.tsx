'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch, adminPost } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  EmptyState,
  SkeletonList,
  StatusChip,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';

interface InventorySummary {
  readonly totalVariants: number;
  readonly healthyStock: number;
  readonly lowStock: number;
  readonly outOfStock: number;
}

interface Variant {
  readonly id: string;
  readonly sku: string;
  readonly size: string;
  readonly color: string;
  readonly stock: number;
  readonly images: readonly string[];
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly images: readonly string[];
  };
}

interface VariantsResponse {
  readonly variants: readonly Variant[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

type Bucket = 'all' | 'out' | 'low' | 'healthy';

const PAGE_SIZE = 50;

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [data, setData] = useState<VariantsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bucket, setBucket] = useState<Bucket>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search input by 300ms so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 whenever the bucket filter changes so the user lands on
  // results rather than an empty trailing page.
  useEffect(() => {
    setPage(1);
  }, [bucket]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (bucket !== 'all') params.set('bucket', bucket);
      if (search) params.set('search', search);

      const [sum, list] = await Promise.all([
        adminFetch<InventorySummary>('/inventory/summary', token),
        adminFetch<VariantsResponse>(
          `/inventory/variants?${params.toString()}`,
          token,
        ),
      ]);
      setSummary(sum);
      setData(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [token, bucket, search, page]);

  useEffect(() => {
    if (status === 'authenticated' && token) {
      void load();
      return;
    }
    if (status === 'unauthenticated' || (status === 'authenticated' && !token)) {
      setLoading(false);
      setError('Session expired. Please sign in again.');
      return;
    }
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('Session is taking too long to load. Try refreshing the page.');
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [status, token, load]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.limit));
  }, [data]);

  return (
    <PageShell
      title="Inventory"
      description="Stock across the atelier floor — every variant, what's full, low, and gone."
      breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock' }]}
    >
      {error && <Banner tone="error" message={error} />}

      <section className="mb-8 grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StockStat
          icon="inventory_2"
          label="Total Variants"
          value={summary?.totalVariants}
          loading={loading && !summary}
        />
        <StockStat
          icon="check_circle"
          label="Healthy Stock"
          value={summary?.healthyStock}
          loading={loading && !summary}
          tone="success"
        />
        <StockStat
          icon="hourglass_bottom"
          label="Low Stock"
          value={summary?.lowStock}
          loading={loading && !summary}
          tone="warning"
        />
        <StockStat
          icon="error"
          label="Out of Stock"
          value={summary?.outOfStock}
          loading={loading && !summary}
          tone="danger"
        />
      </section>

      <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          placeholder="Search SKU or product name…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm sm:max-w-md"
          aria-label="Search variants"
        />
        <div className="flex gap-2">
          <FilterChip label="All" active={bucket === 'all'} onClick={() => setBucket('all')} />
          <FilterChip label="Out" active={bucket === 'out'} onClick={() => setBucket('out')} />
          <FilterChip label="Low" active={bucket === 'low'} onClick={() => setBucket('low')} />
          <FilterChip label="Healthy" active={bucket === 'healthy'} onClick={() => setBucket('healthy')} />
        </div>
      </section>

      <SurfaceCard>
        <SurfaceHeader>
          {loading && !data
            ? 'Loading…'
            : `${data?.total ?? 0} variants${bucket !== 'all' ? ` · ${bucket}` : ''}${search ? ` · "${search}"` : ''}`}
        </SurfaceHeader>

        {loading && !data ? (
          <SkeletonList rowHeight={72} />
        ) : !data || data.variants.length === 0 ? (
          <EmptyState
            icon="search_off"
            label="No variants found"
            description="Try a different filter or search term."
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {data.variants.map((v) => (
              <li key={v.id}>
                <VariantListItem variant={v} token={token} onSaved={load} />
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      {data && totalPages > 1 && (
        <Pagination
          page={data.page}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      )}
    </PageShell>
  );
}

interface VariantListItemProps {
  variant: Variant;
  token: string | undefined;
  onSaved: () => void | Promise<void>;
}

function VariantListItem({ variant, token, onSaved }: VariantListItemProps) {
  const img = variant.images[0] ?? variant.product.images[0];
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-container-low">
      <Link
        href={`/products/${variant.product.id}`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden bg-surface-container">
          {img ? (
            <Image
              src={img}
              alt={variant.product.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <span className="material-symbols-outlined flex h-full items-center justify-center text-secondary">
              inventory_2
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-body text-sm font-semibold text-on-surface">
            {variant.product.name}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
            {variant.sku} · {variant.color} · {variant.size}
          </p>
        </div>
      </Link>
      <div className="flex flex-shrink-0 items-center gap-3">
        <StockBadge stock={variant.stock} />
        <StockEditor variant={variant} token={token} onSaved={onSaved} />
      </div>
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <StatusChip label="Out" tone="danger" />;
  if (stock <= 5) return <StatusChip label={`${stock} left`} tone="warning" />;
  return <StatusChip label={`${stock} in stock`} tone="success" />;
}

interface StockEditorProps {
  variant: Variant;
  token: string | undefined;
  onSaved: () => void | Promise<void>;
}

function StockEditor({ variant, token, onSaved }: StockEditorProps) {
  const [draft, setDraft] = useState(String(variant.stock));
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Sync local draft with server value when the variant refreshes
  // (e.g., after another row's save triggers a reload).
  useEffect(() => {
    setDraft(String(variant.stock));
    setEditError('');
  }, [variant.stock]);

  const draftNum = Number(draft);
  const valid =
    draft.trim() !== '' &&
    Number.isFinite(draftNum) &&
    Number.isInteger(draftNum) &&
    draftNum >= 0 &&
    draftNum <= 10000;
  const dirty = valid && draftNum !== variant.stock;

  const save = async () => {
    if (!dirty || !token) return;
    const delta = draftNum - variant.stock;
    setSaving(true);
    setEditError('');
    try {
      await adminPost(
        '/inventory/adjust',
        {
          variantId: variant.id,
          quantity: delta,
          type: 'ADJUSTMENT',
          note: 'Admin inline edit from Stock page',
        },
        token,
      );
      await onSaved();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={10000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={saving}
        className={`w-20 rounded border bg-surface-container-lowest px-2 py-1 text-right font-mono text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary ${
          !valid
            ? 'border-red-500'
            : dirty
              ? 'border-primary'
              : 'border-outline-variant/30'
        }`}
        aria-label={`Stock for ${variant.sku}`}
      />
      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving}
        className={`rounded px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
          dirty && !saving
            ? 'bg-primary text-on-primary hover:opacity-90'
            : 'cursor-not-allowed bg-surface-container-low text-secondary opacity-50'
        }`}
      >
        {saving ? '…' : 'Save'}
      </button>
      {editError && (
        <span
          className="text-xs text-red-500"
          title={editError}
          aria-label={`Error: ${editError}`}
        >
          !
        </span>
      )}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
        active
          ? 'bg-on-surface text-surface'
          : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
      }`}
    >
      {label}
    </button>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  return (
    <div className="mt-6 flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={page === 1}
        className="rounded border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
      >
        ← Prev
      </button>
      <span className="text-xs uppercase tracking-wider text-secondary">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page === totalPages}
        className="rounded border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}

interface StockStatProps {
  readonly icon: string;
  readonly label: string;
  readonly value?: number;
  readonly loading: boolean;
  readonly tone?: 'default' | 'success' | 'warning' | 'danger';
}

function StockStat({
  icon,
  label,
  value,
  loading,
  tone = 'default',
}: StockStatProps) {
  const valueColor =
    tone === 'danger'
      ? 'text-[#c62828] dark:text-[#ff8a80]'
      : tone === 'warning'
        ? 'text-[#d97706]'
        : tone === 'success'
          ? 'text-[#2e7d32] dark:text-[#81c784]'
          : 'text-on-surface';
  return (
    <div className="atelier-shadow bg-surface-container-lowest p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            {label}
          </p>
          {loading ? (
            <div className="mt-3 h-9 w-20 animate-pulse bg-surface-container-low" />
          ) : (
            <p
              className={
                'mt-3 font-headline text-3xl font-semibold ' + valueColor
              }
            >
              {value?.toLocaleString() ?? '—'}
            </p>
          )}
        </div>
        <span
          className="material-symbols-outlined text-secondary"
          aria-hidden
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
