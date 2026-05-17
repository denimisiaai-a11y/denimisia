// Synthesizes placeholder Product list entries for empty category/search pages.
// Deterministic: same key always produces the same products in the same order
// so back-forward navigation feels stable. Product details are tailored to the
// category (price range, name pattern, color count).

import { fallbackProductImage, fallbackHoverImage } from './placeholder-images';

export interface PlaceholderProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  isFeatured: boolean;
  category: { id: string; name: string; slug: string } | null;
  variants: {
    id: string;
    size: string;
    color: string;
    price: string;
    stock: number;
  }[];
}

const WOMEN_ADJECTIVES = ['Raw', 'Vintage', 'Ink', 'Dusk', 'Coastline', 'Atelier', 'Noir', 'Heritage', 'Meridian', 'Linen', 'Ivory', 'Midnight'];
const MEN_ADJECTIVES = ['Selvedge', 'Heritage', 'Workroom', 'Indigo', 'Shadow', 'Granite', 'Carbon', 'Slate', 'Oakline', 'Meridian', 'Harbour', 'Cobalt'];
const TOPS_ADJECTIVES = ['Atelier', 'Ink', 'Dusk', 'Meridian', 'Heritage', 'Kyoto', 'Linen', 'Weave', 'Selvedge', 'Noir', 'Ivory', 'Shadow'];
const PANTS_ADJECTIVES = ['Raw', 'Selvedge', 'Workroom', 'Indigo', 'Heritage', 'Shadow', 'Granite', 'Meridian', 'Midnight', 'Slate', 'Harbour', 'Oakline'];
const GENERIC_ADJECTIVES = ['Atelier', 'Heritage', 'Meridian', 'Selvedge', 'Studio', 'Noir', 'Ink', 'Dusk', 'Shadow', 'Ivory', 'Linen', 'Raw'];

type AdjectivePool = 'women' | 'men' | 'tops' | 'pants' | 'generic';

function pool(pool: AdjectivePool): readonly string[] {
  switch (pool) {
    case 'women': return WOMEN_ADJECTIVES;
    case 'men': return MEN_ADJECTIVES;
    case 'tops': return TOPS_ADJECTIVES;
    case 'pants': return PANTS_ADJECTIVES;
    default: return GENERIC_ADJECTIVES;
  }
}

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function titleCase(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function pickPrice(
  pool: AdjectivePool,
  _fit: string,
  seed: number,
): { price: number; compareAt: number | null } {
  const base = pool === 'women' ? 1890 : pool === 'tops' ? 1690 : 1990;
  const bump = (seed % 7) * 120;
  const price = base + bump;
  const onSale = seed % 5 === 0;
  return { price, compareAt: onSale ? price + 500 + (seed % 400) : null };
}

const SIZES_PANTS = ['28', '30', '32', '34', '36'];
const SIZES_TOPS = ['S', 'M', 'L', 'XL'];
const COLORS = ['Indigo', 'Stone', 'Black', 'Ecru', 'Navy', 'Olive'];

function pickSizes(fit: string): string[] {
  const topsLike = ['sweatshirt', 'jacket', 'jackets', 'shorts'];
  return topsLike.some((t) => fit.includes(t)) ? SIZES_TOPS : SIZES_PANTS;
}

export function fallbackProductsForCategory(
  gender: string,
  fit: string,
  count = 12,
): PlaceholderProduct[] {
  return fallbackProducts({
    key: `${gender}-${fit}`,
    title: titleCase(fit),
    categorySlug: `${gender}-${fit}`,
    adjectives: gender === 'men' ? 'men' : 'women',
    fit,
    count,
  });
}

// Generic entry: used by series/collections/shop pages to synthesize a stable,
// themed product list when the API has no matching records. Edit the adjective
// pools above, or the copy tables in `lib/category-copy.ts`, to customise.
export function fallbackProducts(opts: {
  key: string;
  title: string;
  categorySlug: string;
  adjectives: AdjectivePool;
  fit?: string;
  count?: number;
}): PlaceholderProduct[] {
  const { key, title, categorySlug, adjectives, count = 12 } = opts;
  const fitSlug = opts.fit ?? categorySlug;
  const seed = hash(key);
  const adjPool = pool(adjectives);
  const fitLabel = title;
  const products: PlaceholderProduct[] = [];

  for (let i = 0; i < count; i += 1) {
    const local = seed + i * 37;
    const adjective = adjPool[local % adjPool.length]!;
    const name = `${adjective} ${fitLabel}`;
    const slug = `${adjective.toLowerCase()}-${fitSlug}-${i + 1}`;
    const itemKey = `${key}-${i}`;
    const { price, compareAt } = pickPrice(adjectives, fitSlug, local);
    const colorCount = 2 + (local % 4);
    const sizeList = pickSizes(fitSlug);
    const colorList = COLORS.slice(0, colorCount);

    const variants = colorList.flatMap((color, ci) =>
      sizeList.map((size, si) => ({
        id: `ph-var-${itemKey}-${ci}-${si}`,
        size,
        color,
        price: String(price),
        stock: 4 + ((local + ci * 7 + si) % 12),
      })),
    );

    products.push({
      id: `ph-prod-${itemKey}`,
      name,
      slug,
      price: String(price),
      compareAtPrice: compareAt ? String(compareAt) : null,
      images: [
        fallbackProductImage(itemKey, 1200),
        fallbackHoverImage(itemKey, 1200),
      ],
      isFeatured: i === 0,
      category: {
        id: `ph-cat-${categorySlug}`,
        name: fitLabel,
        slug: categorySlug,
      },
      variants,
    });
  }

  return products;
}
