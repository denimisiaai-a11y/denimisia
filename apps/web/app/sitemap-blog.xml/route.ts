import { SITE_URL } from '@/config/brand';
import { buildUrlSet, sitemapHeaders, type SitemapUrl } from '@/lib/seo/sitemap-xml';

export const revalidate = 3600;

const API =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface BlogPost {
  slug: string;
  title: string;
  publishedAt?: string;
  updatedAt?: string;
  coverImage?: string | null;
}

async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${API}/blog?limit=1000`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.success ? json.data : json;
    return Array.isArray(data) ? data : data?.posts ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  const posts = await fetchBlogPosts();
  const urls: SitemapUrl[] = posts.map((p) => ({
    loc: `${SITE_URL}/blog/${p.slug}`,
    lastmod: p.updatedAt ?? p.publishedAt,
    changefreq: 'monthly',
    priority: 0.6,
    images: p.coverImage ? [{ loc: p.coverImage, title: p.title }] : undefined,
  }));

  return new Response(buildUrlSet(urls), { headers: sitemapHeaders });
}
