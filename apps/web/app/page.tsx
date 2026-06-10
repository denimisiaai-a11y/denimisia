import { Fragment } from 'react';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { brand } from '@/config/brand';
import { SectionRenderer, type SectionData } from '@/components/home/section-renderer';
import { SplashPrerender } from '@/components/splash/splash-prerender';
import { PromoBanner } from '@/components/promo/promo-banner';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { fetchCuratedSection, type CuratedItem } from '@/lib/curation';
import { getFeaturedHomeCollections } from '@/lib/collections';
import { DropsCarousel } from '@/components/home/drops-carousel';
import {
  fetchHomepageSections,
  type HomepageSection,
  type HomepageSectionType,
} from '@/lib/homepage-sections';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  isFeatured: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  showStarBadge?: boolean;
  category: { id: string; name: string; slug: string } | null;
  variants: { id: string; size: string; color: string; price: string; stock: number }[];
}

interface CollectionResponse {
  id: string;
  name: string;
  slug: string;
  products: { product: ApiProduct }[];
}

async function fetchCollection(slug: string): Promise<ApiProduct[]> {
  try {
    // Use /resolved so AUTO collections (bestsellers, new-arrivals) auto-populate
    // from rules. EDIT/DROP/PROMO still return their manual product list.
    const res = await fetch(`${API}/collections/${slug}/resolved`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const collection: CollectionResponse | null = json?.success
      ? json.data
      : (json as CollectionResponse | null);
    if (!collection) return [];
    return collection.products.map((cp) => cp.product);
  } catch {
    return [];
  }
}

async function fetchProducts(limit = 17): Promise<ApiProduct[]> {
  try {
    const res = await fetch(`${API}/products?limit=${limit}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.success ? json.data.products : [];
  } catch {
    return [];
  }
}

async function fetchFlaggedList(
  path: 'trending' | 'new-arrivals' | 'featured',
): Promise<ApiProduct[]> {
  try {
    const res = await fetch(`${API}/products/${path}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.success) return [];
    return Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

/**
 * Merge admin-flagged + CMS-curated + collection-fallback into a single
 * deduped list capped at `cap`. Flagged comes first so a freshly-toggled
 * product appears at the front of the row; existing curation fills the
 * remaining slots; fallback only kicks in if the first two are empty.
 */
function mergeSources<T extends { id: string }>(
  flagged: readonly T[],
  curated: readonly T[],
  fallback: readonly T[],
  cap: number,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...flagged, ...curated, ...fallback]) {
    if (out.length >= cap) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function mapProduct(p: ApiProduct) {
  const colors = new Set(p.variants.map((v) => v.color));
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    image: resolveProductImage(p.images[0], p.slug),
    hoverImage: resolveHoverImage(p.images[1], p.slug),
    colourCount: colors.size,
    showStarBadge: p.showStarBadge ?? false,
  };
}

function curatedToCard(item: CuratedItem) {
  const p = item.product;
  const colors = new Set(p.variants.map((v) => v.color));
  const image = item.customImageUrl ?? resolveProductImage(p.images[0], p.slug);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    image,
    hoverImage: resolveHoverImage(p.images[1], p.slug),
    colourCount: colors.size,
    showStarBadge: p.showStarBadge ?? false,
  };
}

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: `${brand.displayName} — ${brand.tagline}`,
  description: brand.description,
  pathname: '/',
});

/**
 * Hard-coded fallback for when the CMS section composer hasn't been
 * configured yet (API down, table empty, etc.). Matches the historical
 * homepage order so a fresh deploy looks the same as before the composer
 * was introduced.
 */
const FALLBACK_SECTIONS: HomepageSection[] = (
  [
    'HERO',
    'CATEGORY_CARDS',
    'NEW_ARRIVALS',
    'EDITORIAL_BANNER',
    'BUNDLE_DEALS',
    'TRENDING',
    'BESTSELLERS',
    'BRAND_STORY',
  ] as HomepageSectionType[]
).map((type, i) => ({
  id: `fallback-${type}`,
  type,
  position: i,
  isActive: true,
  config: {},
}));

export default async function HomePage() {
  const [
    sectionsFromApi,
    newArrivalsRaw,
    bestsellersRaw,
    allProducts,
    flaggedNewArrivals,
    flaggedTrending,
    flaggedFeatured,
    curatedNewArrivals,
    curatedBestsellers,
    curatedTrending,
    featuredDrops,
  ] = await Promise.all([
    fetchHomepageSections(),
    fetchCollection('new-arrivals'),
    fetchCollection('bestsellers'),
    fetchProducts(17),
    fetchFlaggedList('new-arrivals'),
    fetchFlaggedList('trending'),
    fetchFlaggedList('featured'),
    fetchCuratedSection('home', 'new_arrivals_section'),
    fetchCuratedSection('home', 'bestsellers_section'),
    fetchCuratedSection('home', 'trending_section'),
    getFeaturedHomeCollections(),
  ]);

  const sections = sectionsFromApi.length > 0 ? sectionsFromApi : FALLBACK_SECTIONS;

  const newArrivals = mergeSources(
    flaggedNewArrivals.map(mapProduct),
    curatedNewArrivals.items.map(curatedToCard),
    newArrivalsRaw.map(mapProduct),
    8,
  );

  const bestsellers = mergeSources(
    flaggedFeatured.map(mapProduct),
    curatedBestsellers.items.map(curatedToCard),
    bestsellersRaw.map(mapProduct),
    10,
  );

  const trending = mergeSources(
    flaggedTrending.map(mapProduct),
    curatedTrending.items.map(curatedToCard),
    allProducts.map(mapProduct),
    10,
  );

  const sectionData: SectionData = { newArrivals, trending, bestsellers };

  // Split sections in half so the MIDDLE promo placement sits at a natural
  // break point in the homepage flow without depending on which specific
  // section types the admin has configured.
  const half = Math.floor(sections.length / 2);
  const firstHalf  = sections.slice(0, half);
  const secondHalf = sections.slice(half);

  // DropsCarousel renders directly under the New Arrivals section so the
  // brand hero + category cards above it stay visible first. Wherever
  // NEW_ARRIVALS lands in the section order (first or second half), the
  // carousel follows it. No-op if no collection has isFeaturedHome=true.
  const renderSection = (section: HomepageSection) => (
    <Fragment key={section.id}>
      <SectionRenderer section={section} data={sectionData} />
      {section.type === 'NEW_ARRIVALS' && featuredDrops.length > 0 && (
        <DropsCarousel collections={featuredDrops} />
      )}
    </Fragment>
  );

  return (
    <>
      <SplashPrerender />
      {firstHalf.map(renderSection)}
      <PromoBanner position="middle" />
      {secondHalf.map(renderSection)}
      <PromoBanner position="bottom" />
    </>
  );
}
