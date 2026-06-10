import { absoluteUrl } from '../canonical';
import type { JsonLdNode } from './types';

export interface BreadcrumbCrumb {
  name: string;
  /** Site-relative path. */
  path: string;
}

/**
 * BreadcrumbList. Crumbs rendered in SERP when present. Always includes a
 * "Home" root; callers provide only the rest.
 */
export function breadcrumbJsonLd(crumbs: BreadcrumbCrumb[]): JsonLdNode {
  const full: BreadcrumbCrumb[] = [
    { name: 'Home', path: '/' },
    ...crumbs,
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: full.map((c, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}
