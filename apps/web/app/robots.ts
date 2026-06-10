import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/brand';

/**
 * Robots configuration. Intentionally does NOT disallow /api/* — Next.js API
 * routes don't return HTML so Google won't index them anyway, and listing
 * them here would tie the rules file to implementation details.
 *
 * Private-user areas and one-time share links are blocked. We also point at
 * the sitemap index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/account',
          '/account/',
          '/checkout',
          '/checkout/',
          '/wishlist/',
          '/verify-email',
          '/reset-password',
          '/forgot-password',
          '/track-order',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap-index.xml`,
    host: SITE_URL,
  };
}
