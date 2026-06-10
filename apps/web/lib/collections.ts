import { cache } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export type CollectionType = 'DROP' | 'EDIT' | 'AUTO' | 'PROMO';
export type HeroLayout = 'FULL_BLEED' | 'SPLIT' | 'VIDEO' | 'MINIMAL';
export type CollectionSort =
  | 'MANUAL'
  | 'NEWEST'
  | 'PRICE_ASC'
  | 'PRICE_DESC'
  | 'BESTSELLING';

export interface FilterConfig {
  size?: boolean;
  color?: boolean;
  price?: boolean;
  fit?: boolean;
}

export interface LookbookItem {
  id: string;
  imageUrl: string;
  caption: string | null;
  altText: string | null;
  position: number;
}

export interface ProductInCollection {
  product: {
    id: string;
    name: string;
    slug: string;
    price: string | number;
    compareAtPrice: string | null;
    images: string[];
    showStarBadge?: boolean;
    variants?: { id: string; size: string; color: string; stock: number }[];
    // Populated server-side when the product is in an active campaign.
    activeCampaign?: {
      finalPrice: number;
      savingsPercent: number;
      campaignSlug: string;
      campaignName: string;
    } | null;
  };
  position: number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  type: CollectionType;

  image: string | null;
  heroImageDesktop: string | null;
  heroImageMobile: string | null;
  heroVideo: string | null;
  heroTextColor: string;
  heroOverlay: number;
  heroAlign: string;
  backgroundColor: string | null;

  heroLayout: HeroLayout;
  gridColumnsDesktop: number;
  gridColumnsMobile: number;
  defaultSort: CollectionSort;
  showFilters: boolean;
  filterConfig: FilterConfig | null;
  showCountdown: boolean;
  showSocialProof: boolean;
  showRelated: boolean;

  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  prelaunchTeaser: boolean;
  postEndBehavior: string;
  postEndRedirect: string | null;

  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  showInNav: boolean;
  navOrder: number;
  isFeaturedHome: boolean;
  homepageSlot: number | null;
  showAsRail: boolean;
  railTitle: string | null;
  promoCode: string | null;

  products: ProductInCollection[];
  lookbook: LookbookItem[];
}

type Envelope<T> = T | { success: boolean; data: T | null };

function unwrap<T>(json: Envelope<T>): T | null {
  if (json && typeof json === 'object' && 'success' in json) {
    return json.success ? (json as { data: T | null }).data : null;
  }
  return json as T;
}

/**
 * Fetches a single collection with its products auto-resolved (if AUTO type).
 * Returns null on 404 or fetch errors so the page can render a fallback.
 */
export const getCollectionBySlug = cache(
  async (slug: string): Promise<Collection | null> => {
    try {
      const res = await fetch(`${API}/collections/${slug}/resolved`, {
        next: { revalidate: 60 },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return unwrap<Collection>(json);
    } catch {
      return null;
    }
  },
);

/**
 * Active collections currently within their date window — used by footer
 * "Edits" list, sitemap, mega-menu.
 */
export const getActiveCollections = cache(
  async (): Promise<Collection[]> => {
    try {
      const res = await fetch(`${API}/collections`, { next: { revalidate: 120 } });
      if (!res.ok) return [];
      const json = await res.json();
      const arr = unwrap<Collection[]>(json);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  },
);

export const getCollectionsForNav = cache(async (): Promise<Collection[]> => {
  const all = await getActiveCollections();
  return all
    .filter((c) => c.showInNav)
    .sort((a, b) => a.navOrder - b.navOrder);
});

export const getCollectionsForRails = cache(async (): Promise<Collection[]> => {
  const all = await getActiveCollections();
  return all.filter((c) => c.showAsRail);
});

export const getFeaturedHomeCollections = cache(
  async (): Promise<Collection[]> => {
    const all = await getActiveCollections();
    return all
      .filter((c) => c.isFeaturedHome)
      .sort((a, b) => (a.homepageSlot ?? 99) - (b.homepageSlot ?? 99));
  },
);

/* ── Helpers ──────────────────────────────────────────────────────────── */

export function deriveVisibilityState(c: Collection): {
  state: 'live' | 'prelaunch' | 'ended' | 'hidden';
  effectiveHero: string | null;
} {
  const now = Date.now();
  const startMs = c.startDate ? new Date(c.startDate).getTime() : null;
  const endMs = c.endDate ? new Date(c.endDate).getTime() : null;
  const hero = c.heroImageDesktop ?? c.image;

  if (!c.isActive) return { state: 'hidden', effectiveHero: hero };
  if (startMs && startMs > now) return { state: 'prelaunch', effectiveHero: hero };
  if (endMs && endMs < now) return { state: 'ended', effectiveHero: hero };
  return { state: 'live', effectiveHero: hero };
}

export function sortProducts(
  products: ProductInCollection[],
  sort: CollectionSort,
): ProductInCollection[] {
  if (sort === 'MANUAL') return [...products].sort((a, b) => a.position - b.position);
  if (sort === 'PRICE_ASC')
    return [...products].sort((a, b) => Number(a.product.price) - Number(b.product.price));
  if (sort === 'PRICE_DESC')
    return [...products].sort((a, b) => Number(b.product.price) - Number(a.product.price));
  // NEWEST + BESTSELLING fall through — API returns sorted; preserve order
  return products;
}
