import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getProducts } from '@/lib/api';
import { CategoryGrid, type CategoryCard } from '@/components/shop/category-grid';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { fallbackProducts } from '@/lib/placeholder-products';
import {
  seriesTypeCopy,
  seriesSubtypeCopy,
  SERIES_TYPE_SUBTYPES,
} from '@/lib/category-copy';
import { ComingSoon } from '@/components/shop/coming-soon';
import { noindexRobots } from '@/lib/seo/metadata';

interface Props {
  params: Promise<{ type: string; subtype: string }>;
}

function formatLabel(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, subtype } = await params;
  // Invalid type/subtype → the page notFound()s; noindex keeps the soft-404
  // (200, locked by root-layout streaming) out of the index.
  const isValid = SERIES_TYPE_SUBTYPES[type]?.some((s) => s.slug === subtype) ?? false;
  return {
    title: `${formatLabel(subtype)} — ${formatLabel(type)}`,
    description: seriesSubtypeCopy(subtype).subtitle,
    ...(isValid ? {} : { robots: noindexRobots }),
  };
}

export default async function SeriesSubtypePage({ params }: Props) {
  const { type, subtype } = await params;

  // A garbage type/subtype URL (/series/foo/bar) must 404, not render a thin
  // coming-soon page. Valid-but-empty subtypes fall through to "coming soon".
  const siblings = SERIES_TYPE_SUBTYPES[type];
  if (!siblings || !siblings.some((s) => s.slug === subtype)) {
    notFound();
  }

  const typeCopy = seriesTypeCopy(type);
  const subtitle = seriesSubtypeCopy(subtype).subtitle;

  let data;
  try {
    data = await getProducts({ category: `${type}-${subtype}`, limit: 60 });
  } catch {
    data = { products: [], total: 0, page: 1, limit: 40, totalPages: 0 };
  }

  const isEmpty = data.products.length === 0;
  // Placeholders are a local design-preview aid only; production shows a
  // branded "coming soon" state instead of fabricated, unclickable cards.
  const showPlaceholders = isEmpty && process.env.NODE_ENV !== 'production';
  const comingSoon = isEmpty && !showPlaceholders;
  const cards: CategoryCard[] = showPlaceholders
    ? fallbackProducts({
        key: `series-${type}-${subtype}`,
        title: formatLabel(subtype),
        categorySlug: `${type}-${subtype}`,
        adjectives: type === 'pants' ? 'pants' : 'tops',
        fit: subtype,
        count: 28,
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
  const productTypes = siblings.map((s) => ({
    slug: s.slug,
    label: s.label,
    active: s.slug === subtype,
    href: `/series/${type}/${s.slug}`,
  }));

  return (
    <div className="w-full px-4 pt-28 pb-16 sm:px-6 lg:px-8 2xl:px-14">
      <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
        <Link href="/" className="transition-colors hover:text-ink">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link href={`/series/${type}`} className="transition-colors hover:text-ink">
          {typeCopy?.title ?? formatLabel(type)}
        </Link>
        <ChevronRight size={12} />
        <span className="text-ink">{formatLabel(subtype)}</span>
      </nav>

      <header className="mb-10 flex flex-col gap-2 border-b border-ink/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.25em] text-muted">
            {typeCopy?.title ?? formatLabel(type)}
          </p>
          <h1 className="font-serif text-4xl tracking-tight text-ink md:text-5xl">
            {formatLabel(subtype)}
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
        <ComingSoon title={formatLabel(subtype)} />
      ) : (
        <CategoryGrid
          products={cards}
          productTypes={productTypes}
          productTypesHeading="Product type"
          sizes={sizePool}
          sizesHeading={type === 'pants' ? 'Waist' : 'Size'}
          showFootnote={showPlaceholders}
          footnote="Showing curated preview — full assortment syncing soon."
        />
      )}
    </div>
  );
}
