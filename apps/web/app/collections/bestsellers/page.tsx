import type { Metadata } from 'next';
import { BestsellersCollection } from '@/components/bestsellers/bestsellers-collection';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { fallbackProducts } from '@/lib/placeholder-products';
import { buildMetadata } from '@/lib/seo/metadata';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  images: string[];
  variants: { id: string; size: string; color: string; price: string; stock: number }[];
}

interface CollectionResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  products: { product: ApiProduct }[];
}

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: 'Bestsellers',
  description:
    "The pieces our community keeps coming back for. Ranked by reorders, restocks, and time on waitlist — Denimisia's most-loved styles.",
  pathname: '/collections/bestsellers',
});

async function getCollection(): Promise<CollectionResponse | null> {
  try {
    const res = await fetch(`${API}/collections/bestsellers`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function BestsellersCollectionPage() {
  const api = await getCollection();
  const apiProducts = api?.products.map((cp) => cp.product) ?? [];
  const usingPlaceholders = apiProducts.length === 0;

  const products = usingPlaceholders
    ? fallbackProducts({
        key: 'collection-bestsellers',
        title: 'Bestsellers',
        categorySlug: 'bestsellers',
        adjectives: 'generic',
        fit: 'bestsellers',
        count: 12,
      }).map((p) => {
        const colors = new Set(p.variants.map((v) => v.color));
        return {
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          image: p.images[0] ?? '',
          hoverImage: p.images[1],
          colourCount: colors.size,
        };
      })
    : apiProducts.map((p) => {
        const colors = new Set(p.variants.map((v) => v.color));
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          image: resolveProductImage(p.images[0], p.slug),
          hoverImage: resolveHoverImage(p.images[1], p.slug),
          colourCount: colors.size,
        };
      });

  return (
    <BestsellersCollection
      products={products}
      isPlaceholder={usingPlaceholders}
    />
  );
}
