// ============================================================================
//  CATEGORY COPY — Edit this file to change headlines, subtitles, and imagery
//  across every shop / series / collection landing page.
//
//  To swap real product data in:
//    1. Flip `ALWAYS_USE_PLACEHOLDER` in `placeholder-images.ts` to `false`
//    2. Ensure API categories exist matching the slugs in `constants.ts`
//    3. No changes needed here — real products override placeholders when
//       the API returns records.
// ============================================================================

import { CATEGORY_IMAGES, NAV_FEATURED, PLACEHOLDER_HERO } from './placeholder-images';

// Shop — Women & Men fit pages
export const SHOP_FIT_COPY: Record<string, { subtitle: string; hero?: string }> = {
  cargo: { subtitle: 'Utility pockets, structured lines.' },
  culotte: { subtitle: 'Mid-length, wide silhouette.' },
  flare: { subtitle: 'Fitted top, fluid bell hem.' },
  'wide-leg': { subtitle: 'Relaxed through the leg.' },
  mom: { subtitle: 'High-rise, vintage shape.' },
  jegging: { subtitle: 'Denim comfort of leggings.' },
  slouchy: { subtitle: 'Easy drape, casual fall.' },
  skinny: { subtitle: 'Close to the body, leg to ankle.' },
  straight: { subtitle: 'Clean line from hip to hem.' },
  sweatshirt: { subtitle: 'Heavyweight, brushed interior.' },
  jacket: { subtitle: 'Layering essentials.' },
  jackets: { subtitle: 'Structured outerwear.' },
  'slim-fit': { subtitle: 'Trim through the thigh.' },
  'regular-fit': { subtitle: 'True to size, classic cut.' },
  shorts: { subtitle: 'Warm-weather staples.' },
  'relaxed-fit': { subtitle: 'Roomy, unconstrained.' },
};

// Shop — gender hero copy
export const SHOP_GENDER_COPY: Record<string, { eyebrow: string; title: string; subtitle: string; hero: string }> = {
  women: {
    eyebrow: 'Women',
    title: "The Women's Collection",
    subtitle:
      'Structured denim, draped tops, and considered proportions — built around the way you move.',
    hero: NAV_FEATURED.shopWomen,
  },
  men: {
    eyebrow: 'Men',
    title: "The Men's Collection",
    subtitle:
      'Weighted selvedge, workroom staples, and tailoring that wears in rather than out.',
    hero: NAV_FEATURED.shopMen,
  },
};

// Series — top-level (Tops / Pants)
export const SERIES_TYPE_COPY: Record<string, { eyebrow: string; title: string; subtitle: string; hero: string }> = {
  tops: {
    eyebrow: 'Series',
    title: 'Tops',
    subtitle:
      'Shirts, shackets, sweaters, and the everyday layering pieces that anchor our collections.',
    hero: NAV_FEATURED.seriesBestSellers,
  },
  pants: {
    eyebrow: 'Series',
    title: 'Pants',
    subtitle:
      'Denims, trousers, and tracks — cut for comfort without compromising line.',
    hero: NAV_FEATURED.seriesWideLeg,
  },
};

// Series — subtypes
export const SERIES_SUBTYPE_COPY: Record<string, { subtitle: string }> = {
  shackets: { subtitle: 'Shirt-jacket hybrids — light enough to layer, structured enough to stand alone.' },
  shirts: { subtitle: 'Soft collars, hand-sewn seams, and fabrics that breathe.' },
  jackets: { subtitle: 'Chore coats, bombers, and selvedge outerwear.' },
  't-shirts': { subtitle: 'Heavyweight cottons cut to a considered pattern.' },
  tracksuits: { subtitle: 'Matching sets in sueded fleece.' },
  sweaters: { subtitle: 'Merino and lambswool, ribbed and cabled.' },
  hoodies: { subtitle: 'Brushed interior, dropped shoulders, tonal drawcords.' },
  checks: { subtitle: 'Tartan, gingham, windowpane — the pattern library.' },
  'track-pants': { subtitle: 'Elasticated waists, tapered legs, technical fabrics.' },
  denims: { subtitle: 'Raw, selvedge, and washed — our pattern language.' },
  trousers: { subtitle: 'Tailored legs, pleated fronts, fine fabrics.' },
};

// Collections — seasonal drops
export interface CollectionCopy {
  slug: string;
  name: string;
  season: string;
  tagline: string;
  description: string;
  hero: string;
  status: 'active' | 'archive' | 'upcoming';
  productCount: number;
}

export const COLLECTIONS: CollectionCopy[] = [
  {
    slug: 'spring26',
    name: 'Spring · Summer 26',
    season: 'SS26',
    tagline: 'Raw Collection',
    description:
      'A study in form, texture, and understated luxury. Unsanforized selvedge, editorial cuts, and considered proportions.',
    hero: NAV_FEATURED.collectionLatest,
    status: 'active',
    productCount: 24,
  },
  {
    slug: 'aw25',
    name: 'Autumn · Winter 25',
    season: "AW'25",
    tagline: 'The Heritage Study',
    description:
      'Heavyweight denim, chore coats, and workwear-rooted silhouettes. Built for layered winters and longer evenings.',
    hero: CATEGORY_IMAGES.jackets,
    status: 'active',
    productCount: 37,
  },
  {
    slug: 'dropout25',
    name: 'Dropout · 25',
    season: 'SS25 DROP 02',
    tagline: 'Limited Release',
    description:
      'A mid-season release featuring our most-requested cuts returned in one-time washes. Retired on sell-through.',
    hero: NAV_FEATURED.seriesWideLeg,
    status: 'active',
    productCount: 20,
  },
  {
    slug: 'ss25',
    name: 'Spring · Summer 25',
    season: 'SS25',
    tagline: 'The Lightweight Series',
    description:
      'Breathable weights, relaxed tailoring, and the introduction of our signature Panjabi cut. Partially retired.',
    hero: CATEGORY_IMAGES.tops,
    status: 'archive',
    productCount: 13,
  },
  {
    slug: 'aw24',
    name: 'Autumn · Winter 24',
    season: "AW'24",
    tagline: 'Inaugural Drop',
    description:
      "Denimisia's first full collection. Six silhouettes that defined our pattern language — now fully retired.",
    hero: CATEGORY_IMAGES.denims,
    status: 'archive',
    productCount: 6,
  },
];

export function findCollection(slug: string): CollectionCopy | null {
  return COLLECTIONS.find((c) => c.slug === slug) ?? null;
}

export const FALLBACK_HERO = PLACEHOLDER_HERO;

function titleCase(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function shopFitCopy(fit: string): { subtitle: string } {
  return SHOP_FIT_COPY[fit] ?? { subtitle: `Curated ${titleCase(fit).toLowerCase()} for every day.` };
}

export function seriesTypeCopy(type: string) {
  return SERIES_TYPE_COPY[type];
}

export function seriesSubtypeCopy(subtype: string): { subtitle: string } {
  return SERIES_SUBTYPE_COPY[subtype] ?? { subtitle: `Explore ${titleCase(subtype).toLowerCase()} across our series.` };
}

// Subtype lists drive the Product Type filter on /series/[type] pages.
export const SERIES_TYPE_SUBTYPES: Record<string, { slug: string; label: string }[]> = {
  tops: [
    { slug: 'shackets', label: 'Shackets' },
    { slug: 'shirts', label: 'Shirts' },
    { slug: 'jackets', label: 'Jackets' },
    { slug: 't-shirts', label: 'T-shirts' },
    { slug: 'tracksuits', label: 'Tracksuits' },
    { slug: 'sweaters', label: 'Sweaters' },
    { slug: 'hoodies', label: 'Hoodies' },
    { slug: 'checks', label: 'Checks' },
  ],
  pants: [
    { slug: 'denims', label: 'Denims' },
    { slug: 'track-pants', label: 'Track Pants' },
    { slug: 'trousers', label: 'Trousers' },
  ],
};

// Storefront routes use the singular gender slug (`women`/`men`), but the
// real DB category slugs are pluralized (`womens`/`mens`, and fits like
// `womens-cargo`). Map the route param → the real category slug prefix so
// product queries actually resolve. Unknown values pass through unchanged.
const GENDER_CATEGORY_SLUG: Record<string, string> = {
  women: 'womens',
  men: 'mens',
};

export function genderCategorySlug(gender: string): string {
  return GENDER_CATEGORY_SLUG[gender] ?? gender;
}

// Shop gender "Category" filter — links into /shop/[gender]/[fit].
export const SHOP_GENDER_FITS: Record<string, { slug: string; label: string }[]> = {
  women: [
    { slug: 'wide-leg', label: 'Wide Leg' },
    { slug: 'cargo', label: 'Cargo' },
    { slug: 'culotte', label: 'Culotte' },
    { slug: 'flare', label: 'Flare' },
    { slug: 'mom', label: 'Mom' },
    { slug: 'jegging', label: 'Jegging' },
    { slug: 'slouchy', label: 'Slouchy' },
    { slug: 'skinny', label: 'Skinny' },
    { slug: 'straight', label: 'Straight' },
    { slug: 'sweatshirt', label: 'Sweatshirt' },
    { slug: 'jacket', label: 'Jacket' },
  ],
  men: [
    { slug: 'cargo', label: 'Cargo' },
    { slug: 'slim-fit', label: 'Slim Fit' },
    { slug: 'regular-fit', label: 'Regular Fit' },
    { slug: 'skinny', label: 'Skinny' },
    { slug: 'relaxed-fit', label: 'Relaxed Fit' },
    { slug: 'shorts', label: 'Shorts' },
    { slug: 'jackets', label: 'Jackets' },
    { slug: 'sweatshirt', label: 'Sweatshirt' },
  ],
};
