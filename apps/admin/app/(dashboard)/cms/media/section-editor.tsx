'use client';

/**
 * Right-pane editor for dynamic product sections (new arrivals, bestsellers,
 * trending, bundles). Replaces the upload-focused SlotEditor when the
 * selected badge is a product-section slot.
 *
 * Features:
 *  - Typeahead search bar: click shows 10 newest products; type to fuzzy-match
 *    by name, slug, description, or variant SKU/model code.
 *  - Source mode toggle: COLLECTION | MANUAL | MIXED.
 *  - Drag-to-reorder product list.
 *  - Per-entry custom thumbnail upload (uses /media/admin/upload so assets
 *    dedupe, transcode videos, and get version history).
 *  - [Edit product] link jumps to the Products admin page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { formatBytes } from './types';
import { useToast } from './toast';

type CurationSource = 'COLLECTION' | 'MANUAL' | 'MIXED';

interface VariantSummary {
  readonly price: string;
  readonly stock: number;
  readonly size: string;
  readonly color: string;
  readonly sku: string;
}

interface ProductSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: string;
  readonly images: readonly string[];
  readonly category: { readonly slug: string; readonly name: string } | null;
  readonly variants: readonly VariantSummary[];
}

interface MediaAssetSummary {
  readonly id: string;
  readonly publicUrl: string;
  readonly posterUrl: string | null;
  readonly kind: 'IMAGE' | 'VIDEO';
}

interface SectionProductRow {
  readonly id: string;
  readonly productId: string;
  readonly position: number;
  readonly isPinned: boolean;
  readonly customImageAssetId: string | null;
  readonly customImage: MediaAssetSummary | null;
  readonly product: ProductSummary;
}

interface CurationData {
  readonly id: string;
  readonly pageKey: string;
  readonly sectionKey: string;
  readonly label: string;
  readonly sourceMode: CurationSource;
  readonly collectionId: string | null;
  readonly heading: string | null;
  readonly subheading: string | null;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  readonly maxItems: number;
  readonly isActive: boolean;
  readonly products: readonly SectionProductRow[];
  readonly collection: { readonly id: string; readonly name: string; readonly slug: string } | null;
}

interface Collection {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

interface SectionEditorProps {
  readonly pageKey: string;
  readonly sectionKey: string;
  readonly label: string;
  readonly token: string | undefined;
  readonly onClose: (changed: boolean) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export function SectionEditor({ pageKey, sectionKey, label, token, onClose }: SectionEditorProps) {
  const toast = useToast();
  const [curation, setCuration] = useState<CurationData | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [maxItemsInput, setMaxItemsInput] = useState<string>('');
  const mutatedRef = useRef(false);
  const markMutated = useCallback(() => { mutatedRef.current = true; }, []);
  const handleClose = useCallback(() => onClose(mutatedRef.current), [onClose]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [c, cols] = await Promise.all([
        adminFetch<CurationData>(
          `/curation/admin/${pageKey}/${sectionKey}?label=${encodeURIComponent(label)}`,
          token,
        ),
        adminFetch<Collection[]>('/collections', token).catch(() => [] as Collection[]),
      ]);
      setCuration(c);
      setCollections(Array.isArray(cols) ? cols : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load section');
    } finally {
      setLoading(false);
    }
  }, [token, pageKey, sectionKey, label]);

  useEffect(() => { void load(); }, [load]);

  // Keep the Max items input in sync with server state whenever curation reloads.
  useEffect(() => {
    if (curation) setMaxItemsInput(String(curation.maxItems));
  }, [curation]);

  const saveCuration = useCallback(async (patch: Partial<{
    label: string;
    sourceMode: CurationSource;
    collectionId: string | null;
    heading: string;
    subheading: string;
    ctaLabel: string;
    ctaHref: string;
    maxItems: number;
    isActive: boolean;
  }>) => {
    if (!token || !curation) return;
    try {
      const updated = await adminFetch<CurationData>(
        `/curation/admin/${pageKey}/${sectionKey}`,
        token,
        {
          method: 'PUT',
          body: JSON.stringify({
            label:        patch.label        ?? curation.label,
            sourceMode:   patch.sourceMode   ?? curation.sourceMode,
            collectionId: patch.collectionId === undefined ? curation.collectionId : patch.collectionId,
            heading:      patch.heading      ?? curation.heading ?? undefined,
            subheading:   patch.subheading   ?? curation.subheading ?? undefined,
            ctaLabel:     patch.ctaLabel     ?? curation.ctaLabel ?? undefined,
            ctaHref:      patch.ctaHref      ?? curation.ctaHref ?? undefined,
            maxItems:     patch.maxItems     ?? curation.maxItems,
            isActive:     patch.isActive     ?? curation.isActive,
          }),
        },
      );
      setCuration(updated);
      markMutated();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Save failed');
    }
  }, [token, curation, pageKey, sectionKey, toast, markMutated]);

  const addProduct = useCallback(async (productId: string) => {
    if (!token) return;
    try {
      await adminFetch(
        `/curation/admin/${pageKey}/${sectionKey}/products`,
        token,
        { method: 'POST', body: JSON.stringify({ productId }) },
      );
      markMutated();
      toast.push('success', 'Product added');
      await load();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Add failed');
    }
  }, [token, pageKey, sectionKey, toast, load, markMutated]);

  const addProductsBulk = useCallback(async (productIds: readonly string[]) => {
    if (!token || productIds.length === 0) return;
    try {
      const res = await adminFetch<{ added: number; skipped: number }>(
        `/curation/admin/${pageKey}/${sectionKey}/products/bulk`,
        token,
        { method: 'POST', body: JSON.stringify({ productIds }) },
      );
      markMutated();
      toast.push('success', `Added ${res.added}${res.skipped > 0 ? ` (${res.skipped} already in)` : ''}`);
      await load();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Bulk add failed');
    }
  }, [token, pageKey, sectionKey, toast, load, markMutated]);

  const fillFromCollection = useCallback(async () => {
    if (!token) return;
    if (!confirm('Copy all products from the linked collection into this section?')) return;
    try {
      const res = await adminFetch<{ added: number; skipped: number }>(
        `/curation/admin/${pageKey}/${sectionKey}/fill-from-collection`,
        token,
        { method: 'POST' },
      );
      markMutated();
      toast.push('success', `Added ${res.added}${res.skipped > 0 ? ` (${res.skipped} already in)` : ''}`);
      await load();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Fill failed');
    }
  }, [token, pageKey, sectionKey, toast, load, markMutated]);

  const removeProduct = useCallback(async (sectionProductId: string) => {
    if (!token) return;
    try {
      await adminFetch(`/curation/admin/products/${sectionProductId}`, token, { method: 'DELETE' });
      markMutated();
      toast.push('info', 'Removed');
      await load();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Remove failed');
    }
  }, [token, toast, load, markMutated]);

  const togglePin = useCallback(async (row: SectionProductRow) => {
    if (!token) return;
    try {
      await adminFetch(`/curation/admin/products/${row.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isPinned: !row.isPinned }),
      });
      markMutated();
      await load();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Update failed');
    }
  }, [token, toast, load, markMutated]);

  const reorder = useCallback(async (orderedProductIds: string[]) => {
    if (!token) return;
    try {
      await adminFetch(`/curation/admin/${pageKey}/${sectionKey}/reorder`, token, {
        method: 'PUT',
        body: JSON.stringify({ orderedProductIds }),
      });
      markMutated();
      await load();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Reorder failed');
    }
  }, [token, pageKey, sectionKey, toast, load, markMutated]);

  const uploadCustomImage = useCallback(async (row: SectionProductRow, file: File) => {
    if (!token) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.push('error', `File too large (${formatBytes(file.size)} — max 5 MB)`);
      return;
    }
    try {
      // Route through /media/admin/upload — bypass the slot-specific cap by
      // uploading to a conventional "section-thumbs" pseudo-slot. This piggybacks
      // on the existing dedupe + transcode pipeline.
      const fd = new FormData();
      fd.append('file', file);
      const url = `${API}/media/admin/upload-asset`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Upload failed: ${res.status}`);
      }
      const json = await res.json();
      const asset = (json.data ?? json) as { id: string };
      await adminFetch(`/curation/admin/products/${row.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ customImageAssetId: asset.id }),
      });
      markMutated();
      toast.push('success', 'Thumbnail updated');
      await load();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Upload failed');
    }
  }, [token, toast, load, markMutated]);

  const clearCustomImage = useCallback(async (row: SectionProductRow) => {
    if (!token) return;
    try {
      await adminFetch(`/curation/admin/products/${row.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ customImageAssetId: null }),
      });
      markMutated();
      await load();
      toast.push('info', 'Thumbnail reset to product image');
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Reset failed');
    }
  }, [token, toast, load, markMutated]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
      </div>
    );
  }

  if (!curation) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="font-body text-sm text-secondary">{error || 'Section not found'}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-outline-variant/10 px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
              {pageKey} / {sectionKey}
            </p>
            <h2 className="mt-1 truncate font-display text-xl text-on-surface">{curation.label}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-secondary hover:bg-surface-container-low hover:text-on-surface"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
          {curation.products.length} / {curation.maxItems} products curated
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* ── Source mode ─────────────────────────────────────────────────── */}
        <section>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">Source</p>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-surface-container-low p-1">
            {(['COLLECTION', 'MIXED', 'MANUAL'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => void saveCuration({ sourceMode: mode })}
                className={`rounded py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] transition ${
                  curation.sourceMode === mode
                    ? 'bg-primary text-on-primary'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-tertiary">
            {curation.sourceMode === 'COLLECTION' && 'Pulls products from the linked collection.'}
            {curation.sourceMode === 'MIXED' && 'Pinned manual picks first, then fills from collection.'}
            {curation.sourceMode === 'MANUAL' && 'Only shows the manually curated products.'}
          </p>
        </section>

        {curation.sourceMode !== 'MANUAL' && (
          <section>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">Collection</p>
            <select
              value={curation.collectionId ?? ''}
              onChange={(e) => void saveCuration({ collectionId: e.target.value || null })}
              className="w-full rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
            >
              <option value="">— select a collection —</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>
              ))}
            </select>
          </section>
        )}

        {/* ── Text metadata ───────────────────────────────────────────────── */}
        <section className="space-y-3">
          <TextField label="Heading" value={curation.heading ?? ''}
            onBlur={(v) => void saveCuration({ heading: v })} />
          <TextField label="Subheading" value={curation.subheading ?? ''}
            onBlur={(v) => void saveCuration({ subheading: v })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="CTA label" value={curation.ctaLabel ?? ''}
              onBlur={(v) => void saveCuration({ ctaLabel: v })} />
            <TextField label="CTA link" value={curation.ctaHref ?? ''}
              onBlur={(v) => void saveCuration({ ctaHref: v })} />
          </div>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">Max items</span>
            <input
              type="number"
              min={1}
              max={50}
              value={maxItemsInput}
              onChange={(e) => setMaxItemsInput(e.target.value)}
              onBlur={() => {
                const n = Math.max(1, Math.min(50, Number(maxItemsInput) || 12));
                if (n !== curation.maxItems) void saveCuration({ maxItems: n });
                setMaxItemsInput(String(n));
              }}
              className="w-24 rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </label>
        </section>

        {/* ── Product picker ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
              Products ({curation.products.length})
            </p>
          </div>

          {/* ── Big, visible actions ───────────────────────────────────── */}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[14px]">add_circle</span>
              Add products
            </button>
            {curation.collectionId && (
              <button
                type="button"
                onClick={() => void fillFromCollection()}
                title="Copy every product from the linked collection into this section"
                className="flex items-center gap-1.5 rounded-md border border-outline-variant/30 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
                Fill from collection
              </button>
            )}
          </div>
          <ProductList
            rows={curation.products}
            onRemove={removeProduct}
            onTogglePin={togglePin}
            onUploadCustom={uploadCustomImage}
            onClearCustom={clearCustomImage}
            onReorder={(ids) => void reorder(ids)}
            sourceMode={curation.sourceMode}
          />
        </section>

        {error && (
          <p className="font-mono text-xs text-error">{error}</p>
        )}
      </div>

      {searchOpen && (
        <ProductSearchModal
          token={token}
          existingIds={new Set(curation.products.map((p) => p.productId))}
          onPickSingle={(id) => { setSearchOpen(false); void addProduct(id); }}
          onPickMany={(ids) => { setSearchOpen(false); void addProductsBulk(ids); }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

function TextField({ label, value, onBlur }: {
  readonly label: string;
  readonly value: string;
  readonly onBlur: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">{label}</span>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onBlur(local); }}
        className="w-full rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
      />
    </label>
  );
}

interface ProductListProps {
  readonly rows: readonly SectionProductRow[];
  readonly sourceMode: CurationSource;
  readonly onRemove: (id: string) => Promise<void>;
  readonly onTogglePin: (row: SectionProductRow) => Promise<void>;
  readonly onUploadCustom: (row: SectionProductRow, file: File) => Promise<void>;
  readonly onClearCustom: (row: SectionProductRow) => Promise<void>;
  readonly onReorder: (orderedProductIds: string[]) => void;
}

function ProductList({ rows, sourceMode, onRemove, onTogglePin, onUploadCustom, onClearCustom, onReorder }: ProductListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-outline-variant/30 bg-surface-container-low px-4 py-8 text-center">
        <p className="font-body text-xs text-secondary">
          {sourceMode === 'COLLECTION' ? 'Shows products from the linked collection.' : 'No products pinned yet.'}
        </p>
        {sourceMode !== 'COLLECTION' && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
            Click &ldquo;Add product&rdquo; above
          </p>
        )}
      </div>
    );
  }

  const onDrop = () => {
    if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) {
      setDragIndex(null);
      setHoverIndex(null);
      return;
    }
    const next = rows.slice();
    const [moved] = next.splice(dragIndex, 1);
    if (!moved) return;
    next.splice(hoverIndex, 0, moved);
    // Verified against apps/api curation.controller.ts + curation.service.ts:
    // PUT /curation/admin/:pageKey/:sectionKey/reorder expects `orderedProductIds`
    // (DTO: ReorderSectionProductsDto) and the service matches SectionProduct rows
    // via `{ curationId, productId }`. Using productId here is correct.
    onReorder(next.map((r) => r.productId));
    setDragIndex(null);
    setHoverIndex(null);
  };

  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row, i) => (
        <ProductRow
          key={row.id}
          row={row}
          index={i}
          isDragging={dragIndex === i}
          isHoverTarget={hoverIndex === i && dragIndex !== null && dragIndex !== i}
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => { e.preventDefault(); setHoverIndex(i); }}
          onDrop={onDrop}
          onDragEnd={() => { setDragIndex(null); setHoverIndex(null); }}
          onRemove={() => void onRemove(row.id)}
          onTogglePin={() => void onTogglePin(row)}
          onUploadCustom={(file) => void onUploadCustom(row, file)}
          onClearCustom={() => void onClearCustom(row)}
        />
      ))}
    </ul>
  );
}

interface ProductRowProps {
  readonly row: SectionProductRow;
  readonly index: number;
  readonly isDragging: boolean;
  readonly isHoverTarget: boolean;
  readonly onDragStart: () => void;
  readonly onDragOver: (e: React.DragEvent) => void;
  readonly onDrop: () => void;
  readonly onDragEnd: () => void;
  readonly onRemove: () => void;
  readonly onTogglePin: () => void;
  readonly onUploadCustom: (file: File) => void;
  readonly onClearCustom: () => void;
}

function ProductRow({
  row, index, isDragging, isHoverTarget,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onRemove, onTogglePin, onUploadCustom, onClearCustom,
}: ProductRowProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const primaryImage = row.customImage?.publicUrl ?? row.product.images[0] ?? '';
  const stock = row.product.variants.reduce((a, v) => a + v.stock, 0);
  const price = Number(row.product.price).toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-3 rounded-md border bg-surface-container-low p-2 transition ${
        isDragging ? 'opacity-40' : ''
      } ${
        isHoverTarget ? 'border-primary' : 'border-outline-variant/10'
      }`}
    >
      <div className="flex cursor-grab items-center text-secondary">
        <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
        <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded bg-surface">
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primaryImage} alt={row.product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-base">image</span>
          </div>
        )}
        {row.customImage && (
          <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-center font-mono text-[7px] font-bold uppercase tracking-[0.15em] text-on-primary">
            Custom
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-xs font-semibold text-on-surface">{row.product.name}</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">
          BDT {price} · {stock} in stock{row.isPinned ? ' · PINNED' : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          title="Pin to top (Mixed mode)"
          onClick={onTogglePin}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
            row.isPinned ? 'bg-primary/15 text-primary' : 'text-secondary hover:bg-surface-container'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">push_pin</span>
        </button>
        <button
          type="button"
          title="Upload custom thumbnail"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-7 w-7 items-center justify-center rounded-full text-secondary transition hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[14px]">image</span>
        </button>
        {row.customImage && (
          <button
            type="button"
            title="Reset thumbnail"
            onClick={onClearCustom}
            className="flex h-7 w-7 items-center justify-center rounded-full text-secondary transition hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
          </button>
        )}
        <a
          href={`/products?slug=${row.product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Edit product"
          className="flex h-7 w-7 items-center justify-center rounded-full text-secondary transition hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
        </a>
        <button
          type="button"
          title="Remove from section"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-full text-secondary transition hover:bg-error/10 hover:text-error"
        >
          <span className="material-symbols-outlined text-[14px]">delete</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadCustom(f);
            e.target.value = '';
          }}
        />
      </div>
    </li>
  );
}

interface ProductSearchModalProps {
  readonly token: string | undefined;
  readonly existingIds: ReadonlySet<string>;
  readonly onPickSingle: (productId: string) => void;
  readonly onPickMany: (productIds: readonly string[]) => void;
  readonly onClose: () => void;
}

function ProductSearchModal({ token, existingIds, onPickSingle, onPickMany, onClose }: ProductSearchModalProps) {
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
        const res = await fetch(
          `${API}/curation/admin/search?q=${encodeURIComponent(q)}&limit=25`,
          { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal },
        );
        if (!res.ok) throw new Error('Search failed');
        const json = await res.json();
        const data = (json.data ?? json) as ProductSummary[];
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

  const selectAll = () => {
    const pickable = results.filter((p) => !existingIds.has(p.id)).map((p) => p.id);
    setPicked(new Set(pickable));
  };

  const clearAll = () => setPicked(new Set());

  const hasQuery = q.trim().length > 0;
  const pickableCount = results.filter((p) => !existingIds.has(p.id)).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-8 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface-container shadow-2xl"
      >
        {/* Search header */}
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

        {/* Select-all bar */}
        {results.length > 0 && (
          <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low px-4 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
              {!hasQuery ? 'Newly added products' : `${results.length} result${results.length === 1 ? '' : 's'}`}
            </p>
            <div className="flex items-center gap-3">
              {picked.size > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary hover:text-on-surface"
                >
                  Clear ({picked.size})
                </button>
              )}
              <button
                type="button"
                onClick={selectAll}
                disabled={pickableCount === 0}
                className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary hover:opacity-80 disabled:opacity-40"
              >
                Select all {pickableCount}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
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
                const thumb = p.images[0];
                const sku = p.variants[0]?.sku ?? '';
                return (
                  <li key={p.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 p-3 transition ${
                        already ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-container-low'
                      } ${isPicked ? 'bg-primary/5' : ''}`}
                    >
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={isPicked}
                        onChange={() => !already && toggle(p.id)}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-surface">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-secondary">
                            <span className="material-symbols-outlined text-base">image</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body text-sm text-on-surface">{p.name}</p>
                        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-tertiary">
                          {p.category?.slug ?? '—'}{sku ? ` · ${sku}` : ''} · BDT {Number(p.price).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      {already ? (
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-500">In section</span>
                      ) : (
                        !isPicked && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); onPickSingle(p.id); }}
                            className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary hover:opacity-80"
                          >
                            Add only
                          </button>
                        )
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Bulk-add footer */}
        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/10 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
            {picked.size === 0
              ? 'Tick checkboxes to batch-add, or use "Add only" per row'
              : `${picked.size} selected`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:bg-surface-container-low"
            >
              Close
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={() => onPickMany(Array.from(picked))}
              className="rounded-md bg-primary px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary hover:opacity-90 disabled:opacity-40"
            >
              Add {picked.size > 0 ? `${picked.size}` : ''} selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
