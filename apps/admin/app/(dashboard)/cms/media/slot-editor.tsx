'use client';

/**
 * Right-pane editor. Renders upload dropzone + text inputs for the
 * currently selected slot. Changes are postMessage'd to the iframe
 * for live preview before save.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { adminFetch } from '@/lib/api';
import type { PageSlotRecord, SlotHistoryEntry } from './types';
import { formatBytes } from './types';

interface SlotEditorProps {
  readonly slot: PageSlotRecord;
  readonly token: string | undefined;
  readonly iframeRef: RefObject<HTMLIFrameElement | null>;
  readonly onSaved: (updated: PageSlotRecord) => void;
}

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3000';

function postDraft(
  iframe: HTMLIFrameElement | null,
  slotRef: string,
  patch: Record<string, unknown>,
): void {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(
    { type: 'denimisia:slot-draft', slotRef, patch },
    WEB_ORIGIN,
  );
}

export function SlotEditor({ slot, token, iframeRef, onSaved }: SlotEditorProps) {
  const slotRef = `${slot.pageKey}.${slot.slotKey}`;
  const [heading, setHeading]       = useState(slot.heading ?? '');
  const [subheading, setSubheading] = useState(slot.subheading ?? '');
  const [body, setBody]             = useState(slot.body ?? '');
  const [ctaLabel, setCtaLabel]     = useState(slot.ctaLabel ?? '');
  const [ctaHref, setCtaHref]       = useState(slot.ctaHref ?? '');
  const [altText, setAltText]       = useState(slot.altText ?? '');
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [history, setHistory]       = useState<SlotHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isTextOnly = slot.maxBytes === 0;

  useEffect(() => {
    setHeading(slot.heading ?? '');
    setSubheading(slot.subheading ?? '');
    setBody(slot.body ?? '');
    setCtaLabel(slot.ctaLabel ?? '');
    setCtaHref(slot.ctaHref ?? '');
    setAltText(slot.altText ?? '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on slot identity change, not per field edit
  }, [slot.id]);

  const draft = useCallback((patch: Record<string, unknown>) => {
    postDraft(iframeRef.current, slotRef, patch);
  }, [iframeRef, slotRef]);

  const onUploadChange = useCallback(async (file: File | null) => {
    if (!file || !token) return;
    if (file.size > slot.maxBytes) {
      setError(`File is ${formatBytes(file.size)} — max is ${formatBytes(slot.maxBytes)}.`);
      return;
    }
    setUploading(true);
    setError('');

    // Optimistic local-blob preview in the iframe.
    const blobUrl = URL.createObjectURL(file);
    draft({
      mediaUrl: blobUrl,
      mediaKind: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
    });

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/media/admin/upload?page=${slot.pageKey}&slot=${slot.slotKey}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Upload failed: ${res.status}`);
      }
      const json = await res.json();
      const updated = (json.data ?? json) as PageSlotRecord;
      onSaved(updated);
      // Swap draft to the real Supabase URL.
      if (updated.asset) {
        draft({
          mediaUrl: updated.asset.publicUrl,
          mediaKind: updated.asset.kind,
          poster: updated.asset.posterUrl,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Defer revoke so the iframe has time to swap the blob for the real
      // Supabase URL before the blob is invalidated. Without this, the
      // storefront briefly shows a broken image between draft and SSR reload.
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    }
  }, [token, slot.maxBytes, slot.pageKey, slot.slotKey, draft, onSaved]);

  const onSaveText = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const updated = await adminFetch<PageSlotRecord>(
        `/media/admin/slots/${slot.pageKey}/${slot.slotKey}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ heading, subheading, body, ctaLabel, ctaHref, altText }),
        },
      );
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [token, slot.pageKey, slot.slotKey, heading, subheading, body, ctaLabel, ctaHref, altText, onSaved]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await adminFetch<SlotHistoryEntry[]>(`/media/admin/history/${slot.id}`, token);
      setHistory(rows);
      setShowHistory(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'History load failed');
    }
  }, [token, slot.id]);

  const rollback = useCallback(async (historyId: string) => {
    if (!token || !confirm('Restore this version? The current state gets snapshotted first.')) return;
    try {
      const updated = await adminFetch<PageSlotRecord>(
        `/media/admin/rollback/${slot.id}/${historyId}`,
        token,
        { method: 'PUT' },
      );
      onSaved(updated);
      setShowHistory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    }
  }, [token, slot.id, onSaved]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-outline-variant/10 px-6 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
          {slot.pageKey} / {slot.slotKey}
        </p>
        <h2 className="mt-1 font-display text-xl text-on-surface">{slot.label}</h2>
        {!isTextOnly && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
            {slot.specWidth}×{slot.specHeight} · {slot.specAspect} · max {formatBytes(slot.maxBytes)}
            {slot.acceptsVideo ? ' · image or video' : ' · image only'}
          </p>
        )}
      </header>

      {error && (
        <div className="bg-error-container/30 px-6 py-3 font-mono text-xs text-error">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {!isTextOnly && (
          <section>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
              Media
            </p>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                void onUploadChange(f ?? null);
              }}
              className="group relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-outline-variant/30 bg-surface-container-low transition hover:border-primary/60"
            >
              {slot.asset?.publicUrl ? (
                slot.asset.kind === 'VIDEO' ? (
                  <video
                    src={slot.asset.publicUrl}
                    poster={slot.asset.posterUrl ?? undefined}
                    className="h-full w-full object-cover"
                    muted
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.asset.publicUrl} alt={slot.altText ?? ''} className="h-full w-full object-cover" />
                )
              ) : (
                <div className="text-center px-6">
                  <span className="material-symbols-outlined text-4xl text-secondary">cloud_upload</span>
                  <p className="mt-2 font-body text-sm text-secondary">
                    Drop file or click to upload
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
                    {slot.specWidth}×{slot.specHeight} · max {formatBytes(slot.maxBytes)}
                  </p>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
                  <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={slot.acceptsVideo ? 'image/*,video/*' : 'image/*'}
              className="hidden"
              onChange={(e) => { void onUploadChange(e.target.files?.[0] ?? null); }}
            />
            {slot.asset && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
                {slot.asset.width}×{slot.asset.height} · {formatBytes(slot.asset.bytes)} · {slot.asset.mime}
              </p>
            )}
          </section>
        )}

        <section className="space-y-3">
          <TextField label="Heading" value={heading} onChange={(v) => {
            setHeading(v);
            draft({ heading: v });
          }} />
          <TextField label="Subheading" value={subheading} onChange={(v) => {
            setSubheading(v);
            draft({ subheading: v });
          }} />
          <TextAreaField label="Body (HTML)" value={body} onChange={(v) => {
            setBody(v);
            draft({ body: v });
          }} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="CTA label" value={ctaLabel} onChange={(v) => {
              setCtaLabel(v);
              draft({ ctaLabel: v });
            }} />
            <TextField label="CTA link" value={ctaHref} onChange={(v) => {
              setCtaHref(v);
              draft({ ctaHref: v });
            }} />
          </div>
          <TextField label="Alt text" value={altText} onChange={setAltText} />
        </section>

        {showHistory && (
          <section>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
              Version history
            </p>
            <ul className="divide-y divide-outline-variant/10 rounded-md bg-surface-container-low">
              {history.length === 0 ? (
                <li className="px-4 py-3 font-body text-xs text-secondary">No previous versions.</li>
              ) : history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                  {h.asset?.publicUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.asset.publicUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs text-on-surface truncate">{h.heading ?? '(no heading)'}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-tertiary">
                      {new Date(h.replacedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void rollback(h.id)}
                    className="rounded-full border border-outline-variant/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface hover:bg-surface-container"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-outline-variant/10 px-6 py-4">
        <button
          type="button"
          onClick={() => void loadHistory()}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
        >
          History
        </button>
        <button
          type="button"
          onClick={() => void onSaveText()}
          disabled={saving}
          className="rounded-full bg-primary px-6 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
        {label}
      </span>
      <textarea
        value={value}
        rows={5}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
        placeholder="HTML allowed — <p>, <strong>, <em>, <a>, <ul>, <ol>, etc."
      />
    </label>
  );
}
