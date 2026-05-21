/**
 * Shared types for the CMS Section Composer admin page.
 *
 * String values MUST match the Prisma `HomepageSectionType` enum in
 * packages/database/prisma/schema.prisma. If you change a name here,
 * change it there too and run a migration.
 */

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
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GlobalStorefrontStyles {
  readonly id: string;
  readonly negativeSpace: number;  // 0=tight, 1=default, 2=airy
  readonly typographyFlow: number; // 0=tight, 1=default, 2=loose
}

export interface AuditLogEntry {
  readonly id: string;
  readonly userId: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly details: unknown;
  readonly createdAt: string;
  readonly user?: { firstName?: string; lastName?: string; email?: string } | null;
}

interface SectionTypeMeta {
  readonly label: string;
  readonly description: string;
  readonly icon: string;             // material-symbols-outlined name
  readonly contentEditor?: string;   // /admin route where slot content for this type is edited
  readonly defaultConfig: Record<string, unknown>;
}

export const SECTION_TYPE_META: Record<HomepageSectionType, SectionTypeMeta> = {
  HERO: {
    label: 'Hero banner',
    description: 'Fullscreen image or video at the top of the page.',
    icon: 'photo_library',
    contentEditor: '/cms/home-banners',
    defaultConfig: {},
  },
  CATEGORY_CARDS: {
    label: 'Category cards',
    description: 'Three tiles below the hero linking to category pages.',
    icon: 'grid_view',
    contentEditor: '/cms/home-banners',
    defaultConfig: {},
  },
  NEW_ARRIVALS: {
    label: 'New arrivals row',
    description: 'Horizontal product row showing newly-added products.',
    icon: 'fiber_new',
    defaultConfig: { title: 'New Arrivals', limit: 17 },
  },
  EDITORIAL_BANNER: {
    label: 'Editorial carousel',
    description: 'Auto-sliding fullwidth carousel of editorial slides.',
    icon: 'view_carousel',
    contentEditor: '/cms/home-banners',
    defaultConfig: { slotGroupKey: 'home.editorial' },
  },
  BUNDLE_DEALS: {
    label: 'Bundle deals',
    description: 'Product bundles shown as cards.',
    icon: 'inventory_2',
    defaultConfig: { title: 'Bundle Deals', limit: 4 },
  },
  TRENDING: {
    label: 'Trending row',
    description: 'Horizontal product row of admin-flagged trending products.',
    icon: 'trending_up',
    defaultConfig: { title: 'Trending', limit: 8 },
  },
  BESTSELLERS: {
    label: 'Bestsellers',
    description: 'Curated row of bestseller products.',
    icon: 'star',
    defaultConfig: { title: 'Bestsellers' },
  },
  BRAND_STORY: {
    label: 'Brand story',
    description: 'Backdrop image with brand narrative text.',
    icon: 'auto_stories',
    contentEditor: '/cms/home-banners',
    defaultConfig: {},
  },
};

/** Section types whose `config` field has user-editable values. */
export const HAS_CONFIG_FIELDS: ReadonlySet<HomepageSectionType> = new Set<HomepageSectionType>([
  'NEW_ARRIVALS',
  'EDITORIAL_BANNER',
  'BUNDLE_DEALS',
  'TRENDING',
  'BESTSELLERS',
]);
