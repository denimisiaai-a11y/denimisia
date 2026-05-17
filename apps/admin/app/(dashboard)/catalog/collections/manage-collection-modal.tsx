'use client';

/**
 * Manage-collection modal.
 *
 * Lets an admin:
 *  - edit name / slug / description / isActive
 *  - add products (typeahead search, single or bulk)
 *  - remove products
 *
 * Uses the existing collection REST endpoints:
 *   PATCH /collections/:id
 *   POST  /collections/:id/products      { productId }
 *   DELETE /collections/:id/products/:productId
 *   GET   /curation/admin/search?q=      (shared with Live Media)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Modal } from '@/components/modal';
import { Banner, PrimaryButton } from '@/components/admin-ui';

interface VariantSummary { readonly sku: string }

interface ProductSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: string;
  readonly images: readonly string[];
  readonly category: { readonly slug: string; readonly name: string } | null;
  readonly variants: readonly VariantSummary[];
}

interface CollectionDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly products: readonly { readonly productId: string; readonly product: ProductSummary }[];
}

interface ManageCollectionModalProps {
  readonly open: boolean;
  readonly collectionId: string | null;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

export function ManageCollectionModal({ open, collectionId, onClose, onChanged }: ManageCollectionModalProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const [data, setData] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || !collectionId) return;
    setLoading(true);
    setError('');
    try {
      const c = await adminFetch<CollectionDetail>(`/collections/${collectionId}`, token);
      setData(c);
      setName(c.name);
      setSlug(c.slug);
      setDescription(c.description ?? '');
      setIsActive(c.isActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  }, [token, collectionId]);

  useEffect(() => {
    if (open && collectionId) {
      void load();
    } else if (!open) {
      setData(null);
      setError('');
    }
  }, [open, collectionId, load]);

  const saveMeta = useCallback(async () => {
    if (!token || !collectionId) return;
    setSaving(true);
    setError('');
    try {
      await adminFetch(`/collections/${collectionId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), description: description.trim() || null, isActive }),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [token, collectionId, name, slug, description, isActive, onChanged]);

  const addProduct = useCallback(async (productId: string) => {
    if (!token || !collectionId) return;
    try {
      await adminFetch(`/collections/${collectionId}/products`, token, {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add failed');
    }
  }, [token, collectionId, load, onChanged]);

  const addProductsBulk = useCallback(async (productIds: readonly string[]) => {
    if (!token || !collectionId) return;
    let successCount = 0;
    const errors: string[] = [];
    for (const id of productIds) {
      try {
        await adminFetch(`/collections/${collectionId}/products`, token, {
          method: 'POST',
          body: JSON.stringify({ productId: id }),
        });
        successCount += 1;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Unknown error');
      }
    }
    await load();
    onChanged();
    if (errors.length > 0) {
      const uniqueReasons = Array.from(new Set(errors)).join('; ');
      setError(
        `Added ${successCount} of ${productIds.length}. ${errors.length} failed: ${uniqueReasons}`,
      );
    } else {
      setError('');
    }
  }, [token, collectionId, load, onChanged]);

  const removeProduct = useCallback(async (productId: string) => {
    if (!token || !collectionId) return;
    try {
      await adminFetch(`/collections/${collectionId}/products/${productId}`, token, { method: 'DELETE' });
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    }
  }, [token, collectionId, load, onChanged]);

  if (!open) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={data?.name ? `Manage: ${data.name}` : 'Manage collection'}
        description="Edit metadata, add or remove products."
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
            >
              Close
            </button>
            <PrimaryButton icon="check" onClick={saveMeta} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save details'}
            </PrimaryButton>
          </>
        }
      >
        {error && <Banner tone="error" message={error} />}
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          </div>
        ) : !data ? (
          <p className="font-body text-sm text-secondary">Collection not found.</p>
        ) : (
          <div className="space-y-6">
            {/* ── Metadata ──────────────────────────────────────────── */}
            <section className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">Details</p>
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">Slug</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 font-mono text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="font-body text-sm text-on-surface">Active — visible on storefront</span>
              </label>
            </section>

            {/* ── Products ──────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
                  Products ({data.products.length})
                </p>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                  Add products
                </button>
              </div>
              {data.products.length === 0 ? (
                <div className="mt-3 rounded-md border border-dashed border-outline-variant/30 bg-surface-container-low px-4 py-8 text-center">
                  <p className="font-body text-xs text-secondary">No products yet.</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
                    Click &ldquo;Add products&rdquo; above
                  </p>
                </div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.products.map((cp) => (
                    <li
                      key={cp.productId}
                      className="flex items-center gap-3 rounded-md border border-outline-variant/10 bg-surface-container-low p-2"
                    >
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-surface">
                        {cp.product.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cp.product.images[0]} alt={cp.product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-secondary">
                            <span className="material-symbols-outlined text-base">image</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body text-sm text-on-surface">{cp.product.name}</p>
                        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">
                          {cp.product.category?.slug ?? '—'} · ৳{Number(cp.product.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeProduct(cp.productId)}
                        className="rounded-full p-1.5 text-secondary transition hover:bg-error/10 hover:text-error"
                        title="Remove from collection"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>

      {searchOpen && data && (
        <CollectionProductSearch
          token={token}
          existingIds={new Set(data.products.map((p) => p.productId))}
          onPickSingle={(id) => { setSearchOpen(false); void addProduct(id); }}
          onPickMany={(ids) => { setSearchOpen(false); void addProductsBulk(ids); }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  );
}

// Inlined search modal mirrors the one in section-editor — same UX.
function CollectionProductSearch({
  token,
  existingIds,
  onPickSingle,
  onPickMany,
  onClose,
}: {
  readonly token: string | undefined;
  readonly existingIds: ReadonlySet<string>;
  readonly onPickSingle: (productId: string) => void;
  readonly onPickMany: (productIds: readonly string[]) => void;
  readonly onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (!token) return;
    setLoading(true);
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
      } catch { /* abort */ } finally {
        setLoading(false);
      }
    }, delay);
    return () => { window.clearTimeout(timer); ctrl.abort(); };
  }, [q, token]);

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setPicked(new Set(results.filter((p) => !existingIds.has(p.id)).map((p) => p.id)));
  const clearAll = () => setPicked(new Set());
  const pickableCount = results.filter((p) => !existingIds.has(p.id)).length;

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-8 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface-container shadow-2xl">
        <div className="flex items-center gap-2 border-b border-outline-variant/10 px-4 py-3">
          <span className="material-symbols-outlined text-secondary">search</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            placeholder="Search by name, slug, or model code (e.g. 21003)…"
            className="flex-1 bg-transparent py-1 font-body text-sm text-on-surface placeholder:text-tertiary focus:outline-none"
          />
          <kbd className="rounded bg-surface-container-low px-1.5 py-0.5 font-mono text-[10px] text-tertiary">Esc</kbd>
        </div>
        {results.length > 0 && (
          <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low px-4 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
              {q.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Newly added products'}
            </p>
            <div className="flex items-center gap-3">
              {picked.size > 0 && (
                <button type="button" onClick={clearAll} className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary hover:text-on-surface">
                  Clear ({picked.size})
                </button>
              )}
              <button type="button" onClick={selectAll} disabled={pickableCount === 0} className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary hover:opacity-80 disabled:opacity-40">
                Select all {pickableCount}
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
            </div>
          ) : results.length === 0 ? (
            <p className="p-8 text-center font-body text-sm text-secondary">No products found.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/10">
              {results.map((p) => {
                const already = existingIds.has(p.id);
                const isPicked = picked.has(p.id);
                const sku = p.variants[0]?.sku ?? '';
                return (
                  <li key={p.id}>
                    <label className={`flex cursor-pointer items-center gap-3 p-3 transition ${already ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-container-low'} ${isPicked ? 'bg-primary/5' : ''}`}>
                      <input type="checkbox" disabled={already} checked={isPicked} onChange={() => !already && toggle(p.id)} className="h-4 w-4 cursor-pointer accent-primary" />
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-surface">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-secondary">
                            <span className="material-symbols-outlined text-base">image</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body text-sm text-on-surface">{p.name}</p>
                        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">
                          {p.category?.slug ?? '—'}{sku ? ` · ${sku}` : ''} · ৳{Number(p.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      {already ? (
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-500">In collection</span>
                      ) : !isPicked && (
                        <button type="button" onClick={(e) => { e.preventDefault(); onPickSingle(p.id); }} className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary hover:opacity-80">
                          Add only
                        </button>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/10 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
            {picked.size === 0 ? 'Tick checkboxes to batch-add' : `${picked.size} selected`}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:bg-surface-container-low">
              Close
            </button>
            <button type="button" disabled={picked.size === 0} onClick={() => onPickMany(Array.from(picked))} className="rounded-md bg-primary px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary hover:opacity-90 disabled:opacity-40">
              Add {picked.size > 0 ? picked.size : ''} selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
