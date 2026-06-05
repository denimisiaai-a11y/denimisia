import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ProductDetail } from './product-detail';
import { ReviewsSection } from '@/components/product/reviews-section';
import { YouMayAlsoLike } from '@/components/product/you-may-also-like';
import { JsonLd } from '@/components/seo/json-ld';
import { generateProductMetadata } from '@/lib/seo/product';
import { buildFallbackMetadata } from '@/lib/seo/defaults';
import { productJsonLd } from '@/lib/seo/jsonld/product';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld/breadcrumb';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  material: string | null;
  stock: number;
  price: string;
  images: string[];
}

export interface ActiveCampaign {
  campaignId: string;
  campaignSlug: string;
  campaignName: string;
  campaignType: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number;
  finalPrice: number;
  savingsPercent: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  tags: string[];
  category: { id: string; name: string; slug: string };
  variants: ProductVariant[];
  // Populated server-side when the product is in an active campaign.
  // Null otherwise. The campaign's finalPrice takes priority over
  // compareAtPrice for the strikethrough display.
  activeCampaign?: ActiveCampaign | null;
}

// React cache dedupes per-request so generateMetadata and the page share a
// single API call instead of fetching the product twice.
const getProduct = cache(async (slug: string): Promise<Product | null> => {
  try {
    const res = await fetch(`${API}/products/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
});

interface RelatedList {
  products: Product[];
}

async function getRelatedList(query: string): Promise<Product[]> {
  try {
    const res = await fetch(`${API}/products?${query}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.success) return [];
    const data = json.data as RelatedList | Product[];
    return Array.isArray(data) ? data : (data.products ?? []);
  } catch {
    return [];
  }
}

function excludeSlug(list: Product[], slug: string, limit: number): Product[] {
  return list.filter((p) => p.slug !== slug).slice(0, limit);
}

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  // Never cache "Not Found" as the real title — fall back to generic metadata
  // so a transient API blip doesn't poison SERP.
  if (!product) return buildFallbackMetadata({ pathname: `/products/${slug}` });
  return generateProductMetadata(product);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [sameCategory, featured, newest] = await Promise.all([
    getRelatedList(`category=${encodeURIComponent(product.category.slug)}&limit=12`),
    getRelatedList('featured=true&limit=12'),
    getRelatedList('sort=newest&limit=12'),
  ]);

  return (
    <>
      <JsonLd id="ld-product" data={productJsonLd(product)} />
      <JsonLd
        id="ld-breadcrumb"
        data={breadcrumbJsonLd([
          { name: 'Shop', path: '/shop' },
          {
            name: product.category.name,
            path: `/shop?category=${product.category.slug}`,
          },
          { name: product.name, path: `/products/${product.slug}` },
        ])}
      />
      <ProductDetail product={product} />
      <ReviewsSection productId={product.id} />
      <YouMayAlsoLike
        recommended={excludeSlug(sameCategory, slug, 12)}
        bestSellers={excludeSlug(featured, slug, 12)}
        newArrivals={excludeSlug(newest, slug, 12)}
      />
    </>
  );
}
