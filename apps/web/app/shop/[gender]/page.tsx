import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getProducts } from '@/lib/api';
import { CategoryGrid, type CategoryCard } from '@/components/shop/category-grid';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { fallbackProducts } from '@/lib/placeholder-products';
import { SHOP_GENDER_COPY, SHOP_GENDER_FITS, genderCategorySlug } from '@/lib/category-copy';
import { fetchPageSlots, pickSlot, resolveSlotUrl } from '@/lib/page-slots';
import { ComingSoon } from '@/components/shop/coming-soon';
import { noindexRobots } from '@/lib/seo/metadata';
import { SITE_URL } from '@/config/brand';

interface Props {
  params: Promise<{ gender: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const revalidate = 60;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { gender } = await params;
  const sp = await searchParams;
  const copy = SHOP_GENDER_COPY[gender];
  // Invalid gender → the page notFound()s. The status stays 200 (root-layout
  // streaming locks it) but noindex keeps the soft-404 out of the index.
  if (!copy) return { title: 'Shop', robots: noindexRobots };
  // Multi-select fit combinations (?fits=) are noindexed to avoid thin/duplicate
  // filter pages; the canonical /shop/[gender]/[fit] pages hold the SEO weight.
  const validFits = new Set((SHOP_GENDER_FITS[gender] ?? []).map((f) => f.slug));
  const hasFitFilter =
    typeof sp.fits === 'string' &&
    sp.fits.split(',').some((f) => validFits.has(f.trim()));
  return {
    title: copy.title,
    description: copy.subtitle,
    alternates: { canonical: `${SITE_URL}/shop/${gender}` },
    robots: hasFitFilter ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopGenderPage({ params, searchParams }: Props) {
  const { gender } = await params;
  const sp = await searchParams;
  const copy = SHOP_GENDER_COPY[gender];
  if (!copy) notFound();

  const fits = SHOP_GENDER_FITS[gender] ?? [];
  // ?fits=cargo,flare → keep only valid fit slugs, in canonical order so the
  // category list (and the API/cache key) is order-stable.
  const requestedFits = new Set(
    typeof sp.fits === 'string'
      ? sp.fits.split(',').map((f) => f.trim()).filter(Boolean)
      : [],
  );
  const selectedFits = fits
    .map((f) => f.slug)
    .filter((slug) => requestedFits.has(slug));
  const hasFitFilter = selectedFits.length > 0;

  // Admin can swap the gender hero through the Media Manager
  // (shop.hero_women / shop.hero_men). Falls back to the hardcoded
  // copy.hero when no asset has been uploaded.
  const shopSlots = await fetchPageSlots('shop').catch(() => []);
  const heroSlotKey = gender === 'men' ? 'hero_men' : 'hero_women';
  const heroSlot = pickSlot(shopSlots, heroSlotKey);
  const { src: heroSrc } = resolveSlotUrl(heroSlot, copy.hero);

  let data;
  try {
    data = hasFitFilter
      ? await getProducts({
          categories: selectedFits.map((f) => `${genderCategorySlug(gender)}-${f}`),
          limit: 60,
        })
      : await getProducts({ category: genderCategorySlug(gender), limit: 60 });
  } catch {
    data = { products: [], total: 0, page: 1, limit: 40, totalPages: 0 };
  }

  const isEmpty = data.products.length === 0;
  // Placeholders are a local design-preview aid only. In production an empty
  // category shows a branded "coming soon" state instead of fabricated cards.
  // Only the unfiltered landing shows coming-soon; a filtered-empty result
  // falls through to CategoryGrid's own empty state so the filter chips stay.
  const showPlaceholders =
    !hasFitFilter && isEmpty && process.env.NODE_ENV !== 'production';
  const comingSoon = isEmpty && !hasFitFilter && !showPlaceholders;
  const cards: CategoryCard[] = showPlaceholders
    ? fallbackProducts({
        key: `shop-${gender}-all`,
        title: copy.eyebrow,
        categorySlug: gender,
        adjectives: gender === 'men' ? 'men' : 'women',
        fit: gender,
        count: 40,
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
  // Multi-select category filter: each fit is a checkbox toggling the ?fits=
  // URL param (handled by category-filters), not an href navigation.
  const productTypes = fits.map((f) => ({
    slug: f.slug,
    label: f.label,
    active: selectedFits.includes(f.slug),
  }));

  return (
    <div>
      {/* Hero */}
      <div className="relative mt-20 h-[46vh] min-h-[320px] w-full overflow-hidden bg-ink">
        <Image
          data-slot-field="media"
          data-slot={`shop.${heroSlotKey}`}
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
          <h1 className="font-serif text-4xl tracking-tight md:text-6xl">{copy.title}</h1>
          <p className="mt-4 max-w-md text-sm text-paper/80">{copy.subtitle}</p>
        </div>
      </div>

      <div className="w-full px-4 py-16 sm:px-6 lg:px-8 2xl:px-14">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
          <Link href="/" className="transition-colors hover:text-ink">
            Home
          </Link>
          <ChevronRight size={12} />
          <span className="text-ink">{copy.eyebrow}</span>
        </nav>

        <div className="mb-8 flex items-end justify-between border-b border-ink/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">All {copy.eyebrow}</p>
          {!comingSoon && (
            <p className="text-xs uppercase tracking-[0.15em] text-muted">
              {cards.length} piece{cards.length === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {comingSoon ? (
          <ComingSoon title={copy.eyebrow} />
        ) : (
          <CategoryGrid
            products={cards}
            productTypes={productTypes}
            productTypesHeading="Category"
            productTypeParam="fits"
            sizes={sizePool}
            sizesHeading="Size"
            showFootnote={showPlaceholders}
            footnote="Preview only. Real products load once the catalog syncs."
          />
        )}
      </div>
    </div>
  );
}
