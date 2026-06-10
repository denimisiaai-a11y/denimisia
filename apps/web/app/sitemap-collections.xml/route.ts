import { SITE_URL } from '@/config/brand';
import { buildUrlSet, sitemapHeaders, isJunkSlug, type SitemapUrl } from '@/lib/seo/sitemap-xml';
import { getCollections } from '@/lib/api';

export const revalidate = 3600;

export async function GET() {
  let collections: Awaited<ReturnType<typeof getCollections>> = [];
  try {
    collections = await getCollections();
  } catch {
    // Fall through to empty sitemap rather than error page.
  }

  const now = new Date().toISOString().split('T')[0];
  const urls: SitemapUrl[] = collections
    .filter((c) => !isJunkSlug(c.slug))
    .map((c) => ({
    loc: `${SITE_URL}/collections/${c.slug}`,
    lastmod: now,
    changefreq: 'weekly',
    priority: 0.7,
    images: c.image ? [{ loc: c.image, title: c.name }] : undefined,
  }));

  return new Response(buildUrlSet(urls), { headers: sitemapHeaders });
}
