import { absoluteUrl } from '../canonical';
import type { JsonLdNode } from './types';

interface CollectionLike {
  name: string;
  slug: string;
  description: string | null;
}

/** CollectionPage node — contextualizes collection/PLP pages for Google. */
export function collectionPageJsonLd(
  collection: CollectionLike,
): JsonLdNode {
  const url = absoluteUrl(`/collections/${collection.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: collection.name,
    description: collection.description ?? undefined,
    inLanguage: 'en-BD',
  };
}
