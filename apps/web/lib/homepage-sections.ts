/**
 * Storefront-side reader for the CMS Section Composer.
 *
 * The homepage is data-driven from the `HomepageSectionInstance` table.
 * Admins reorder, toggle, and configure sections from /cms; the storefront
 * fetches the active ones in order and renders via SectionRenderer.
 *
 * Section type strings MUST stay in sync with the Prisma enum
 * `HomepageSectionType` in packages/database/prisma/schema.prisma.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export type HomepageSectionType =
  | 'HERO'
  | 'CATEGORY_CARDS'
  | 'NEW_ARRIVALS'
  | 'EDITORIAL_BANNER'
  | 'BUNDLE_DEALS'
  | 'TRENDING'
  | 'BESTSELLERS'
  | 'BRAND_STORY';

export interface HomepageSection {
  readonly id: string;
  readonly type: HomepageSectionType;
  readonly position: number;
  readonly isActive: boolean;
  readonly config: Record<string, unknown>;
}

export interface GlobalStorefrontStyles {
  readonly id: string;
  readonly negativeSpace: number;  // 0=tight, 1=default, 2=airy
  readonly typographyFlow: number; // 0=tight, 1=default, 2=loose
}

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
}

/**
 * Server-side fetcher. Failure tolerant — returns an empty list so the
 * homepage degrades gracefully when the API is down. The homepage page
 * file SHOULD treat an empty list as "fall back to hard-coded defaults".
 */
export async function fetchHomepageSections(): Promise<HomepageSection[]> {
  try {
    const res = await fetch(`${API}/cms/homepage/sections/active`, {
      next: { revalidate: 30, tags: ['homepage-sections'] },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as ApiEnvelope<HomepageSection[]>;
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

export async function fetchHomepageStyles(): Promise<GlobalStorefrontStyles> {
  const fallback: GlobalStorefrontStyles = {
    id: 'singleton',
    negativeSpace: 1,
    typographyFlow: 1,
  };
  try {
    const res = await fetch(`${API}/cms/homepage/styles`, {
      next: { revalidate: 60, tags: ['homepage-styles'] },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as ApiEnvelope<GlobalStorefrontStyles>;
    return json.success && json.data ? json.data : fallback;
  } catch {
    return fallback;
  }
}

// Type-safe config readers per section type. Defaults match the seeded
// values in migration 20260521060000_cms_section_composer.

export interface NewArrivalsConfig {
  readonly title: string;
  readonly limit: number;
}

export interface EditorialBannerConfig {
  readonly slotGroupKey: string;
}

export interface BundleDealsConfig {
  readonly title: string;
  readonly limit: number;
}

export interface TrendingConfig {
  readonly title: string;
  readonly limit: number;
}

export interface BestsellersConfig {
  readonly title: string;
  readonly collectionSlug?: string;
}

export function readNewArrivalsConfig(
  config: Record<string, unknown>,
): NewArrivalsConfig {
  return {
    title: typeof config.title === 'string' ? config.title : 'New Arrivals',
    limit: typeof config.limit === 'number' ? config.limit : 17,
  };
}

export function readEditorialBannerConfig(
  config: Record<string, unknown>,
): EditorialBannerConfig {
  return {
    slotGroupKey:
      typeof config.slotGroupKey === 'string'
        ? config.slotGroupKey
        : 'home.editorial',
  };
}

export function readBundleDealsConfig(
  config: Record<string, unknown>,
): BundleDealsConfig {
  return {
    title: typeof config.title === 'string' ? config.title : 'Bundle Deals',
    limit: typeof config.limit === 'number' ? config.limit : 4,
  };
}

export function readTrendingConfig(
  config: Record<string, unknown>,
): TrendingConfig {
  return {
    title: typeof config.title === 'string' ? config.title : 'Trending',
    limit: typeof config.limit === 'number' ? config.limit : 8,
  };
}

export function readBestsellersConfig(
  config: Record<string, unknown>,
): BestsellersConfig {
  return {
    title: typeof config.title === 'string' ? config.title : 'Bestsellers',
    collectionSlug:
      typeof config.collectionSlug === 'string'
        ? config.collectionSlug
        : undefined,
  };
}
