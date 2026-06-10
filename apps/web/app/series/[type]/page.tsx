import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getProducts } from '@/lib/api';
import { CategoryGrid, type CategoryCard } from '@/components/shop/category-grid';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { fallbackProducts } from '@/lib/placeholder-products';
import { seriesTypeCopy, SERIES_TYPE_SUBTYPES } from '@/lib/category-copy';
import { fetchPageSlots, pickSlot, resolveSlotUrl } from '@/lib/page-slots';
import { SITE_URL } from '@/config/brand';
import { ComingSoon } from '@/components/shop/coming-soon';
import { noindexRobots } from '@/lib/seo/metadata';

interface Props {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const revalidate = 60;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { type } = await params;
  const sp = await searchParams;
  const copy = seriesTypeCopy(type);
  // Invalid type → the page notFound()s; noindex keeps the soft-404 (200,
  // locked by root-layout streaming) out of the index.
  if (!copy) return { title: 'Series', robots: noindexRobots };
  // Multi-select filter combinations (?types=) are noindexed to avoid thin /
  // duplicate filter pages — the canonical /series/[type]/[subtype] pages hold
  // the SEO weight. The clean base URL stays indexable and self-canonical.
  // Only count *valid* subtype slugs so a junk ?types=garbage URL (which renders
  // the indexable base view) isn't accidentally noindexed.
  const validSlugs = new Set(
    (SERIES_TYPE_SUBTYPES[type] ?? []).map((s) => s.slug),
  );
  const hasTypeFilter =
    typeof sp.types === 'string' &&
    sp.types.split(',').some((t) => validSlugs.has(t.trim()));
  return {
    title: `${copy.title} — Series`,
    description: copy.subtitle,
    alternates: { canonical: `${SITE_URL}/series/${type}` },
    robots: hasTypeFilter ? { index: false, follow: true } : undefined,
  };
}

export default async function SeriesTypePage({ params, searchParams }: Props) {
  const { type } = await params;
  const sp = await searchParams;
  const copy = seriesTypeCopy(type);
  if (!copy) notFound();

  const subtypes = SERIES_TYPE_SUBTYPES[type] ?? [];
  // ?types=denims,trousers → keep only slugs that exist for this type (so a
  // hand-edited URL can't inject arbitrary category lookups), and select them
  // in canonical subtype order so the resulting category list — and therefore
  // the API/Redis/edge cache keys — are order-stable regardless of how the URL
  // params were arranged (?a,b and ?b,a hit the same cache entry).
  const requestedTypes = new Set(
    typeof sp.types === 'string'
      ? sp.types.split(',').map((t) => t.trim()).filter(Boolean)
      : [],
  );
  const selectedTypes = subtypes
    .map((s) => s.slug)
    .filter((slug) => requestedTypes.has(slug));
  const hasTypeFilter = selectedTypes.length > 0;

  // Admin can swap the series-type hero via the Media Manager
  // (series.hero_tops / series.hero_pants). Falls back to the hardcoded
  // copy.hero from category-copy.ts when no asset has been uploaded.
  const seriesSlots = await fetchPageSlots('series').catch(() => []);
  const heroSlotKey = `hero_${type.replace(/-/g, '_')}`;
  const heroSlot = pickSlot(seriesSlots, heroSlotKey);
  const { src: heroSrc } = resolveSlotUrl(heroSlot, copy.hero);

  let data;
  try {
    data = hasTypeFilter
      ? await getProducts({
          categories: selectedTypes.map((s) => `${type}-${s}`),
          limit: 60,
        })
      : await getProducts({ category: type, limit: 60 });
  } catch {
    data = { products: [], total: 0, page: 1, limit: 40, totalPages: 0 };
  }

  // Placeholders are a local design-preview aid and only fill the unfiltered
  // landing view. In production an empty series shows a branded "coming soon"
  // state; a filtered query returning nothing shows it too (no fake products).
  const isEmpty = data.products.length === 0;
  const showPlaceholders =
    !hasTypeFilter && isEmpty && process.env.NODE_ENV !== 'production';
  // Only the unfiltered landing shows "coming soon". A filtered query that
  // returns nothing falls through to CategoryGrid's own empty state so the
  // filter chips stay mounted and the user can clear the selection.
  const comingSoon = isEmpty && !hasTypeFilter && !showPlaceholders;
  const cards: CategoryCard[] = showPlaceholders
    ? fallbackProducts({
        key: `series-${type}`,
        title: copy.title,
        categorySlug: type,
        adjectives: type === 'pants' ? 'pants' : 'tops',
        fit: type,
        count: 36,
      }).map((p) => ({
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        image: p.images[0] ?? '',
        hoverImage: p.images[1],
        sizes: Array.from(new Set(p.variants.map((v) => v.size))),
        washes: Array.from(new Set(p.variants.map((v) => v.color))),
      }))
    : data.products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        image: resolveProductImage(p.images[0], p.slug),
        hoverImage: resolveHoverImage(p.images[1], p.slug),
        activeCampaign: p.activeCampaign ?? null,
        sizes: Array.from(new Set(p.variants.map((v) => v.size))),
        washes: Array.from(new Set(p.variants.map((v) => v.color))),
      }));

  const sizePool = Array.from(new Set(cards.flatMap((c) => c.sizes ?? [])));
  // Multi-select Product Type filter: each subtype is a toggle on the ?types=
  // URL param (handled by category-filters), not an href navigation.
  const productTypes = subtypes.map((s) => ({
    slug: s.slug,
    label: s.label,
    active: selectedTypes.includes(s.slug),
  }));

  return (
    <div>
      <div className="relative mt-20 h-[40vh] min-h-[280px] w-full overflow-hidden bg-ink">
        <Image
          data-slot-field="media"
          data-slot={`series.${heroSlotKey}`}
          src={heroSrc}
          alt={heroSlot?.altText ?? copy.title}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-paper">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.3em] text-paper/80">
            {copy.eyebrow}
          </p>
          <h1 className="font-serif text-4xl tracking-tight md:text-5xl">{copy.title}</h1>
          <p className="mt-4 max-w-md text-sm text-paper/80">{copy.subtitle}</p>
        </div>
      </div>

      <div className="w-full px-4 py-16 sm:px-6 lg:px-8 2xl:px-14">
        <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
          <Link href="/" className="transition-colors hover:text-ink">
            Home
          </Link>
          <ChevronRight size={12} />
          <span className="text-muted">Series</span>
          <ChevronRight size={12} />
          <span className="text-ink">{copy.title}</span>
        </nav>

        <div className="mb-8 flex items-end justify-between border-b border-ink/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">All {copy.title}</p>
          {!comingSoon && (
            <p className="text-xs uppercase tracking-[0.15em] text-muted">
              {cards.length} piece{cards.length === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {comingSoon ? (
          <ComingSoon title={copy.title} />
        ) : (
          <CategoryGrid
            products={cards}
            productTypes={productTypes}
            productTypesHeading="Product type"
            productTypeParam="types"
            sizes={sizePool}
            sizesHeading={type === 'pants' ? 'Waist' : 'Size'}
            showFootnote={showPlaceholders}
            footnote="Showing curated preview — full assortment syncing soon."
          />
        )}
      </div>
    </div>
  );
}
