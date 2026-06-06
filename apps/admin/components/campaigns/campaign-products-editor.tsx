'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

interface AttachedProduct {
  readonly id: string;
  readonly productId: string;
  readonly discountType: DiscountType;
  readonly discountValue: number;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly price: string | number;
    readonly images: string[];
  };
}

interface ProductSearchHit {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: string | number;
  readonly images: string[];
}

interface CampaignProductsEditorProps {
  readonly campaignId: string;
  readonly token: string;
}

function formatBdt(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `BDT ${n.toLocaleString()}`;
}

function computeFinal(
  basePrice: number,
  type: DiscountType,
  value: number,
): number {
  if (type === 'PERCENTAGE') return Math.max(0, basePrice - (basePrice * value) / 100);
  return Math.max(0, basePrice - value);
}

export function CampaignProductsEditor({
  campaignId,
  token,
}: CampaignProductsEditorProps) {
  const [products, setProducts] = useState<readonly AttachedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // productId currently mutating
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<{ products: AttachedProduct[] }>(
        `/campaigns/admin/${campaignId}`,
        token,
      );
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [campaignId, token]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (productId: string) => {
    if (!confirm('Remove this product from the campaign? Customers will go back to the original price within ~60 seconds.')) return;
    setBusy(productId);
    try {
      await adminFetch(
        `/campaigns/${campaignId}/products/${productId}`,
        token,
        { method: 'DELETE' },
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded border border-outline-variant/20 bg-surface-container-low p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm">Products in this campaign</h4>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className="text-[10px] font-semibold uppercase tracking-widest text-on-surface hover:text-primary"
        >
          {searchOpen ? '× Cancel' : '+ Add Product'}
        </button>
      </div>

      {error && <Banner tone="error" message={error} />}

      {searchOpen && (
        <ProductSearch
          token={token}
          campaignId={campaignId}
          excludeIds={products.map((p) => p.productId)}
          onAttached={async () => {
            await load();
            setSearchOpen(false);
          }}
        />
      )}

      {loading ? (
        <p className="text-xs text-secondary">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-xs text-secondary">
          No products attached yet. Click <strong>+ Add Product</strong> to put one on sale.
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant/10">
          {products.map((row) => (
            <ProductRow
              key={row.id}
              row={row}
              campaignId={campaignId}
              token={token}
              busy={busy === row.productId}
              onChanged={load}
              onRemove={() => remove(row.productId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductRow({
  row,
  campaignId,
  token,
  busy,
  onChanged,
  onRemove,
}: {
  readonly row: AttachedProduct;
  readonly campaignId: string;
  readonly token: string;
  readonly busy: boolean;
  readonly onChanged: () => Promise<void>;
  readonly onRemove: () => void;
}) {
  const [type, setType] = useState<DiscountType>(row.discountType);
  const [value, setValue] = useState(String(row.discountValue));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const basePrice = Number(row.product.price);
  const numValue = Number(value);
  const finalPrice = computeFinal(basePrice, type, Number.isFinite(numValue) ? numValue : 0);

  const dirty =
    type !== row.discountType || Number(value) !== row.discountValue;

  const save = async () => {
    if (!dirty || !Number.isFinite(numValue) || numValue < 0) {
      setErr('Enter a valid non-negative number.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      // The API's POST /campaigns/:id/products is an upsert by
      // (campaignId, productId) — calling it again with new values
      // updates the existing row. No separate update endpoint needed.
      await adminFetch(`/campaigns/${campaignId}/products`, token, {
        method: 'POST',
        body: JSON.stringify({
          productId: row.productId,
          discountType: type,
          discountValue: numValue,
        }),
      });
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="flex items-center gap-4 py-3">
      {row.product.images?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.product.images[0]}
          alt=""
          className="h-14 w-14 flex-shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-14 w-14 flex-shrink-0 rounded bg-surface-container" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-on-surface">{row.product.name}</p>
        <p className="text-xs text-secondary">Was {formatBdt(basePrice)}</p>
        {err && <p className="mt-1 text-xs text-error">{err}</p>}
      </div>

      <select
        value={type}
        onChange={(e) => setType(e.target.value as DiscountType)}
        disabled={saving || busy}
        className="bg-surface-container px-2 py-1.5 text-xs"
      >
        <option value="PERCENTAGE">% off</option>
        <option value="FIXED_AMOUNT">BDT off</option>
      </select>

      <input
        type="number"
        min="0"
        step={type === 'PERCENTAGE' ? '1' : '10'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving || busy}
        className="w-20 bg-surface-container px-2 py-1.5 text-xs text-right"
      />

      <div className="w-24 text-right text-xs">
        <span className="text-secondary">→ </span>
        <span className="font-mono font-semibold text-on-surface">{formatBdt(finalPrice)}</span>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!dirty || saving || busy}
        className="rounded bg-on-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-surface disabled:opacity-30"
      >
        {saving ? '…' : 'Save'}
      </button>

      <button
        type="button"
        onClick={onRemove}
        disabled={saving || busy}
        title="Remove from campaign"
        className="text-secondary hover:text-error disabled:opacity-30"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </li>
  );
}

function ProductSearch({
  token,
  campaignId,
  excludeIds,
  onAttached,
}: {
  readonly token: string;
  readonly campaignId: string;
  readonly excludeIds: readonly string[];
  readonly onAttached: () => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<readonly ProductSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [type, setType] = useState<DiscountType>('PERCENTAGE');
  const [value, setValue] = useState('10');
  const [adding, setAdding] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        // /products supports a `search` param; we filter out items already
        // attached client-side so the user doesn't double-add.
        const data = await adminFetch<{ products: ProductSearchHit[] }>(
          `/products?search=${encodeURIComponent(term)}&limit=20`,
          token,
        );
        const filtered = (data.products ?? []).filter(
          (p) => !excludeIds.includes(p.id),
        );
        setHits(filtered);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, token, excludeIds]);

  const attach = async (productId: string) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) { setErr('Enter a valid discount value'); return; }
    setAdding(productId);
    setErr('');
    try {
      await adminFetch(`/campaigns/${campaignId}/products`, token, {
        method: 'POST',
        body: JSON.stringify({ productId, discountType: type, discountValue: v }),
      });
      await onAttached();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Attach failed');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-2 rounded border border-outline-variant/20 bg-surface-container p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products by name or slug…"
          className="flex-1 bg-surface-container-low px-3 py-2 text-xs"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DiscountType)}
          className="bg-surface-container-low px-2 py-2 text-xs"
        >
          <option value="PERCENTAGE">% off</option>
          <option value="FIXED_AMOUNT">BDT off</option>
        </select>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 bg-surface-container-low px-2 py-2 text-right text-xs"
        />
      </div>

      {err && <Banner tone="error" message={err} />}

      {searching ? (
        <p className="text-xs text-secondary">Searching…</p>
      ) : hits.length === 0 ? (
        q.trim().length >= 2 && <p className="text-xs text-secondary">No matches.</p>
      ) : (
        <ul className="max-h-60 space-y-1 overflow-y-auto">
          {hits.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-surface-container-low">
              {p.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="h-8 w-8 rounded bg-surface-container" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{p.name}</p>
                <p className="text-[10px] text-secondary">{formatBdt(p.price)}</p>
              </div>
              <button
                type="button"
                onClick={() => attach(p.id)}
                disabled={adding === p.id}
                className="rounded bg-on-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-surface disabled:opacity-30"
              >
                {adding === p.id ? '…' : 'Add'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
