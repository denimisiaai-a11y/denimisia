'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';
import {
  type HomepageSection,
  type HomepageSectionType,
  type GlobalStorefrontStyles,
  type AuditLogEntry,
  SECTION_TYPE_META,
  HAS_CONFIG_FIELDS,
} from './section-types';
import { InsertSectionModal } from './insert-section-modal';
import { SectionConfigForm } from './section-config-form';
import { GlobalStylesPanel } from './global-styles-panel';
import { RecentHistoryPanel } from './recent-history-panel';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3000';
const CMS_AUDIT_ACTION_PREFIX = 'cms.';

export default function CmsHubPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [sections, setSections]   = useState<HomepageSection[]>([]);
  const [styles, setStyles]       = useState<GlobalStorefrontStyles | null>(null);
  const [history, setHistory]     = useState<AuditLogEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [insertOpen, setInsertOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [sectionsRes, stylesRes, auditRes] = await Promise.all([
        adminFetch<HomepageSection[]>('/cms/homepage/sections', token),
        adminFetch<GlobalStorefrontStyles>('/cms/homepage/styles'),
        adminFetch<{ items: AuditLogEntry[] }>(
          '/audit-log?limit=20',
          token,
        ).catch(() => ({ items: [] })),
      ]);
      setSections(sectionsRes);
      setStyles(stylesRes);
      // Filter to CMS-related events on the client (the audit endpoint
      // doesn't support an action-prefix filter, so we slice client-side).
      const cmsEntries = auditRes.items
        .filter((e) => e.action.startsWith(CMS_AUDIT_ACTION_PREFIX))
        .slice(0, 5);
      setHistory(cmsEntries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load CMS hub');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleInsert = async (type: HomepageSectionType) => {
    if (!token) return;
    const config = SECTION_TYPE_META[type].defaultConfig;
    const created = await adminFetch<HomepageSection>(
      '/cms/homepage/sections',
      token,
      { method: 'POST', body: JSON.stringify({ type, config }) },
    );
    setSections((prev) => [...prev, created]);
    void refreshHistory();
  };

  const refreshHistory = useCallback(async () => {
    if (!token) return;
    try {
      const auditRes = await adminFetch<{ items: AuditLogEntry[] }>(
        '/audit-log?limit=20',
        token,
      );
      const cmsEntries = auditRes.items
        .filter((e) => e.action.startsWith(CMS_AUDIT_ACTION_PREFIX))
        .slice(0, 5);
      setHistory(cmsEntries);
    } catch {
      // Silent — history is a "nice to have" panel.
    }
  }, [token]);

  const handleToggleActive = async (section: HomepageSection) => {
    if (!token) return;
    const next = { ...section, isActive: !section.isActive };
    setSections((prev) => prev.map((s) => (s.id === section.id ? next : s)));
    try {
      await adminFetch<HomepageSection>(
        `/cms/homepage/sections/${section.id}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ isActive: next.isActive }) },
      );
      void refreshHistory();
    } catch (err) {
      // Roll back optimistic update
      setSections((prev) => prev.map((s) => (s.id === section.id ? section : s)));
      setError(err instanceof Error ? err.message : 'Failed to toggle section');
    }
  };

  const handleDelete = async (section: HomepageSection) => {
    if (!token) return;
    if (!confirm(`Delete this ${SECTION_TYPE_META[section.type].label} section?`)) return;
    const prev = sections;
    setSections((s) => s.filter((row) => row.id !== section.id));
    try {
      await adminFetch(
        `/cms/homepage/sections/${section.id}`,
        token,
        { method: 'DELETE' },
      );
      void refreshHistory();
    } catch (err) {
      setSections(prev);
      setError(err instanceof Error ? err.message : 'Failed to delete section');
    }
  };

  const handleMove = async (section: HomepageSection, direction: -1 | 1) => {
    if (!token) return;
    const sorted = [...sections].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((s) => s.id === section.id);
    const newIdx = idx + direction;
    if (idx === -1 || newIdx < 0 || newIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[newIdx];
    if (!a || !b) return;
    sorted[idx] = b;
    sorted[newIdx] = a;
    const reordered = sorted.map((s, i) => ({ ...s, position: i }));
    setSections(reordered);
    try {
      await adminFetch(
        '/cms/homepage/sections/reorder',
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            orders: reordered.map((s) => ({ id: s.id, position: s.position })),
          }),
        },
      );
      void refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
      void refresh();
    }
  };

  const handleSaveConfig = async (
    sectionId: string,
    nextConfig: Record<string, unknown>,
  ) => {
    if (!token) return;
    const updated = await adminFetch<HomepageSection>(
      `/cms/homepage/sections/${sectionId}`,
      token,
      { method: 'PATCH', body: JSON.stringify({ config: nextConfig }) },
    );
    setSections((prev) => prev.map((s) => (s.id === sectionId ? updated : s)));
    setEditingId(null);
    void refreshHistory();
  };

  const editingSection = useMemo(
    () => sections.find((s) => s.id === editingId) ?? null,
    [sections, editingId],
  );

  const sortedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections],
  );
  const activeCount = sortedSections.filter((s) => s.isActive).length;

  return (
    <div className="max-w-6xl mx-auto p-12">
      {/* Header */}
      <div className="flex items-end justify-between mb-16">
        <div className="space-y-2">
          <span className="text-primary font-semibold tracking-widest text-[10px] uppercase">
            Storefront Management
          </span>
          <h2 className="text-4xl font-headline font-semibold tracking-[0.1em] text-on-surface uppercase">
            Homepage Sections
          </h2>
          <p className="text-secondary text-sm max-w-md font-light leading-relaxed">
            Customise the layout and visibility of your storefront home page.
            Changes go live immediately.
          </p>
        </div>
        <div className="flex gap-4">
          <a
            href={WEB_ORIGIN}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-outline-variant/30 text-on-surface text-[11px] font-bold tracking-widest uppercase hover:bg-surface-container transition-colors"
          >
            Preview Store
          </a>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="px-6 py-3 bg-inverse-surface text-inverse-on-surface text-[11px] font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <Banner tone="error" message={error} />
        </div>
      )}

      {/* Sections list */}
      <div className="space-y-4 mb-8">
        {loading && sortedSections.length === 0 ? (
          <div className="text-secondary text-xs uppercase tracking-widest py-12 text-center">
            Loading sections…
          </div>
        ) : sortedSections.length === 0 ? (
          <div className="border border-outline-variant/10 p-12 text-center">
            <p className="text-sm text-on-surface">No homepage sections yet.</p>
            <p className="mt-2 text-xs uppercase tracking-widest text-secondary">
              Click &quot;Insert section&quot; below to add one.
            </p>
          </div>
        ) : (
          sortedSections.map((section, i) => {
            const meta = SECTION_TYPE_META[section.type];
            const isFirst = i === 0;
            const isLast = i === sortedSections.length - 1;
            return (
              <div
                key={section.id}
                className={`group border p-6 flex items-center gap-6 transition-all duration-300 ${
                  section.isActive
                    ? 'bg-surface-container-lowest border-outline-variant/10 hover:border-outline-variant/40'
                    : 'bg-surface-container-low border-outline-variant/10 opacity-60'
                }`}
              >
                {/* Reorder buttons */}
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={() => void handleMove(section, -1)}
                    aria-label="Move up"
                    className="flex h-6 w-6 items-center justify-center border border-outline-variant/30 text-secondary hover:text-on-surface hover:bg-surface-container disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden>
                      keyboard_arrow_up
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => void handleMove(section, 1)}
                    aria-label="Move down"
                    className="flex h-6 w-6 items-center justify-center border border-outline-variant/30 text-secondary hover:text-on-surface hover:bg-surface-container disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden>
                      keyboard_arrow_down
                    </span>
                  </button>
                </div>

                {/* Icon */}
                <div className="w-20 h-20 bg-surface-container overflow-hidden rounded-sm flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary/60 text-3xl">
                    {meta.icon}
                  </span>
                </div>

                {/* Label + summary */}
                <div className="flex-1 min-w-0">
                  <h4
                    className={`font-headline text-lg font-semibold tracking-wide uppercase ${
                      section.isActive ? 'text-on-surface' : 'text-secondary'
                    }`}
                  >
                    {i + 1}. {meta.label}
                  </h4>
                  <p className="text-secondary text-xs mt-1 truncate">
                    {sectionSummary(section)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-6 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(section)}
                    aria-pressed={section.isActive}
                    className="flex items-center gap-3"
                  >
                    <span className="text-[10px] font-bold tracking-tighter uppercase text-secondary">
                      {section.isActive ? 'Visible' : 'Hidden'}
                    </span>
                    <div
                      aria-hidden
                      className={`w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${
                        section.isActive ? 'bg-primary' : 'bg-surface-container-high'
                      }`}
                    >
                      <div
                        className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${
                          section.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </button>

                  {HAS_CONFIG_FIELDS.has(section.type) ? (
                    <button
                      type="button"
                      onClick={() => setEditingId(section.id)}
                      className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-on-surface hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden>edit</span>
                      Edit
                    </button>
                  ) : meta.contentEditor ? (
                    <Link
                      href={meta.contentEditor}
                      className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-on-surface hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden>open_in_new</span>
                      Edit content
                    </Link>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleDelete(section)}
                    aria-label="Delete section"
                    className="flex h-7 w-7 items-center justify-center text-secondary hover:text-[#c62828]"
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden>
                      delete
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Insert placeholder */}
        <button
          type="button"
          onClick={() => setInsertOpen(true)}
          className="w-full border-2 border-dashed border-outline-variant/30 py-12 flex flex-col items-center justify-center gap-4 text-secondary hover:text-primary hover:border-primary/50 transition-all group bg-surface/30"
        >
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined">add</span>
          </div>
          <span className="font-headline text-xs font-bold tracking-widest uppercase">
            Insert Section
          </span>
        </button>
      </div>

      {/* Bottom panels */}
      <div className="mt-20 grid grid-cols-3 gap-8">
        {styles && (
          <GlobalStylesPanel
            styles={styles}
            token={token}
            onUpdated={setStyles}
          />
        )}
        <RecentHistoryPanel entries={history} />
        <div className="bg-surface-container-low p-8 border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary">visibility</span>
            <h5 className="font-headline text-sm font-bold tracking-widest uppercase">
              Live Status
            </h5>
          </div>
          <p className="text-secondary text-[11px] leading-relaxed">
            {sortedSections.length === 0
              ? 'No sections configured yet.'
              : `${activeCount} of ${sortedSections.length} sections currently visible on the storefront.`}
          </p>
          <p className="mt-3 text-secondary text-[10px] leading-relaxed">
            Changes go live immediately on every save. The storefront caches
            section data for 30 seconds, so refresh the public site if you
            don&apos;t see your edit right away.
          </p>
        </div>
      </div>

      <InsertSectionModal
        open={insertOpen}
        onClose={() => setInsertOpen(false)}
        onPick={handleInsert}
      />

      {/* Config editor modal */}
      {editingSection && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setEditingId(null)}
        >
          <div
            className="atelier-shadow w-full max-w-xl bg-surface-container-lowest"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
                Edit · {SECTION_TYPE_META[editingSection.type].label}
              </div>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="p-6">
              <SectionConfigForm
                type={editingSection.type}
                initial={editingSection.config}
                onSubmit={(c) => handleSaveConfig(editingSection.id, c)}
                onCancel={() => setEditingId(null)}
              />
              {SECTION_TYPE_META[editingSection.type].contentEditor && (
                <p className="mt-6 border-t border-outline-variant/15 pt-4 text-[10px] uppercase tracking-[0.18em] text-secondary">
                  Section visuals are managed in{' '}
                  <Link
                    href={SECTION_TYPE_META[editingSection.type].contentEditor!}
                    className="underline hover:text-on-surface"
                  >
                    {SECTION_TYPE_META[editingSection.type].contentEditor!.replace(
                      '/cms/',
                      'CMS → ',
                    )}
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function sectionSummary(section: HomepageSection): string {
  const meta = SECTION_TYPE_META[section.type];
  if (!HAS_CONFIG_FIELDS.has(section.type)) {
    return meta.description;
  }
  const parts: string[] = [];
  const cfg = section.config;
  if (typeof cfg.title === 'string') parts.push(`"${cfg.title}"`);
  if (typeof cfg.limit === 'number') parts.push(`up to ${cfg.limit}`);
  if (typeof cfg.slotGroupKey === 'string') parts.push(`slots: ${cfg.slotGroupKey}`);
  if (typeof cfg.collectionSlug === 'string') parts.push(`collection: ${cfg.collectionSlug}`);
  return parts.length > 0 ? parts.join(' · ') : meta.description;
}
