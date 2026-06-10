'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Field, TextInput, Checkbox } from '@/components/form';
import { Banner, PrimaryButton } from '@/components/admin-ui';
import type { CollectionDetail } from '../editor-shell';

interface Props {
  readonly collection: CollectionDetail;
  readonly onSaved: (c: CollectionDetail) => void;
  readonly onReload: () => Promise<void>;
}

interface ProductSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly images: string[];
  readonly price: number | string;
  readonly category?: { readonly slug: string } | null;
  readonly variants?: ReadonlyArray<{ readonly sku: string }>;
}

interface AutoRules {
  includeCategoryIds?: string[];
  includeTags?: string[];
  includeIfBestseller?: boolean;
  includeIfNewArrival?: boolean;
  newArrivalDays?: number;
  onSaleOnly?: boolean;
  inStockOnly?: boolean;
  excludeProductIds?: string[];
  maxProducts?: number;
}

export function ProductsTab({ collection, onSaved, onReload }: Props) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const isAuto = collection.type === 'AUTO';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl">Products</h2>
        <p className="mt-1 text-sm text-secondary">
          {isAuto
            ? 'AUTO collections resolve products from rules — no manual list. Define the rules below.'
            : 'Manually attach products and drag to set their display order on the collection page.'}
        </p>
      </div>

      {isAuto ? (
        <AutoRulesForm collection={collection} onSaved={onSaved} token={token} />
      ) : (
        <ManualProductsForm collection={collection} onReload={onReload} token={token} />
      )}
    </div>
  );
}

/* ── Manual product list ───────────────────────────────────────────────── */

function ManualProductsForm({
  collection,
  onReload,
  token,
}: {
  collection: CollectionDetail;
  onReload: () => Promise<void>;
  token: string | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(
    () => collection.products.map((p) => p.productId),
  );
  const productMap = useMemo(() => {
    const m = new Map<string, CollectionDetail['products'][number]>();
    for (const p of collection.products) m.set(p.productId, p);
    return m;
  }, [collection.products]);

  // Search panel
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!showSearch || !token) return;
    setSearching(true);
    const ctrl = new AbortController();
    const delay = q.trim().length === 0 ? 0 : 200;
    const timer = window.setTimeout(async () => {
      try {
        const data = await adminFetch<ProductSummary[]>(
          `/curation/admin/search?q=${encodeURIComponent(q)}&limit=25`,
          token,
          { signal: ctrl.signal },
        );
        setResults(Array.isArray(data) ? data : []);
      } catch {
        // aborted
      } finally {
        setSearching(false);
      }
    }, delay);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, showSearch, token]);

  const existingIds = useMemo(() => new Set(order), [order]);

  async function addProducts(productIds: string[]) {
    if (!token || productIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/collections/${collection.id}/products`, token, {
        method: 'POST',
        body: JSON.stringify({ productIds }),
      });
      setPicked(new Set());
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pickableResults = results.filter((p) => !existingIds.has(p.id));
  const selectAllPickable = () =>
    setPicked(new Set(pickableResults.map((p) => p.id)));
  const clearPicked = () => setPicked(new Set());

  async function removeProduct(productId: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/collections/${collection.id}/products/${productId}`, token, {
        method: 'DELETE',
      });
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  }

  async function persistOrder(newOrder: string[]) {
    if (!token) return;
    setOrder(newOrder);
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/collections/${collection.id}/products/reorder`, token, {
        method: 'PATCH',
        body: JSON.stringify({ productIds: newOrder }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reorder failed');
    } finally {
      setBusy(false);
    }
  }

  // Native HTML5 drag-drop
  const dragSource = useRef<number | null>(null);

  function onDragStart(idx: number) {
    return (e: React.DragEvent) => {
      dragSource.current = idx;
      e.dataTransfer.effectAllowed = 'move';
    };
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  function onDrop(idx: number) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const from = dragSource.current;
      dragSource.current = null;
      if (from === null || from === idx) return;
      const next = [...order];
      const [moved] = next.splice(from, 1);
      if (!moved) return;
      next.splice(idx, 0, moved);
      void persistOrder(next);
    };
  }

  return (
    <div className="space-y-4">
      {error && <Banner tone="error" message={error} />}

      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
          {order.length} {order.length === 1 ? 'product' : 'products'} attached
        </p>
        <PrimaryButton icon="add" onClick={() => setShowSearch((s) => !s)}>
          {showSearch ? 'Close search' : 'Add Products'}
        </PrimaryButton>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="border border-outline-variant/30 bg-surface-container-low p-3 space-y-3">
          <TextInput
            id="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, slug, or SKU (e.g. baggy, 2125)…"
            autoFocus
          />

          {/* Batch controls */}
          {pickableResults.length > 0 && (
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
                {picked.size > 0
                  ? `${picked.size} selected`
                  : `${pickableResults.length} addable`}
              </p>
              <div className="flex gap-3">
                {picked.size > 0 && (
                  <button
                    type="button"
                    onClick={clearPicked}
                    className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary hover:text-on-surface"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={selectAllPickable}
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary hover:opacity-80"
                >
                  Select all {pickableResults.length}
                </button>
              </div>
            </div>
          )}

          {searching ? (
            <p className="text-sm text-secondary p-4 text-center">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-secondary p-4 text-center">No products found.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-outline-variant/10">
              {results.map((p) => {
                const already = existingIds.has(p.id);
                const isPicked = picked.has(p.id);
                return (
                  <li
                    key={p.id}
                    className={`flex items-center gap-3 p-2 transition-colors ${
                      already ? 'opacity-40' : ''
                    } ${isPicked ? 'bg-primary/5' : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={already || busy}
                      checked={isPicked}
                      onChange={() => !already && togglePick(p.id)}
                      className="h-4 w-4 cursor-pointer accent-primary"
                      aria-label={`Select ${p.name}`}
                    />
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden bg-surface">
                      {p.images?.[0] ? (
                        <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{p.name}</p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">
                        BDT {Number(p.price).toLocaleString()}
                      </p>
                    </div>
                    {already ? (
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-500">
                        In collection
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => addProducts([p.id])}
                        className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary hover:opacity-80"
                      >
                        Add only
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Batch add footer */}
          {picked.size > 0 && (
            <div className="flex items-center justify-between border-t border-outline-variant/10 pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
                Tick more or add now
              </p>
              <PrimaryButton
                icon="add"
                onClick={() => addProducts(Array.from(picked))}
                disabled={busy}
              >
                {busy ? 'Adding…' : `Add ${picked.size} selected`}
              </PrimaryButton>
            </div>
          )}
        </div>
      )}

      {/* Sortable list */}
      {order.length === 0 ? (
        <div className="border border-dashed border-outline-variant/30 p-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
            No products yet. Click "Add Products" to attach.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {order.map((productId, idx) => {
            const entry = productMap.get(productId);
            const p = entry?.product;
            if (!p) return null;
            return (
              <li
                key={productId}
                draggable
                onDragStart={onDragStart(idx)}
                onDragOver={onDragOver}
                onDrop={onDrop(idx)}
                className="flex items-center gap-3 border border-outline-variant/20 bg-surface-container p-3 cursor-move"
              >
                <span className="material-symbols-outlined text-secondary text-base" aria-hidden>
                  drag_indicator
                </span>
                <span className="font-mono text-[10px] text-tertiary w-8">{idx + 1}</span>
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden bg-surface">
                  {p.images?.[0] ? (
                    <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{p.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">
                    /{p.slug} · BDT {Number(p.price).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeProduct(productId)}
                  disabled={busy}
                  aria-label="Remove"
                  className="flex h-8 w-8 items-center justify-center text-secondary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden>
                    close
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── AUTO rules form ───────────────────────────────────────────────────── */

function AutoRulesForm({
  collection,
  onSaved,
  token,
}: {
  collection: CollectionDetail;
  onSaved: (c: CollectionDetail) => void;
  token: string | undefined;
}) {
  const initial = (collection.autoRules as AutoRules | null) ?? {};
  const [rules, setRules] = useState<AutoRules>({
    includeIfBestseller: initial.includeIfBestseller ?? false,
    includeIfNewArrival: initial.includeIfNewArrival ?? false,
    newArrivalDays: initial.newArrivalDays ?? 14,
    onSaleOnly: initial.onSaleOnly ?? false,
    inStockOnly: initial.inStockOnly ?? true,
    maxProducts: initial.maxProducts ?? 24,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ id: string; name: string; images: string[] }[]>([]);

  const save = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminFetch<CollectionDetail>(
        `/collections/${collection.id}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ autoRules: rules }),
        },
      );
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [collection.id, onSaved, rules, token]);

  const runPreview = useCallback(async () => {
    setPreviewing(true);
    setError(null);
    try {
      const data = await adminFetch<{
        products: { product: { id: string; name: string; images: string[] } }[];
      }>(`/collections/${collection.slug}/resolved`);
      setPreview(data.products.map((p) => p.product));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }, [collection.slug]);

  return (
    <div className="space-y-6">
      {error && <Banner tone="error" message={error} />}

      <div className="space-y-4 border border-outline-variant/20 bg-surface-container-low p-4">
        <h3 className="font-display text-base">Include products that…</h3>

        <Checkbox
          label="Are marked as Bestseller (isTrending=true on product)"
          checked={!!rules.includeIfBestseller}
          onChange={(e) => setRules({ ...rules, includeIfBestseller: e.target.checked })}
        />

        <Checkbox
          label="Are New Arrivals (added within the last N days)"
          checked={!!rules.includeIfNewArrival}
          onChange={(e) => setRules({ ...rules, includeIfNewArrival: e.target.checked })}
        />
        {rules.includeIfNewArrival && (
          <div className="ml-6">
            <Field label="Days window" name="newArrivalDays">
              <TextInput
                id="newArrivalDays"
                type="number"
                value={rules.newArrivalDays ?? 14}
                onChange={(e) =>
                  setRules({ ...rules, newArrivalDays: Number(e.target.value) || 14 })
                }
              />
            </Field>
          </div>
        )}

        <Checkbox
          label="Are on sale (have a compareAtPrice)"
          checked={!!rules.onSaleOnly}
          onChange={(e) => setRules({ ...rules, onSaleOnly: e.target.checked })}
        />

        <Checkbox
          label="Have at least one variant in stock"
          checked={!!rules.inStockOnly}
          onChange={(e) => setRules({ ...rules, inStockOnly: e.target.checked })}
        />
      </div>

      <Field label="Maximum products to show" name="maxProducts" hint="Hard cap (1–200). Default 24.">
        <TextInput
          id="maxProducts"
          type="number"
          min={1}
          max={200}
          value={rules.maxProducts ?? 24}
          onChange={(e) => setRules({ ...rules, maxProducts: Number(e.target.value) || 24 })}
        />
      </Field>

      <div className="flex gap-3 border-t border-outline-variant/10 pt-6">
        <PrimaryButton icon="check" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Rules'}
        </PrimaryButton>
        <button
          type="button"
          onClick={runPreview}
          disabled={previewing}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary hover:text-on-surface disabled:opacity-40"
        >
          {previewing ? 'Loading…' : 'Preview resolved products →'}
        </button>
      </div>

      {preview.length > 0 && (
        <div className="border border-outline-variant/20 p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
            Preview: {preview.length} products resolved by current rules
          </p>
          <ul className="grid grid-cols-4 gap-3">
            {preview.slice(0, 16).map((p) => (
              <li key={p.id} className="space-y-1">
                <div className="relative aspect-square overflow-hidden bg-surface">
                  {p.images?.[0] && (
                    <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
                  )}
                </div>
                <p className="truncate text-xs">{p.name}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
