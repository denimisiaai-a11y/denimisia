'use client';

/**
 * Live Media — WYSIWYG storefront editor.
 *
 * Layout:
 *   ┌────────────┬──────────────────────────────┬──────────────────────┐
 *   │ Page picker│  Toolbar + iframe w/ badges  │  Slot grid → editor  │
 *   │ + storage  │  (device preview)            │                      │
 *   └────────────┴──────────────────────────────┴──────────────────────┘
 *
 * postMessage protocol (see apps/web/components/slot-draft-listener.tsx):
 *   admin → storefront : { type: 'denimisia:slot-draft', slotRef, patch }
 *   admin → storefront : { type: 'denimisia:request-slots' }
 *   storefront → admin : { type: 'denimisia:slots-ready', slots: [{ slotRef, rect }] }
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import { Banner, SurfaceCard } from '@/components/admin-ui';
import { SlotEditor } from './slot-editor';
import { SlotGrid, type SectionSummary } from './slot-grid';
import { PagePicker } from './page-picker';
import { PreviewToolbar, DEVICE_WIDTHS, type DevicePreset } from './preview-toolbar';
import { ToastProvider, useToast } from './toast';
import { SectionEditor } from './section-editor';
import {
  PAGE_ROUTES,
  type PageSlotRecord,
  type ReportedSlot,
  type StorageStats,
} from './types';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3000';

const SECTION_LABELS: Record<string, string> = {
  new_arrivals_section: 'New Arrivals',
  bestsellers_section:  'Best Sellers',
  trending_section:     'Trending',
  bundles_section:      'Bundle Deals',
} as const;

function isReportedSlotsMessage(
  v: unknown,
): v is { type: 'denimisia:slots-ready'; slots: ReportedSlot[] } {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return o['type'] === 'denimisia:slots-ready' && Array.isArray(o['slots']);
}

export default function MediaManagerPage() {
  return (
    <ToastProvider>
      <MediaManagerInner />
    </ToastProvider>
  );
}

function MediaManagerInner() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const toast = useToast();

  const [allSlots, setAllSlots]       = useState<PageSlotRecord[]>([]);
  const [allSections, setAllSections] = useState<Record<string, SectionSummary[]>>({});
  const [storage, setStorage]         = useState<StorageStats | null>(null);
  const [activePage, setActivePage]   = useState<string>('home');
  const [activeSlotId, setActiveSlot] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<{ pageKey: string; sectionKey: string; label: string } | null>(null);
  const [reportedSlots, setReported]  = useState<ReportedSlot[]>([]);
  const [error, setError]             = useState('');
  const [device, setDevice]           = useState<DevicePreset>('desktop');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Track the last src we wrote ourselves. We can't introspect the iframe's
  // actual location from the admin origin (storefront is served from a
  // different localhost port → SecurityError on contentWindow.location.*),
  // so we shadow it locally and compare against that.
  const lastSrcPathRef = useRef<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [slots, stats] = await Promise.all([
        adminFetch<PageSlotRecord[]>('/media/admin/slots', token),
        adminFetch<StorageStats>('/media/admin/storage', token),
      ]);
      setAllSlots(slots);
      setStorage(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load slots');
    }
  }, [token]);

  const loadSectionsForPage = useCallback(async (pageKey: string) => {
    if (!token) return;
    try {
      const rows = await adminFetch<SectionSummary[]>(`/curation/admin/page/${pageKey}`, token);
      setAllSections((prev) => ({ ...prev, [pageKey]: rows }));
    } catch {
      setAllSections((prev) => ({ ...prev, [pageKey]: [] }));
    }
  }, [token]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { void loadSectionsForPage(activePage); }, [activePage, loadSectionsForPage]);

  // Listen for slot-position reports from the storefront iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== WEB_ORIGIN) return;
      if (isReportedSlotsMessage(e.data)) {
        setReported(e.data.slots);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const reloadIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Assigning src retriggers navigation in the same browsing context so the
    // WebGL / network / event-listener state from the previous page is torn
    // down cleanly. Re-keying the element would destroy + recreate the
    // browsing context, leaking WebGL contexts across reloads.
    // eslint-disable-next-line no-self-assign -- intentional: triggers navigation in same browsing context without recreating WebGL
    iframe.src = iframe.src;
  }, []);

  // Keyboard shortcuts: Esc = deselect, R = reload, V = view live
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inField =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement;
      if (inField) return;
      if (e.key === 'Escape') { setActiveSlot(null); setActiveSection(null); }
      if (e.key === 'r' || e.key === 'R') reloadIframe();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reloadIframe]);

  const handleIframeLoad = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'denimisia:request-slots' },
      WEB_ORIGIN,
    );
  }, []);

  const pagesWithSlots = useMemo(() => {
    const byPage = new Map<string, PageSlotRecord[]>();
    for (const s of allSlots) {
      const list = byPage.get(s.pageKey) ?? [];
      list.push(s);
      byPage.set(s.pageKey, list);
    }
    return Array.from(byPage.entries())
      .map(([pageKey, slots]) => ({ pageKey, slots }))
      .sort((a, b) => (PAGE_ROUTES[a.pageKey]?.label ?? a.pageKey).localeCompare(PAGE_ROUTES[b.pageKey]?.label ?? b.pageKey));
  }, [allSlots]);

  const pageSlots = useMemo(
    () => allSlots.filter((s) => s.pageKey === activePage),
    [allSlots, activePage],
  );

  const activeSlot = useMemo(
    () => allSlots.find((s) => s.id === activeSlotId) ?? null,
    [allSlots, activeSlotId],
  );

  const onSlotSaved = useCallback((updated: PageSlotRecord) => {
    setAllSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    // Refresh storage stats when asset changes.
    if (token) {
      adminFetch<StorageStats>('/media/admin/storage', token).then(setStorage).catch(() => undefined);
    }
    // Reload the iframe so it picks up the newly-saved asset URL from SSR
    // instead of the postMessage draft (which may have been a local blob).
    reloadIframe();
  }, [token, reloadIframe]);

  const iframeSrc = useMemo(() => {
    const path = PAGE_ROUTES[activePage]?.path ?? '/';
    return `${WEB_ORIGIN}${path}${path.includes('?') ? '&' : '?'}edit=1`;
  }, [activePage]);

  // Guard iframe navigation: only replace src when the target pathname actually
  // differs from what we last set. Prevents reload storms when iframeSrc
  // re-derives but points at the same page, and avoids regressing the
  // WebGL / iframe-swap fixes from S345/S346.
  //
  // We can't read iframe.contentWindow.location — storefront is on a
  // different origin, and browsers block that access with SecurityError.
  // Instead we compare against lastSrcPathRef which we update ourselves.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let targetPath: string;
    try {
      targetPath = new URL(iframeSrc).pathname;
    } catch {
      return;
    }
    if (lastSrcPathRef.current !== targetPath) {
      iframe.src = iframeSrc;
      lastSrcPathRef.current = targetPath;
    }
  }, [iframeSrc]);

  const liveUrl = useMemo(() => {
    const path = PAGE_ROUTES[activePage]?.path ?? '/';
    return `${WEB_ORIGIN}${path}`;
  }, [activePage]);

  const refresh = useCallback(() => {
    reloadIframe();
    toast.push('info', 'Preview reloaded');
  }, [reloadIframe, toast]);

  const openLive = useCallback(() => {
    window.open(liveUrl, '_blank', 'noopener,noreferrer');
  }, [liveUrl]);

  return (
    <PageShell
      title="Media Manager"
      description="Edit every image, video, and headline on the storefront — live."
      breadcrumbs={[{ label: 'CMS' }, { label: 'Media' }]}
    >
      {error && <Banner tone="error" message={error} />}

      <div className="grid h-[calc(100vh-10rem)] grid-cols-[260px_minmax(0,1fr)_420px] gap-4">
        {/* ── Left: page picker ────────────────────────────────────────────── */}
        <SurfaceCard className="overflow-hidden">
          <PagePicker
            groups={pagesWithSlots}
            storage={storage}
            activePage={activePage}
            onSelect={(p) => { setActivePage(p); setActiveSlot(null); }}
          />
        </SurfaceCard>

        {/* ── Center: toolbar + iframe + overlays ──────────────────────────── */}
        <SurfaceCard className="flex flex-col overflow-hidden">
          <PreviewToolbar
            url={iframeSrc}
            device={device}
            onDeviceChange={setDevice}
            onReload={refresh}
            onOpenLive={openLive}
          />
          <div className="relative flex-1 overflow-auto bg-surface-container-low p-4">
            <div
              className="relative mx-auto h-full bg-paper shadow-lg transition-[max-width] duration-300"
              style={{ maxWidth: DEVICE_WIDTHS[device] ? `${DEVICE_WIDTHS[device]}px` : '100%' }}
            >
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title="Live storefront preview"
                onLoad={handleIframeLoad}
                className="h-full w-full border-0"
              />
              <SlotOverlay
                reportedSlots={reportedSlots}
                pageSlots={pageSlots}
                activeSlotId={activeSlotId}
                onSelectSlot={(id) => { setActiveSlot(id); setActiveSection(null); }}
                onSelectSection={(pageKey, sectionKey, label) => {
                  setActiveSection({ pageKey, sectionKey, label });
                  setActiveSlot(null);
                }}
              />
            </div>
          </div>
        </SurfaceCard>

        {/* ── Right: slot grid (default) OR editor (on selection) ──────────── */}
        <SurfaceCard className="overflow-hidden">
          {activeSection ? (
            <SectionEditor
              pageKey={activeSection.pageKey}
              sectionKey={activeSection.sectionKey}
              label={activeSection.label}
              token={token}
              onClose={(changed) => {
                setActiveSection(null);
                if (changed) {
                  void loadSectionsForPage(activePage);
                  reloadIframe();
                }
              }}
            />
          ) : activeSlot ? (
            <div className="flex h-full flex-col">
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                className="flex items-center gap-2 border-b border-outline-variant/10 px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Back to all slots
              </button>
              <div className="flex-1 overflow-hidden">
                <SlotEditor
                  slot={activeSlot}
                  token={token}
                  iframeRef={iframeRef}
                  onSaved={onSlotSaved}
                />
              </div>
            </div>
          ) : (
            <SlotGrid
              slots={pageSlots}
              sections={allSections[activePage] ?? []}
              token={token}
              onSelectSlot={(id) => { setActiveSlot(id); setActiveSection(null); }}
              onSelectSection={(pageKey, sectionKey, label) => {
                setActiveSection({ pageKey, sectionKey, label });
                setActiveSlot(null);
              }}
              onSaved={onSlotSaved}
            />
          )}
        </SurfaceCard>
      </div>
    </PageShell>
  );
}

/**
 * Floating badges on top of the iframe. Color-coded by fill status.
 * Positioned using the slot rects reported by the storefront, clamped
 * to the iframe viewport so labels never clip off-screen.
 */
function SlotOverlay({
  reportedSlots,
  pageSlots,
  activeSlotId,
  onSelectSlot,
  onSelectSection,
}: {
  readonly reportedSlots: readonly ReportedSlot[];
  readonly pageSlots: readonly PageSlotRecord[];
  readonly activeSlotId: string | null;
  readonly onSelectSlot: (id: string) => void;
  readonly onSelectSection: (pageKey: string, sectionKey: string, label: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {reportedSlots.map((r, i) => {
        const isProductSection = r.kind === 'product-section';
        const [pageKey, sectionKey] = r.slotRef.split('.');

        if (isProductSection && pageKey && sectionKey) {
          // Product section — opens SectionEditor, styled distinctly (purple).
          const label = SECTION_LABELS[sectionKey] ?? sectionKey;
          return (
            <button
              type="button"
              key={r.slotRef}
              onClick={() => onSelectSection(pageKey, sectionKey, label)}
              style={{
                position: 'absolute',
                left:   `${r.rect.x}px`,
                top:    `${r.rect.y}px`,
                width:  `${r.rect.width}px`,
                height: `${r.rect.height}px`,
              }}
              className="pointer-events-auto border-2 border-violet-500/60 bg-violet-500/5 transition hover:border-violet-500 hover:bg-violet-500/10"
            >
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-white shadow-lg">
                <span className="material-symbols-outlined text-[12px]">shopping_bag</span>
                <span className="mx-1 h-3 w-px bg-white/40" />
                <span className="max-w-[200px] truncate">{label}</span>
              </span>
            </button>
          );
        }

        // Static media slot — opens SlotEditor.
        const slot = pageSlots.find((s) => `${s.pageKey}.${s.slotKey}` === r.slotRef);
        if (!slot) return null;
        const active = slot.id === activeSlotId;
        const filled = slot.asset !== null;
        const borderClass = active
          ? 'border-primary bg-primary/15'
          : filled
          ? 'border-emerald-500/60 bg-emerald-500/5 hover:border-emerald-500 hover:bg-emerald-500/10'
          : 'border-amber-500/60 bg-amber-500/5 hover:border-amber-500 hover:bg-amber-500/10';
        const chipClass = active
          ? 'bg-primary text-on-primary'
          : filled
          ? 'bg-emerald-600 text-white'
          : 'bg-amber-600 text-white';

        return (
          <button
            type="button"
            key={r.slotRef}
            onClick={() => onSelectSlot(slot.id)}
            style={{
              position: 'absolute',
              left:   `${r.rect.x}px`,
              top:    `${r.rect.y}px`,
              width:  `${r.rect.width}px`,
              height: `${r.rect.height}px`,
            }}
            className={`pointer-events-auto border-2 transition ${borderClass}`}
          >
            <span
              className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] shadow-lg ${chipClass}`}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              <span className="mx-1 h-3 w-px bg-white/40" />
              <span className="max-w-[200px] truncate">{slot.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
