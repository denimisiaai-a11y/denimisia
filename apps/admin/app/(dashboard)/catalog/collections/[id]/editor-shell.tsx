'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner, StatusChip } from '@/components/admin-ui';
import { BasicsTab } from './tabs/basics-tab';
import { VisualsTab } from './tabs/visuals-tab';
import { ProductsTab } from './tabs/products-tab';
import { LayoutTab } from './tabs/layout-tab';
import { ScheduleTab } from './tabs/schedule-tab';
import { SeoTab } from './tabs/seo-tab';

const TABS = [
  { key: 'basics', label: 'Basics' },
  { key: 'visuals', label: 'Visuals' },
  { key: 'products', label: 'Products' },
  { key: 'layout', label: 'Layout' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'seo', label: 'SEO' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export type CollectionDetail = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly subtitle: string | null;
  readonly description: string | null;
  readonly internalNote: string | null;
  readonly type: 'DROP' | 'EDIT' | 'AUTO' | 'PROMO';
  readonly image: string | null;
  readonly heroImageDesktop: string | null;
  readonly heroImageMobile: string | null;
  readonly heroVideo: string | null;
  readonly heroTextColor: string;
  readonly heroOverlay: number;
  readonly heroAlign: string;
  readonly backgroundColor: string | null;
  readonly heroLayout: 'FULL_BLEED' | 'SPLIT' | 'VIDEO' | 'MINIMAL';
  readonly gridColumnsDesktop: number;
  readonly gridColumnsMobile: number;
  readonly defaultSort: 'MANUAL' | 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'BESTSELLING';
  readonly showFilters: boolean;
  readonly filterConfig: Record<string, boolean> | null;
  readonly showCountdown: boolean;
  readonly showSocialProof: boolean;
  readonly showRelated: boolean;
  readonly isActive: boolean;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly timezone: string;
  readonly prelaunchTeaser: boolean;
  readonly postEndBehavior: string;
  readonly postEndRedirect: string | null;
  readonly visibility: string;
  readonly autoRules: Record<string, unknown> | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly ogImage: string | null;
  readonly showInNav: boolean;
  readonly navOrder: number;
  readonly isFeaturedHome: boolean;
  readonly homepageSlot: number | null;
  readonly showAsRail: boolean;
  readonly railTitle: string | null;
  readonly promoCode: string | null;
  readonly utmSource: string | null;
  readonly products: readonly {
    readonly productId: string;
    readonly position: number;
    readonly product: {
      readonly id: string;
      readonly name: string;
      readonly slug: string;
      readonly images: string[];
      readonly price: string | number;
    };
  }[];
  readonly lookbook: readonly {
    readonly id: string;
    readonly imageUrl: string;
    readonly caption: string | null;
    readonly position: number;
  }[];
};

function deriveStatus(c: CollectionDetail | null): {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'neutral';
} {
  if (!c) return { label: '—', tone: 'neutral' };
  if (!c.isActive) return { label: 'Hidden', tone: 'warning' };
  const now = Date.now();
  if (c.startDate && new Date(c.startDate).getTime() > now)
    return { label: 'Scheduled', tone: 'info' };
  if (c.endDate && new Date(c.endDate).getTime() < now)
    return { label: 'Ended', tone: 'neutral' };
  return { label: 'Live', tone: 'success' };
}

export function EditorShell({ collectionId }: { readonly collectionId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [tab, setTab] = useState<TabKey>('basics');
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await adminFetch<CollectionDetail>(
        `/collections/admin/${collectionId}`,
        token,
      );
      setCollection(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [collectionId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = (updated: CollectionDetail) => {
    setCollection(updated);
    setSavedAt(new Date());
  };

  const status = deriveStatus(collection);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface text-on-surface p-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-secondary">
          Loading collection…
        </p>
      </div>
    );
  }

  if (err || !collection) {
    return (
      <div className="min-h-screen bg-surface text-on-surface p-8">
        <Banner tone="error" message={err ?? 'Collection not found'} />
        <button
          onClick={() => router.push('/catalog/collections')}
          className="mt-4 text-xs uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
        >
          ← Back to Collections
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="flex items-start justify-between border-b border-outline-variant/10 px-8 py-6">
        <div>
          <button
            onClick={() => router.push('/catalog/collections')}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            ← Collections
          </button>
          <h1 className="mt-1 font-display text-3xl font-light">{collection.name}</h1>
          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
            <span>/{collection.slug}</span>
            <span>·</span>
            <StatusChip label={collection.type} tone="info" />
            <StatusChip label={status.label} tone={status.tone} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {savedAt && (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
          <a
            href={`https://denimisiabd.com/collections/${collection.slug}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            View on storefront ↗
          </a>
        </div>
      </header>

      <nav className="flex gap-0 overflow-x-auto border-b border-outline-variant/10 px-8">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-4 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
              tab === t.key
                ? 'text-on-surface border-b-2 border-on-surface'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="px-8 py-8 max-w-4xl">
        {tab === 'basics' && <BasicsTab collection={collection} onSaved={onSaved} />}
        {tab === 'visuals' && <VisualsTab collection={collection} onSaved={onSaved} onReload={load} />}
        {tab === 'products' && <ProductsTab collection={collection} onSaved={onSaved} onReload={load} />}
        {tab === 'layout' && <LayoutTab collection={collection} onSaved={onSaved} />}
        {tab === 'schedule' && <ScheduleTab collection={collection} onSaved={onSaved} />}
        {tab === 'seo' && <SeoTab collection={collection} onSaved={onSaved} />}
      </main>
    </div>
  );
}
