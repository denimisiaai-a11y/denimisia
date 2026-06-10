import type { Metadata } from 'next';
import { buildMetadata } from './metadata';

/**
 * Fallback metadata factory. Used when a dynamic page's data fetch fails —
 * never cache "Not Found" as the actual page title.
 */

interface FallbackArgs {
  pathname: string;
  title?: string;
  description?: string;
}

export function buildFallbackMetadata({
  pathname,
  title = 'Denimisia',
  description = 'Premium denim and essentials. Crafted to last.',
}: FallbackArgs): Metadata {
  return buildMetadata({
    title,
    description,
    pathname,
    // Fallback pages should not get indexed until the underlying data resolves.
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  });
}
