import { SITE_URL } from '@/config/brand';
import { buildUrlSet, sitemapHeaders, type SitemapUrl } from '@/lib/seo/sitemap-xml';

export const revalidate = 86400;

const STATIC_PAGES: SitemapUrl[] = [
  { loc: `${SITE_URL}/`, changefreq: 'daily', priority: 1.0 },
  { loc: `${SITE_URL}/shop`, changefreq: 'daily', priority: 0.9 },
  { loc: `${SITE_URL}/shop/men`, changefreq: 'daily', priority: 0.9 },
  { loc: `${SITE_URL}/shop/women`, changefreq: 'daily', priority: 0.9 },
  { loc: `${SITE_URL}/collections`, changefreq: 'weekly', priority: 0.8 },
  { loc: `${SITE_URL}/bundles`, changefreq: 'weekly', priority: 0.7 },
  { loc: `${SITE_URL}/outlets`, changefreq: 'monthly', priority: 0.5 },
  { loc: `${SITE_URL}/about`, changefreq: 'monthly', priority: 0.5 },
  { loc: `${SITE_URL}/contact`, changefreq: 'monthly', priority: 0.5 },
  { loc: `${SITE_URL}/career`, changefreq: 'monthly', priority: 0.3 },
  { loc: `${SITE_URL}/size-guide`, changefreq: 'monthly', priority: 0.4 },
  { loc: `${SITE_URL}/returns`, changefreq: 'yearly', priority: 0.3 },
  { loc: `${SITE_URL}/privacy`, changefreq: 'yearly', priority: 0.2 },
  { loc: `${SITE_URL}/terms`, changefreq: 'yearly', priority: 0.2 },
  { loc: `${SITE_URL}/sitemap`, changefreq: 'monthly', priority: 0.2 },
];

// Fixed lastmod for static marketing pages. Using `new Date()` here stamped
// every page with "today" on every request, which trains crawlers to distrust
// lastmod. Bump this when the static page content materially changes.
const STATIC_LASTMOD = '2026-06-06';

export async function GET() {
  const urls = STATIC_PAGES.map((u) => ({ ...u, lastmod: u.lastmod ?? STATIC_LASTMOD }));
  return new Response(buildUrlSet(urls), { headers: sitemapHeaders });
}
