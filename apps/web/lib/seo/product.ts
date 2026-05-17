import type { Metadata } from 'next';
import { buildMetadata } from './metadata';
import { plainText } from './truncate';

interface ProductLike {
  name: string;
  slug: string;
  description: string;
  price: string | number;
  images: string[];
  category?: { name: string };
}

/** PDP metadata. Uses real product photos for OG (not dynamic ImageResponse). */
export function generateProductMetadata(product: ProductLike): Metadata {
  const descPrefix = product.category?.name
    ? `${product.category.name} · `
    : '';
  const desc = plainText(
    `${descPrefix}${product.description}`,
    160,
  );

  const images = product.images
    .filter(Boolean)
    .slice(0, 4)
    .map((url) => ({
      url,
      alt: product.name,
      width: 1200,
      height: 1200,
    }));

  return buildMetadata({
    title: product.name,
    description: desc,
    pathname: `/products/${product.slug}`,
    images: images.length > 0 ? images : undefined,
    // og:type=product is valid OG but rejected by Next.js's Metadata API
    // typecheck. Product-rich data ships via JSON-LD instead, which is what
    // Google/Meta actually use for shopping enrichment.
    ogType: 'website',
  });
}
