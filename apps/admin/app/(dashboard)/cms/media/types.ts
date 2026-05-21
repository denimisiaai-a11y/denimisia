export type MediaKind = 'IMAGE' | 'VIDEO';

export interface MediaAsset {
  readonly id: string;
  readonly kind: MediaKind;
  readonly mime: string;
  readonly bytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationMs: number | null;
  readonly publicUrl: string;
  readonly posterUrl: string | null;
  readonly createdAt: string;
}

export interface PageSlotRecord {
  readonly id: string;
  readonly pageKey: string;
  readonly slotKey: string;
  readonly label: string;
  readonly mediaKind: MediaKind;
  readonly acceptsVideo: boolean;
  readonly assetId: string | null;
  readonly asset: MediaAsset | null;
  readonly heading: string | null;
  readonly subheading: string | null;
  readonly body: string | null;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  readonly altText: string | null;
  readonly position: number;
  readonly groupKey: string | null;
  readonly isActive: boolean;
  readonly specWidth: number;
  readonly specHeight: number;
  readonly specAspect: string;
  readonly maxBytes: number;
}

export interface StorageStats {
  readonly totalBytes: number;
  readonly totalAssets: number;
  readonly byKind: Record<MediaKind, number>;
}

export interface SlotHistoryEntry {
  readonly id: string;
  readonly slotId: string;
  readonly assetId: string | null;
  readonly asset: MediaAsset | null;
  readonly heading: string | null;
  readonly subheading: string | null;
  readonly body: string | null;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  readonly altText: string | null;
  readonly replacedAt: string;
}

export interface ReportedSlotRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ReportedSlot {
  readonly slotRef: string;
  readonly kind?: string;
  readonly rect: ReportedSlotRect;
}

// Page key → live storefront route for the iframe src.
// Keep in sync with apps/api/src/modules/media/media.config.ts PAGE_KEYS.
export const PAGE_ROUTES: Record<string, { label: string; path: string }> = {
  'home':                    { label: 'Homepage',          path: '/' },
  'shop':                    { label: 'Shop',              path: '/shop' },
  'collections-index':       { label: 'Collections index', path: '/collections' },
  'collection-bestsellers':  { label: 'Bestsellers',       path: '/collections/bestsellers' },
  'product-detail':          { label: 'Product detail',    path: '/products' },
  'bundles-index':           { label: 'Bundles',           path: '/bundles' },
  'bundle-detail':           { label: 'Bundle detail',     path: '/bundles' },
  'about':                   { label: 'About',             path: '/about' },
  'career':                  { label: 'Career',            path: '/career' },
  'contact':                 { label: 'Contact',           path: '/contact' },
  'returns':                 { label: 'Returns',           path: '/returns' },
  'privacy':                 { label: 'Privacy',           path: '/privacy' },
  'terms':                   { label: 'Terms of Service',  path: '/terms' },
  'nav':                     { label: 'Navigation',        path: '/' },
  'series':                  { label: 'Series',            path: '/series/tops' },
  'size-guide':              { label: 'Size guide',        path: '/size-guide' },
  'track-order':             { label: 'Track order',       path: '/track-order' },
  'outlets':                 { label: 'Outlets',           path: '/outlets' },
  'auth':                    { label: 'Auth',              path: '/login' },
  'not-found':               { label: '404',               path: '/__nf' },
  'search':                  { label: 'Search',            path: '/search' },
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
