'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SectionHeading } from '@/components/ui/section-heading';
import { WishlistButton } from '@/components/ui/wishlist-button';
import { StarBadge } from '@/components/ui/star-badge';

interface TrendingProduct {
  id?: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage?: string;
  showStarBadge?: boolean;
}

interface TrendingSectionProps {
  products: TrendingProduct[];
  /** Heading text. Defaults to "Trending". */
  title?: string;
  /** Maximum products to show. Defaults to all. */
  limit?: number;
}

const SUBTITLE_POOL = [
  'Streetwear Editorial',
  'Design Focus',
  'Night Series',
  'Life Essentials',
  'Field Notes',
  'Studio Capture',
  'Material Study',
];

export function TrendingSection({ products, title = 'Trending', limit }: TrendingSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shown = typeof limit === 'number' && limit > 0 ? products.slice(0, limit) : products;

  if (shown.length === 0) return null;

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.firstElementChild?.clientWidth ?? 450;
    const distance = cardWidth + 24;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  return (
    <section
      data-slot="home.trending_section"
      data-slot-kind="product-section"
      className="overflow-hidden bg-[var(--color-surface)] py-24 md:py-32"
    >
      <div className="mx-auto mb-16 max-w-[1440px] px-6 md:px-12">
        <SectionHeading
          eyebrow="Currently Seen"
          rightSlot={
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => scroll('left')}
                aria-label="Scroll left"
                className="flex h-12 w-12 items-center justify-center border border-[var(--color-outline-variant)] text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                <ArrowLeft size={18} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                aria-label="Scroll right"
                className="flex h-12 w-12 items-center justify-center border border-[var(--color-outline-variant)] text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                <ArrowRight size={18} strokeWidth={1.5} />
              </button>
            </div>
          }
        >
          {title}
        </SectionHeading>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-6 overflow-x-auto px-6 md:px-12"
      >
        {shown.map((product, idx) => (
          <Link
            key={product.slug}
            href={`/products/${product.slug}`}
            className="group block min-w-[300px] cursor-pointer md:min-w-[450px]"
          >
            <div className="relative mb-6 aspect-[4/5] overflow-hidden bg-[var(--color-surface-low)]">
              <Image
                src={product.image}
                alt={product.name}
                width={450}
                height={563}
                className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              {product.id && <WishlistButton productId={product.id} variant="card" />}
              {product.showStarBadge && <StarBadge position="top-left" size="md" />}
            </div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-ink">
              {product.name}
            </h4>
            <p className="mt-2 text-xs uppercase tracking-widest text-[var(--color-secondary)]">
              {SUBTITLE_POOL[idx % SUBTITLE_POOL.length]}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-16 flex justify-center px-6 md:px-12">
        <Link
          href="/trending"
          className="inline-flex items-center justify-center bg-ink px-14 py-4 text-xs font-medium uppercase tracking-[0.25em] text-paper transition-opacity duration-300 hover:opacity-85"
        >
          View All Trending
        </Link>
      </div>
    </section>
  );
}
