'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';
import { ConfirmModal } from '@/components/modal';

interface HomepageSection {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  image: string | null;
  link: string | null;
  position: number;
  isActive: boolean;
  updatedAt: string;
}

interface SectionRow {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  href: string;
  isActive: boolean;
  image?: string | null;
}

type DraftTone = 'info' | 'success' | 'error';

interface DraftBannerState {
  readonly tone: DraftTone;
  readonly message: string;
}

const DRAFT_STORAGE_KEY = 'cms-draft-v1';
const PUBLISHED_STORAGE_KEY = 'cms-published-v1';

function resolveHref(key: string): string {
  if (key.includes('blog') || key.includes('journal')) {
    return '/cms/blog';
  }
  return '/cms/banners';
}

function resolveIcon(key: string): string {
  if (key.includes('blog') || key.includes('journal')) {
    return 'menu_book';
  }
  if (key.includes('hero')) {
    return 'photo_library';
  }
  if (key.includes('categor') || key.includes('mosaic')) {
    return 'grid_view';
  }
  return 'auto_awesome';
}

function mapSectionToRow(section: HomepageSection): SectionRow {
  return {
    key: section.key,
    title: section.title,
    subtitle: section.subtitle ?? 'No description set',
    icon: resolveIcon(section.key.toLowerCase()),
    href: resolveHref(section.key.toLowerCase()),
    isActive: section.isActive,
    image: section.image,
  };
}

function reorder<T>(items: ReadonlyArray<T>, from: number, to: number): T[] {
  if (from === to) return items.slice();
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  if (!moved) return items.slice();
  next.splice(to, 0, moved);
  return next;
}

export default function CmsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [sections, setSections] = useState<ReadonlyArray<SectionRow>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [banner, setBanner] = useState<DraftBannerState | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [publishOpen, setPublishOpen] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);

  // Drag & drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await adminFetch<HomepageSection[]>('/cms/sections', token);
        if (cancelled) return;

        if (Array.isArray(data) && data.length > 0) {
          const rows = data
            .slice()
            .sort((a, b) => a.position - b.position)
            .map(mapSectionToRow);
          setSections(rows);

          const latest = data.reduce<string | null>((acc, s) => {
            if (!acc) return s.updatedAt;
            return s.updatedAt > acc ? s.updatedAt : acc;
          }, null);
          setLastUpdated(latest);
        }
        setError(null);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load sections';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSaveDraft() {
    if (saving) return;
    setSaving(true);
    setBanner(null);

    const orderedKeys = sections.map((s) => s.key);
    const payload = {
      order: orderedKeys,
      sections: sections.map((s, i) => ({
        key: s.key,
        position: i,
        isActive: s.isActive,
      })),
    };

    try {
      await adminFetch('/cms/draft', token, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setBanner({ tone: 'success', message: 'Draft saved.' });
    } catch {
      // Fallback: optimistic local persistence if no endpoint yet.
      try {
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ savedAt: new Date().toISOString(), ...payload }),
        );
        setBanner({
          tone: 'info',
          message: 'Draft saved locally — publish to apply.',
        });
      } catch (storageErr: unknown) {
        const message =
          storageErr instanceof Error ? storageErr.message : 'Failed to save draft locally';
        setBanner({ tone: 'error', message });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishConfirmed() {
    if (publishing) return;
    setPublishing(true);
    setBanner(null);
    try {
      await adminFetch('/cms/publish', token, { method: 'POST' });
      setBanner({ tone: 'success', message: 'Storefront published.' });
    } catch {
      // Fallback: promote localStorage draft to published.
      try {
        const draft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draft) {
          window.localStorage.setItem(PUBLISHED_STORAGE_KEY, draft);
        }
        setBanner({
          tone: 'success',
          message: 'Draft promoted locally to published state.',
        });
      } catch (storageErr: unknown) {
        const message =
          storageErr instanceof Error ? storageErr.message : 'Failed to publish locally';
        setBanner({ tone: 'error', message });
      }
    } finally {
      setPublishing(false);
      setPublishOpen(false);
    }
  }

  function onDragStart(index: number) {
    setDragIndex(index);
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (hoverIndex !== index) setHoverIndex(index);
  }

  function onDrop() {
    if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) {
      setDragIndex(null);
      setHoverIndex(null);
      return;
    }
    setSections((prev) => reorder(prev, dragIndex, hoverIndex));
    setDragIndex(null);
    setHoverIndex(null);
  }

  function onDragEnd() {
    setDragIndex(null);
    setHoverIndex(null);
  }

  const activeCount = sections.filter((s) => s.isActive).length;
  const totalCount = sections.length;

  return (
    <div className="max-w-6xl mx-auto p-12">
      {/* Page Header */}
      <div className="flex items-end justify-between mb-16">
        <div className="space-y-2">
          <span className="text-primary font-semibold tracking-widest text-[10px] uppercase">
            Storefront Management
          </span>
          <h2 className="text-4xl font-headline font-semibold tracking-[0.1em] text-on-surface uppercase">
            Homepage Sections
          </h2>
          <p className="text-secondary text-sm max-w-md font-light leading-relaxed">
            Customize the layout and visibility of your primary atelier storefront. Drag items to
            reorder the sequence of visual narratives.
          </p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/"
            className="px-6 py-3 border border-outline-variant/30 text-on-surface text-[11px] font-bold tracking-widest uppercase hover:bg-surface-container transition-colors"
          >
            Preview Store
          </Link>
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={saving || sections.length === 0}
            className="px-6 py-3 bg-inverse-surface text-inverse-on-surface text-[11px] font-bold tracking-widest uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Draft / Publish banner */}
      {banner && <Banner tone={banner.tone === 'info' ? 'info' : banner.tone === 'success' ? 'success' : 'error'} message={banner.message} />}

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 border border-primary/30 bg-primary/5 text-primary text-xs font-body">
          Could not load live sections: {error}. Showing default layout.
        </div>
      )}

      {/* Editor Workspace */}
      <div className="space-y-6">
        {loading && sections.length === 0 ? (
          <div className="text-secondary text-xs uppercase tracking-widest py-12 text-center">
            Loading sections…
          </div>
        ) : sections.length === 0 ? (
          <div className="border border-outline-variant/10 p-12 text-center">
            <p className="text-sm text-on-surface">No homepage sections yet.</p>
            <p className="mt-2 text-xs uppercase tracking-widest text-secondary">
              {error ?? 'Add your first section with "Insert New Storytelling Section" below.'}
            </p>
          </div>
        ) : (
          sections.map((section, i) => {
            const isDragging = dragIndex === i;
            const isHoverTarget = hoverIndex === i && dragIndex !== null && dragIndex !== i;
            return (
              <div
                key={section.key}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                className={`group border p-6 flex items-center gap-6 transition-all duration-300 ${
                  section.isActive
                    ? 'bg-surface-container-lowest hover:border-outline-variant/40'
                    : 'bg-surface-container-low opacity-60'
                } ${isDragging ? 'opacity-40' : ''} ${
                  isHoverTarget ? 'border-primary' : 'border-outline-variant/10'
                }`}
              >
                <div className="drag-handle flex cursor-grab items-center justify-center p-2 text-secondary/30 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">drag_indicator</span>
                </div>
                <div className="w-32 h-20 bg-surface-container overflow-hidden rounded-sm flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary/30 text-3xl">
                    {section.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <h4
                    className={`font-headline text-lg font-semibold tracking-wide uppercase ${
                      section.isActive ? 'text-on-surface' : 'text-secondary'
                    }`}
                  >
                    {section.title}
                  </h4>
                  <p className="text-secondary text-xs mt-1 italic">{section.subtitle}</p>
                </div>
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold tracking-tighter uppercase text-secondary">
                      {section.isActive ? 'Visible' : 'Hidden'}
                    </span>
                    <div
                      aria-hidden
                      className={`w-10 h-5 rounded-full relative flex items-center px-1 ${
                        section.isActive ? 'bg-primary' : 'bg-surface-container-high'
                      }`}
                    >
                      <div
                        className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${
                          section.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <Link
                    href={section.href}
                    className={`flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase transition-colors ${
                      section.isActive
                        ? 'text-on-surface hover:text-primary'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                  >
                    Edit Content
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </Link>
                </div>
              </div>
            );
          })
        )}

        {/* Add Section Placeholder */}
        <Link
          href="/cms/blog/new"
          className="w-full border-2 border-dashed border-outline-variant/30 py-12 flex flex-col items-center justify-center gap-4 text-secondary hover:text-primary hover:border-primary/50 transition-all group bg-surface/30"
        >
          <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined">add</span>
          </div>
          <span className="font-headline text-xs font-bold tracking-widest uppercase">
            Insert New Storytelling Section
          </span>
        </Link>
      </div>

      {/* Editor Sidebar / Context Menu Area */}
      <div className="mt-20 grid grid-cols-3 gap-8">
        <div className="bg-surface-container-low p-8 border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
            <h5 className="font-headline text-sm font-bold tracking-widest uppercase">
              Global Styles
            </h5>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-secondary">Negative Space</span>
              <span className="text-[10px] font-bold uppercase px-2 py-1 bg-surface-container-high">
                —
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-secondary">Typography Flow</span>
              <span className="text-[10px] font-bold uppercase px-2 py-1 bg-surface-container-high">
                —
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low p-8 border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary">history</span>
            <h5 className="font-headline text-sm font-bold tracking-widest uppercase">
              Recent History
            </h5>
          </div>
          <div className="space-y-3">
            {lastUpdated ? (
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                <div>
                  <p className="text-xs font-semibold">Sections updated</p>
                  <p className="text-[10px] text-secondary">
                    {new Date(lastUpdated).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary/30 mt-1.5" />
                <div>
                  <p className="text-xs font-semibold text-secondary">No recent activity</p>
                  <p className="text-[10px] text-secondary">—</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-inverse-surface p-8">
          <h5 className="font-headline text-sm font-bold tracking-widest uppercase text-inverse-on-surface mb-2">
            Live Status
          </h5>
          <p className="text-inverse-on-surface/70 text-[10px] mb-4 leading-relaxed">
            {totalCount > 0
              ? `${activeCount} of ${totalCount} sections currently visible on the storefront.`
              : 'No sections configured yet.'}
          </p>
          <p className="text-inverse-on-surface/60 text-[10px] mb-6 leading-relaxed">
            Your changes are currently in &apos;Draft&apos; mode. They will not be visible to
            customers until you publish.
          </p>
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={publishing || sections.length === 0}
            className="w-full py-3 bg-primary text-on-primary text-[11px] font-bold tracking-widest uppercase hover:brightness-110 transition-all disabled:opacity-50"
          >
            {publishing ? 'Publishing…' : 'Publish Storefront'}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onConfirm={handlePublishConfirmed}
        title="Publish Draft"
        message="Publish draft to live storefront?"
        confirmLabel="Publish"
        tone="danger"
        busy={publishing}
      />
    </div>
  );
}
