import { SITE_URL } from '@/config/brand';
import { buildUrlSet, sitemapHeaders, isJunkSlug, type SitemapUrl } from '@/lib/seo/sitemap-xml';

export const revalidate = 3600;

const API =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface SlugEntry {
  slug: string;
  updatedAt: string;
  firstImage?: string | null;
}

async function fetchAllSlugs(): Promise<SlugEntry[]> {
  const all: SlugEntry[] = [];
  let cursor: string | undefined;
  const maxPages = 50; // safety: up to 50k products at limit=1000

  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ limit: '1000' });
    if (cursor) qs.set('cursor', cursor);

    try {
      const res = await fetch(`${API}/products/slugs?${qs}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const json = await res.json();
      const data = json.success ? json.data : json;
      const batch: SlugEntry[] = data?.items ?? [];
      if (batch.length === 0) break;
      all.push(...batch);
      cursor = data?.nextCursor;
      if (!cursor) break;
    } catch {
      break;
    }
  }

  return all;
}

export async function GET() {
  const slugs = await fetchAllSlugs();
  const urls: SitemapUrl[] = slugs
    .filter((entry) => !isJunkSlug(entry.slug))
    .map((entry) => ({
    loc: `${SITE_URL}/products/${entry.slug}`,
    lastmod: entry.updatedAt
      ? new Date(entry.updatedAt).toISOString().split('T')[0]
      : undefined,
    changefreq: 'weekly',
    priority: 0.8,
    images: entry.firstImage
      ? [{ loc: entry.firstImage, title: entry.slug }]
      : undefined,
  }));

  return new Response(buildUrlSet(urls), { headers: sitemapHeaders });
}
