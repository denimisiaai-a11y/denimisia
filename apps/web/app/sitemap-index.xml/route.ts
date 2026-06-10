import { SITE_URL } from '@/config/brand';

export const revalidate = 3600;

const SITEMAPS = [
  'sitemap-pages.xml',
  'sitemap-products.xml',
  'sitemap-collections.xml',
  'sitemap-categories.xml',
];

export async function GET() {
  // No <lastmod> on index entries: each child sitemap carries its own and
  // the hourly revalidation makes an index-level timestamp misleading.
  const entries = SITEMAPS.map(
    (name) => `  <sitemap>
    <loc>${SITE_URL}/${name}</loc>
  </sitemap>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control':
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
