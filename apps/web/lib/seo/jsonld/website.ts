import { SITE_URL, brand } from '@/config/brand';
import type { JsonLdNode } from './types';

/**
 * WebSite node with SearchAction — enables the site-search sitelinks box
 * in Google SERPs. Points at the real /search?q= route.
 */
export function websiteJsonLd(): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: brand.displayName,
    description: brand.description,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en-BD',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
