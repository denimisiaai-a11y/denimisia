import { absoluteUrl } from '../canonical';
import type { JsonLdNode } from './types';

interface ProductSummary {
  name: string;
  slug: string;
  image?: string;
  price?: string | number;
}

/**
 * ItemList for collection / PLP pages. Helps Google identify the page as a
 * product list and surface it in broader shopping experiences.
 */
export function itemListJsonLd(
  collectionName: string,
  collectionSlug: string,
  products: ProductSummary[],
): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${absoluteUrl(`/collections/${collectionSlug}`)}#itemlist`,
    name: collectionName,
    numberOfItems: products.length,
    itemListElement: products.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: absoluteUrl(`/products/${p.slug}`),
      name: p.name,
    })),
  };
}

/** Generic ItemList for any list page (search, new arrivals, etc.). */
export function simpleItemListJsonLd(
  name: string,
  pathname: string,
  items: { name: string; url: string }[],
): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${absoluteUrl(pathname)}#itemlist`,
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      url: item.url,
    })),
  };
}
