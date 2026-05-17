// MVP placeholder image source. All Unsplash — already whitelisted in
// next.config.js. Swap individual URLs by editing the arrays / exports below.
// Product images are picked deterministically by slug (same slug always
// resolves to the same image across renders).

// When true, resolveProductImage/resolveHoverImage always return the
// Unsplash fallback even if the API provides an image. Flipped to false
// now that real product photography is uploaded — API URLs pass through
// as the primary source and the Unsplash pool only fills gaps for
// products that haven't had photos added yet.
const ALWAYS_USE_PLACEHOLDER = false;

const U = (id: string, w = 1200): string =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=85`;

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Editorial Unsplash pool for product cards. Spans five categories so grids
// show real variety instead of one repeated studio shot:
//
//   - Fashion editorial portraits (diverse models, lighting)
//   - Denim detail + garment close-ups
//   - Street / lifestyle candids
//   - Product-only flat-lay and mannequin shots
//   - Dramatic / black-and-white / workshop imagery
//
// Deterministic picker (hash % pool length) picks a stable image per slug.
// Swap any ID freely — UI unaffected as long as the string is a valid
// Unsplash photo ID (the 20-char segment after `photo-`).
const PRODUCT_POOL: readonly string[] = [
  // Fashion editorial portraits
  '1485968579580-b6d095142e6e',
  '1517841905240-472988babdf9',
  '1534528741775-53994a69daeb',
  '1519699047748-de8e457a634e',
  '1536766768598-e09213fdcf22',
  '1487222477894-8943e31ef7b2',
  '1487222477894-8943e31ef7b2',
  '1534528741775-53994a69daeb',
  '1535930891776-0c2dfb7fda1a',
  '1548142813-c348350df52b',
  '1510784722466-f2aa9c52fff6',
  '1485462537746-965f33f7f6a7',
  '1514995669114-6081e934b693',
  '1496747611176-843222e1e57c',
  '1529139574466-a303027c1d8b',
  // Denim / garment detail
  '1542272604-787c3835535d',
  '1604176354204-9268737828e4',
  '1594633312681-425c7b97ccd1',
  '1551232864-3f0890e580d9',
  '1582552938357-32b906df40cb',
  '1515886657613-9f3515b0c78f',
  '1491553895911-0055eca6402d',
  '1581338834647-b0fb40704e21',
  // Street / lifestyle
  '1441986300917-64674bd600d8',
  '1441984904996-e0b6ba687e04',
  '1475180098004-ca77a66827be',
  '1471922694854-ff1b63b20054',
  '1554412933-514a83d2f3c8',
  '1581044777550-4cfa60707c03',
  // Product / flat lay
  '1521572163474-6864f9cf17ab',
  '1521572163474-6864f9cf17ab',
  '1618354691249-18772bbac3a5',
  '1556906781-9a412961c28c',
  // Dramatic / workshop
  '1483985988355-763728e1935b',
  '1604654894610-df63bc536371',
  '1571945153237-4929e783af4a',
];

export function fallbackProductImage(key: string, width = 1000): string {
  const idx = hash(key) % PRODUCT_POOL.length;
  return U(PRODUCT_POOL[idx]!, width);
}

export function fallbackHoverImage(key: string, width = 1000): string {
  // Offset so the hover image differs from the primary card image.
  const idx = (hash(key) + 5) % PRODUCT_POOL.length;
  return U(PRODUCT_POOL[idx]!, width);
}

// Resolve a product image. In MVP mode (ALWAYS_USE_PLACEHOLDER=true) the
// fallback is always returned so the UI shows varied photography regardless
// of seed data. Disable the flag to resume passing the API's real URLs.
export function resolveProductImage(
  apiImage: string | null | undefined,
  key: string,
  width = 1000,
): string {
  if (ALWAYS_USE_PLACEHOLDER) return fallbackProductImage(key, width);
  if (apiImage && apiImage.trim().length > 0) return apiImage;
  return fallbackProductImage(key, width);
}

export function resolveHoverImage(
  apiImage: string | null | undefined,
  key: string,
  width = 1000,
): string | undefined {
  if (ALWAYS_USE_PLACEHOLDER) return fallbackHoverImage(key, width);
  if (apiImage && apiImage.trim().length > 0) return apiImage;
  return fallbackHoverImage(key, width);
}

// Named editorial shots — swap these IDs to change hero / brand visuals.
// Picked for composition, tonal restraint, and editorial polish.
export const PLACEHOLDER_HERO = U('1509631179647-0177331693ae', 1920);
export const PLACEHOLDER_BRAND_STORY = U('1556906781-9a412961c28c', 1600);

export const CATEGORY_IMAGES = {
  tops: U('1535930891776-0c2dfb7fda1a', 1400),
  denims: U('1491553895911-0055eca6402d', 1400),
  jackets: U('1548142813-c348350df52b', 1400),
} as const;

// Mega-menu featured panel imagery — one editorial shot per nav surface.
export const NAV_FEATURED = {
  shopWomen: U('1534528741775-53994a69daeb', 900),
  shopMen: U('1485462537746-965f33f7f6a7', 900),
  collectionLatest: U('1471922694854-ff1b63b20054', 900),
  seriesBestSellers: U('1441984904996-e0b6ba687e04', 900),
  seriesWideLeg: U('1604176354204-9268737828e4', 900),
} as const;

// Auth / brand story / about editorial panels.
export const AUTH_EDITORIAL = U('1529139574466-a303027c1d8b', 1400);
export const ABOUT_HERO = U('1490481651871-ab68de25d43d', 1920);
export const ABOUT_MESSAGE = U('1514995669114-6081e934b693', 1400);

// Homepage editorial banner — auto-rotating campaign frames.
export const EDITORIAL_BANNER_SLIDES = [
  {
    image: U('1485968579580-b6d095142e6e', 1920),
    eyebrow: 'Campaign No. 01',
    title: 'Raw Indigo, Reimagined',
    subtitle: 'Unwashed silhouettes that age with you.',
    href: '/collections/raw-indigo',
  },
  {
    image: U('1515886657613-9f3515b0c78f', 1920),
    eyebrow: 'Series — Wide Leg',
    title: 'Room to Move',
    subtitle: 'Architectural denim for the modern wardrobe.',
    href: '/series/pants/wide-leg',
  },
  {
    image: U('1483985988355-763728e1935b', 1920),
    eyebrow: 'Editorial',
    title: 'Monochrome Study',
    subtitle: 'Tonal dressing in cotton, wool, and washed denim.',
    href: '/collections/monochrome',
  },
  {
    image: U('1539109136881-3be0616acf4b', 1920),
    eyebrow: 'Bestsellers',
    title: 'The House Codes',
    subtitle: 'The pieces that defined the season.',
    href: '/collections/bestsellers',
  },
] as const;
