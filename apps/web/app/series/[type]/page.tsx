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

interface Props {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  const copy = seriesTypeCopy(type);
  if (!copy) return { title: 'Series' };
  return { title: `${copy.title} — Series`, description: copy.subtitle };
}

export default async function SeriesTypePage({ params }: Props) {
  const { type } = await params;
  const copy = seriesTypeCopy(type);
  if (!copy) notFound();

  let data;
  try {
    data = await getProducts({ category: type, limit: 60 });
  } catch {
    data = { products: [], total: 0, page: 1, limit: 40, totalPages: 0 };
  }

  const usingPlaceholders = data.products.length === 0;
  const cards: CategoryCard[] = usingPlaceholders
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
        sizes: Array.from(new Set(p.variants.map((v) => v.size))),
        washes: Array.from(new Set(p.variants.map((v) => v.color))),
      }));

  const sizePool = Array.from(new Set(cards.flatMap((c) => c.sizes ?? [])));
  const subtypes = SERIES_TYPE_SUBTYPES[type] ?? [];
  const productTypes = subtypes.map((s) => ({
    slug: s.slug,
    label: s.label,
    href: `/series/${type}/${s.slug}`,
  }));

  return (
    <div>
      <div className="relative mt-20 h-[40vh] min-h-[280px] w-full overflow-hidden bg-ink">
        <Image
          src={copy.hero}
          alt={copy.title}
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
          <p className="text-xs uppercase tracking-[0.15em] text-muted">
            {cards.length} piece{cards.length === 1 ? '' : 's'}
          </p>
        </div>

        <CategoryGrid
          products={cards}
          productTypes={productTypes}
          productTypesHeading="Product type"
          sizes={sizePool}
          sizesHeading={type === 'pants' ? 'Waist' : 'Size'}
          showFootnote={usingPlaceholders}
          footnote="Showing curated preview — full assortment syncing soon."
        />
      </div>
    </div>
  );
}
