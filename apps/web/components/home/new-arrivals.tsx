import Link from 'next/link';
import { NewArrivalsGrid } from '@/components/home/new-arrivals-grid';

interface ProductData {
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage?: string;
  colourCount?: number;
}

interface NewArrivalsProps {
  products: ProductData[];
  /** Heading text. Defaults to "New Arrivals". */
  title?: string;
  /** Maximum products to show. Defaults to all. */
  limit?: number;
}

export function NewArrivals({ products, title = 'New Arrivals', limit }: NewArrivalsProps) {
  const shown = typeof limit === 'number' && limit > 0 ? products.slice(0, limit) : products;
  if (shown.length === 0) return null;

  return (
    <section
      data-slot="home.new_arrivals_section"
      data-slot-kind="product-section"
      className="w-full px-4 py-24 sm:px-6 md:px-8 md:py-32 2xl:px-12"
    >
      <div className="mb-16 flex items-end justify-between gap-6">
        <div className="text-left">
          <span className="mb-3 block text-[0.85rem] font-medium uppercase tracking-[0.3em] text-[var(--color-secondary)]">
            Curated Selection
          </span>
          <h2
            data-slot-field="heading"
            className="text-4xl font-black uppercase leading-[0.95] tracking-tighter text-ink md:text-5xl lg:text-6xl"
          >
            {title}
          </h2>
        </div>
        <div className="shrink-0 pb-2">
          <Link
            href="/new-arrivals"
            className="border-b border-ink pb-1 text-xs font-medium uppercase tracking-[0.2em] text-ink"
          >
            Shop All
          </Link>
        </div>
      </div>
      <NewArrivalsGrid products={shown} />

      <div className="mt-20 flex justify-center">
        <Link
          href="/new-arrivals"
          className="inline-flex items-center justify-center bg-ink px-14 py-4 text-xs font-medium uppercase tracking-[0.25em] text-paper transition-opacity duration-300 hover:opacity-85"
        >
          View All
        </Link>
      </div>
    </section>
  );
}
