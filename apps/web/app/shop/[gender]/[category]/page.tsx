import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getProducts } from '@/lib/api';
import { CategoryGrid, type CategoryCard } from '@/components/shop/category-grid';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { fallbackProductsForCategory } from '@/lib/placeholder-products';
import { SHOP_GENDER_FITS, genderCategorySlug } from '@/lib/category-copy';
import { ComingSoon } from '@/components/shop/coming-soon';
import { noindexRobots } from '@/lib/seo/metadata';

interface Props {
  params: Promise<{ gender: string; category: string }>;
}

function formatLabel(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const SUBTITLES: Record<string, string> = {
  cargo: 'Utility pockets, structured lines.',
  culotte: 'Mid-length, wide silhouette.',
  flare: 'Fitted top, fluid bell hem.',
  'wide-leg': 'Relaxed through the leg.',
  mom: 'High-rise, vintage shape.',
  jegging: 'Denim comfort of leggings.',
  slouchy: 'Easy drape, casual fall.',
  skinny: 'Close to the body, leg to ankle.',
  straight: 'Clean line from hip to hem.',
  sweatshirt: 'Heavyweight, brushed interior.',
  jacket: 'Layering essentials.',
  jackets: 'Structured outerwear.',
  'slim-fit': 'Trim through the thigh.',
  'regular-fit': 'True to size, classic cut.',
  shorts: 'Warm-weather staples.',
  'relaxed-fit': 'Roomy, unconstrained.',
};

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gender, category } = await params;
  // Invalid gender/fit → the page notFound()s; noindex keeps that soft-404
  // (200 status, locked by root-layout streaming) out of the search index.
  const isValid = SHOP_GENDER_FITS[gender]?.some((f) => f.slug === category) ?? false;
  return {
    title: `${formatLabel(category)} — ${formatLabel(gender)}`,
    description: `Shop ${formatLabel(gender)}'s ${formatLabel(category)} at Denimisia.`,
    ...(isValid ? {} : { robots: noindexRobots }),
  };
}

export default async function ShopCategoryPage({ params }: Props) {
  const { gender, category } = await params;

  // A garbage gender/fit URL (/shop/foo/bar) must 404, not render a thin
  // coming-soon page. Valid-but-empty fits fall through to "coming soon".
  const fits = SHOP_GENDER_FITS[gender];
  if (!fits || !fits.some((f) => f.slug === category)) {
    notFound();
  }

  let data;
  try {
    data = await getProducts({
      category: `${genderCategorySlug(gender)}-${category}`,
      limit: 60,
    });
  } catch {
    data = { products: [], total: 0, page: 1, limit: 40, totalPages: 0 };
  }

  const isEmpty = data.products.length === 0;
  // Placeholders are a local design-preview aid only; production shows a
  // branded "coming soon" state instead of fabricated, unclickable cards.
  const showPlaceholders = isEmpty && process.env.NODE_ENV !== 'production';
  const comingSoon = isEmpty && !showPlaceholders;
  const cards: CategoryCard[] = showPlaceholders
    ? fallbackProductsForCategory(gender, category, 28).map((p) => ({
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

  const genderLabel = formatLabel(gender);
  const categoryLabel = formatLabel(category);
  const subtitle = SUBTITLES[category] ?? `Curated ${categoryLabel.toLowerCase()} for every day.`;

  const sizePool = Array.from(new Set(cards.flatMap((c) => c.sizes ?? [])));
  // Category filter is multi-select: checking another fit jumps to the
  // /shop/[gender] listing with both selected (?fits=). The current fit is
  // pre-checked via `active` (category-filters reads the active set from these
  // flags when productTypeBasePath is set).
  const productTypes = fits.map((f) => ({
    slug: f.slug,
    label: f.label,
    active: f.slug === category,
  }));
  const topsLike = ['sweatshirt', 'jacket', 'jackets', 'shorts'];
  const isPantsLike = !topsLike.some((t) => category.includes(t));

  return (
    <div className="w-full px-4 pt-28 pb-16 sm:px-6 lg:px-8 2xl:px-14">
      <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
        <Link href="/" className="transition-colors hover:text-ink">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link href={`/shop/${gender}`} className="transition-colors hover:text-ink">
          {genderLabel}
        </Link>
        <ChevronRight size={12} />
        <span className="text-ink">{categoryLabel}</span>
      </nav>

      <header className="mb-10 flex flex-col gap-2 border-b border-ink/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.25em] text-muted">
            {genderLabel}
          </p>
          <h1 className="font-serif text-4xl tracking-tight text-ink md:text-5xl">
            {categoryLabel}
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted">{subtitle}</p>
        </div>
        {!comingSoon && (
          <p className="text-xs uppercase tracking-[0.15em] text-muted">
            {cards.length} piece{cards.length === 1 ? '' : 's'}
          </p>
        )}
      </header>

      {comingSoon ? (
        <ComingSoon title={categoryLabel} />
      ) : (
        <CategoryGrid
          products={cards}
          productTypes={productTypes}
          productTypesHeading="Category"
          productTypeParam="fits"
          productTypeBasePath={`/shop/${gender}`}
          sizes={sizePool}
          sizesHeading={isPantsLike ? 'Waist' : 'Size'}
          showFootnote={showPlaceholders}
          footnote="Preview only. Real products load once the catalog syncs."
        />
      )}
    </div>
  );
}
