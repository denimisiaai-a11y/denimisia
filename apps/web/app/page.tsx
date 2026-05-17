import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { brand } from '@/config/brand';
import { HeroSection } from '@/components/home/hero-section';
import { CategoryCards } from '@/components/home/category-cards';
import { NewArrivals } from '@/components/home/new-arrivals';
import { EditorialBanner } from '@/components/home/editorial-banner';
import { BundleDeals } from '@/components/home/bundle-deals';
import { TrendingSection } from '@/components/home/trending-section';
import { BestSellers } from '@/components/home/best-sellers';
import { BrandStory } from '@/components/home/brand-story';
import { SplashPrerender } from '@/components/splash/splash-prerender';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { fetchCuratedSection, type CuratedItem } from '@/lib/curation';

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
    const res = await fetch(`${API}/collections/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.success) return [];
    const collection: CollectionResponse = json.data;
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

/** Hits a flag-aware endpoint. Returns admin-flagged products (isTrending=
 *  true, isNewArrival=true, isFeatured=true). */
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
 *
 * Earlier behavior was first-non-empty-wins — that hid flagged products
 * whenever the CMS had any curation, which made the flag feel broken.
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

export const metadata: Metadata = buildMetadata({
  title: `${brand.displayName} — ${brand.tagline}`,
  description: brand.description,
  pathname: '/',
});

export default async function HomePage() {
  const [
    newArrivalsRaw,
    bestsellersRaw,
    allProducts,
    flaggedNewArrivals,
    flaggedTrending,
    flaggedFeatured,
    curatedNewArrivals,
    curatedBestsellers,
    curatedTrending,
  ] = await Promise.all([
    fetchCollection('new-arrivals'),
    fetchCollection('bestsellers'),
    fetchProducts(17),
    fetchFlaggedList('new-arrivals'),
    fetchFlaggedList('trending'),
    fetchFlaggedList('featured'),
    fetchCuratedSection('home', 'new_arrivals_section'),
    fetchCuratedSection('home', 'bestsellers_section'),
    fetchCuratedSection('home', 'trending_section'),
  ]);

  // Merge order for every homepage row: flagged → curated → fallback.
  // Flagged products jump to the front so admins see the impact of toggling
  // a flag immediately; curated items fill remaining slots; the
  // collection / all-products fallback only fires when both upstream
  // sources are empty.
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

  return (
    <>
      <SplashPrerender />
      <HeroSection />
      <CategoryCards />
      <NewArrivals products={newArrivals} />
      <EditorialBanner />
      <BundleDeals />
      <TrendingSection products={trending} />
      <BestSellers products={bestsellers} />
      <BrandStory />
    </>
  );
}
