/**
 * Tiny XML builder for urlset sitemaps. We avoid Next.js's sitemap() helper
 * because it caps at 50k URLs per file in a single callback without giving
 * us a simple way to split — routing to separate /sitemap-*.xml routes keeps
 * control in our hands.
 */

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
  /** Optional image URLs per entry. */
  images?: { loc: string; title?: string }[];
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildUrlSet(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const parts = [`    <loc>${xmlEscape(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (u.priority !== undefined)
        parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
      if (u.images && u.images.length > 0) {
        u.images.forEach((img) => {
          parts.push(`    <image:image>`);
          parts.push(`      <image:loc>${xmlEscape(img.loc)}</image:loc>`);
          if (img.title)
            parts.push(`      <image:title>${xmlEscape(img.title)}</image:title>`);
          parts.push(`    </image:image>`);
        });
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>`;
}

export const sitemapHeaders = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control':
    'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
} as const;

/**
 * Leftover QA/test entities (e.g. the `test` product, `test1001` collection)
 * are still live in the DB but must never be advertised to crawlers. Matches
 * "test", "test103", "test1001" — but NOT real slugs like "tested-denim".
 * Remove once the test data is deactivated.
 */
export function isJunkSlug(slug: string): boolean {
  return /^test\d*$/i.test(slug);
}
