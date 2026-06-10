import type { Metadata } from 'next';
import { buildMetadata } from './metadata';
import { plainText } from './truncate';

interface CollectionLike {
  name: string;
  slug: string;
  description: string | null;
  image?: string | null;
}

/** Collection / PLP metadata. */
export function generateCollectionMetadata(
  collection: CollectionLike,
  searchParams?: Record<string, string | string[] | undefined>,
): Metadata {
  const desc = plainText(
    collection.description ??
      `Shop the ${collection.name} collection — premium denim and essentials from Denimisia.`,
    160,
  );

  return buildMetadata({
    title: collection.name,
    description: desc,
    pathname: `/collections/${collection.slug}`,
    searchParams,
    canonicalAllowed: ['page'],
    images: collection.image
      ? [{ url: collection.image, alt: collection.name }]
      : undefined,
  });
}
