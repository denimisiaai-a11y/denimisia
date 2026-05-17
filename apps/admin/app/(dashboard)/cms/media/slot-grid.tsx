'use client';

/**
 * Right-pane grid — shows EVERY editable surface on the current page:
 *   - Media slots (page_slot records)      ← upload / edit
 *   - Product sections (section_curation)  ← curate merchandising
 *
 * Workers see both kinds as cards with clear visible actions. No hover-only
 * controls; everything is obvious at a glance.
 */

import { useCallback, useRef, useState } from 'react';
import type { PageSlotRecord } from './types';
import { formatBytes } from './types';
import { useToast } from './toast';

export interface SectionSummary {
  readonly id: string;
  readonly pageKey: string;
  readonly sectionKey: string;
  readonly label: string;
  readonly sourceMode: 'COLLECTION' | 'MANUAL' | 'MIXED';
  readonly maxItems: number;
  readonly isActive: boolean;
  readonly collection: { readonly id: string; readonly name: string; readonly slug: string } | null;
  readonly _count: { readonly products: number };
  readonly products: readonly {
    readonly product: { readonly images: readonly string[]; readonly name: string };
    readonly customImage: { readonly publicUrl: string } | null;
  }[];
}

interface SlotGridProps {
  readonly slots: readonly PageSlotRecord[];
  readonly sections: readonly SectionSummary[];
  readonly token: string | undefined;
  readonly onSelectSlot: (slotId: string) => void;
  readonly onSelectSection: (pageKey: string, sectionKey: string, label: string) => void;
  readonly onSaved: (slot: PageSlotRecord) => void;
}

export function SlotGrid({ slots, sections, token, onSelectSlot, onSelectSection, onSaved }: SlotGridProps) {
  const filledMedia = slots.filter((s) => s.asset).length;
  const totalMedia  = slots.filter((s) => s.maxBytes > 0).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-outline-variant/10 px-6 py-4">
        <h2 className="font-display text-xl text-on-surface">Edit this page</h2>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
          {sections.length > 0 && <>{sections.length} product section{sections.length === 1 ? '' : 's'} · </>}
          {filledMedia}/{totalMedia} media filled
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {sections.length > 0 && (
          <section>
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-violet-500">
              <span className="material-symbols-outlined text-[14px]">shopping_bag</span>
              Product sections
            </p>
            <div className="space-y-2">
              {sections.map((sec) => (
                <SectionCard
                  key={sec.id}
                  section={sec}
                  onOpen={() => onSelectSection(sec.pageKey, sec.sectionKey, sec.label)}
                />
              ))}
            </div>
          </section>
        )}

        {slots.length > 0 && (
          <section>
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
              <span className="material-symbols-outlined text-[14px]">photo_library</span>
              Media slots
            </p>
            <div className="grid grid-cols-2 gap-3">
              {slots.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  token={token}
                  onSelect={() => onSelectSlot(slot.id)}
                  onSaved={onSaved}
                />
              ))}
            </div>
          </section>
        )}

        {sections.length === 0 && slots.length === 0 && (
          <div className="mt-10 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary">dashboard</span>
            <p className="mt-3 font-body text-sm text-secondary">No editable content on this page.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Product-section card ───────────────────────────────────────────────────

interface SectionCardProps {
  readonly section: SectionSummary;
  readonly onOpen: () => void;
}

function SectionCard({ section, onOpen }: SectionCardProps) {
  const count = section._count.products;
  const previews = section.products.slice(0, 4);

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(); }}
      className="group cursor-pointer overflow-hidden rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-950/20 to-surface-container-low p-3 transition hover:border-violet-500/60 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-600 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em] text-white">
              Product section
            </span>
            <span className={`rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em] ${
              section.sourceMode === 'COLLECTION' ? 'bg-emerald-600 text-white'
              : section.sourceMode === 'MIXED'    ? 'bg-amber-600 text-white'
              : 'bg-slate-600 text-white'
            }`}>
              {section.sourceMode}
            </span>
            {!section.isActive && (
              <span className="rounded-full bg-rose-600 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em] text-white">
                Hidden
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-base text-on-surface">{section.label}</h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
            {count} product{count === 1 ? '' : 's'}
            {section.collection && ` · from ${section.collection.name}`}
            {' · max ' + section.maxItems}
          </p>
        </div>
        <span className="material-symbols-outlined text-violet-500 transition group-hover:translate-x-0.5">
          arrow_forward
        </span>
      </div>

      {previews.length > 0 && (
        <div className="mt-3 flex gap-1.5">
          {previews.map((p, i) => {
            const img = p.customImage?.publicUrl ?? p.product.images[0] ?? '';
            return (
              <div key={i} className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-surface">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={p.product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-base">image</span>
                  </div>
                )}
              </div>
            );
          })}
          {count > previews.length && (
            <div className="flex h-12 items-center px-2 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
              +{count - previews.length}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="flex-1 rounded-full bg-violet-600 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition hover:bg-violet-500"
        >
          Manage products
        </button>
      </div>
    </div>
  );
}

// ─── Media-slot card ────────────────────────────────────────────────────────

interface SlotCardProps {
  readonly slot: PageSlotRecord;
  readonly token: string | undefined;
  readonly onSelect: () => void;
  readonly onSaved: (slot: PageSlotRecord) => void;
}

function SlotCard({ slot, token, onSelect, onSaved }: SlotCardProps) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isTextOnly = slot.maxBytes === 0;
  const hasAsset = slot.asset !== null;

  const upload = useCallback(async (file: File | null) => {
    if (!file || !token || isTextOnly) return;
    if (file.size > slot.maxBytes) {
      toast.push('error', `${file.name} is ${formatBytes(file.size)} — max ${formatBytes(slot.maxBytes)}`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/media/admin/upload?page=${slot.pageKey}&slot=${slot.slotKey}`;
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
      const updated = (json.data ?? json) as PageSlotRecord;
      onSaved(updated);
      toast.push('success', `Uploaded to ${slot.label}`);
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [token, slot.pageKey, slot.slotKey, slot.maxBytes, slot.label, isTextOnly, onSaved, toast]);

  return (
    <div
      onDragOver={(e) => {
        if (isTextOnly) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void upload(e.dataTransfer.files[0] ?? null);
      }}
      className={`group relative overflow-hidden rounded-md border bg-surface-container-low transition ${
        dragOver
          ? 'border-primary bg-primary/10'
          : hasAsset
          ? 'border-emerald-500/30'
          : isTextOnly
          ? 'border-outline-variant/20'
          : 'border-amber-500/30'
      }`}
    >
      <div className="relative aspect-[4/3] w-full bg-surface">
        {slot.asset?.publicUrl ? (
          slot.asset.kind === 'VIDEO' ? (
            <video
              src={slot.asset.publicUrl}
              poster={slot.asset.posterUrl ?? undefined}
              muted
              className="h-full w-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slot.asset.publicUrl} alt={slot.altText ?? ''} className="h-full w-full object-cover" />
          )
        ) : isTextOnly ? (
          <div className="flex h-full w-full flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-2xl text-secondary">edit_note</span>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-secondary">Text only</p>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-2xl text-amber-500">cloud_upload</span>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-secondary">
              Drop file or click Upload
            </p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          </div>
        )}
        <div className={`absolute left-1 top-1 rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em] ${
          hasAsset
            ? 'bg-emerald-500/90 text-white'
            : isTextOnly
            ? 'bg-surface-container text-secondary'
            : 'bg-amber-500/90 text-white'
        }`}>
          {hasAsset ? (slot.asset?.kind === 'VIDEO' ? 'Video' : 'Image') : isTextOnly ? 'Text' : 'Empty'}
        </div>
      </div>
      <div className="p-2">
        <p className="truncate font-body text-xs font-semibold text-on-surface">{slot.label}</p>
        {!isTextOnly && (
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-tertiary">
            {slot.specWidth}×{slot.specHeight} · {formatBytes(slot.maxBytes)}
          </p>
        )}
      </div>
      {/* Always-visible primary actions */}
      <div className="flex gap-1 border-t border-outline-variant/10 p-1.5">
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 rounded-sm bg-surface-container px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-on-surface hover:bg-surface-container-high"
        >
          {isTextOnly ? 'Edit' : hasAsset ? 'Edit' : 'Edit + Text'}
        </button>
        {!isTextOnly && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 rounded-sm bg-primary px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-on-primary hover:opacity-90"
          >
            {hasAsset ? 'Replace' : 'Upload'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={slot.acceptsVideo ? 'image/*,video/*' : 'image/*'}
        className="hidden"
        onChange={(e) => { void upload(e.target.files?.[0] ?? null); }}
      />
    </div>
  );
}
