import { SITE_URL } from '@/config/brand';
import { buildUrlSet, sitemapHeaders, type SitemapUrl } from '@/lib/seo/sitemap-xml';
import { getProductFacets } from '@/lib/api';
import { SHOP_GENDER_FITS, genderCategorySlug } from '@/lib/category-copy';

export const revalidate = 3600;

// Shop category (fit) pages — /shop/[gender]/[fit]. Only emit the ones that
// actually resolve to a populated DB category, so we never advertise an empty
// (noindex "coming soon") or invalid (404) page to crawlers. The category
// product pages live in sitemap-products; this surfaces the browse pages so
// the real fit assortments get discovered.
export async function GET() {
  const populated = new Set<string>();
  try {
    const facets = await getProductFacets();
    for (const c of facets.categories) {
      if (c.count > 0) populated.add(c.slug);
    }
  } catch {
    // API down → empty sitemap rather than an error page.
  }

  const urls: SitemapUrl[] = [];
  for (const [gender, fits] of Object.entries(SHOP_GENDER_FITS)) {
    for (const fit of fits) {
      const categorySlug = `${genderCategorySlug(gender)}-${fit.slug}`;
      if (populated.has(categorySlug)) {
        urls.push({
          loc: `${SITE_URL}/shop/${gender}/${fit.slug}`,
          changefreq: 'weekly',
          priority: 0.7,
        });
      }
    }
  }

  return new Response(buildUrlSet(urls), { headers: sitemapHeaders });
}
