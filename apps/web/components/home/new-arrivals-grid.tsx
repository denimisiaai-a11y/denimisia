'use client';

import Image from 'next/image';
import { useState } from 'react';
import { formatPrice } from '@/lib/utils';
import { ProductQuickView } from './product-quick-view';
import { WishlistButton } from '@/components/ui/wishlist-button';
import { StarBadge } from '@/components/ui/star-badge';
import { Carousel } from '@/components/mobile/carousel';
import { prefetchProduct } from '@/lib/product-prefetch';

interface ProductData {
  id?: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage?: string;
  colourCount?: number;
  showStarBadge?: boolean;
}

interface NewArrivalsGridProps {
  products: ProductData[];
}

export function NewArrivalsGrid({ products }: NewArrivalsGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const active = openIndex !== null ? products[openIndex] : null;
  const related =
    openIndex !== null
      ? [
          ...products.slice(openIndex + 1),
          ...products.slice(0, openIndex),
        ].slice(0, 4)
      : [];

  const renderCell = (product: ProductData, index: number) => {
    const display =
      hoverIndex === index && product.hoverImage ? product.hoverImage : product.image;
    return (
      <div
        key={product.slug}
        role="button"
        tabIndex={0}
        onClick={() => setOpenIndex(index)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpenIndex(index);
          }
        }}
        onMouseEnter={() => {
          setHoverIndex(index);
          void prefetchProduct(product.slug);
        }}
        onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
        onFocus={() => void prefetchProduct(product.slug)}
        onTouchStart={() => void prefetchProduct(product.slug)}
        className="group block cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        aria-label={`Quick view ${product.name}`}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-surface-low)]">
          <Image
            src={display}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 65vw, (max-width: 1024px) 33vw, 25vw"
          />
          <span className="pointer-events-none absolute bottom-4 left-4 right-4 bg-ink py-3 text-center text-[10px] font-medium uppercase tracking-widest text-paper opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            Quick View
          </span>
          {product.id && <WishlistButton productId={product.id} variant="card" />}
          {product.showStarBadge && <StarBadge position="top-left" size="sm" />}
        </div>

        <div className="mt-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate text-xs font-bold uppercase tracking-widest text-ink">
              {product.name}
            </h4>
            {product.colourCount && product.colourCount > 0 ? (
              <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-secondary)]">
                {product.colourCount} Colours
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-xs font-medium text-ink">
            {formatPrice(product.price)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile: swipeable carousel */}
      <div className="md:hidden -mx-4">
        <Carousel variant="snap" gap={12} slideWidth="65vw">
          {products.map((p, i) => renderCell(p, i))}
        </Carousel>
      </div>

      {/* Desktop: 4-col grid (unchanged) */}
      <div className="hidden md:grid md:grid-cols-4 md:gap-x-6 md:gap-y-16 lg:gap-x-8">
        {products.map((p, i) => renderCell(p, i))}
      </div>

      {active ? (
        <ProductQuickView
          product={active}
          related={related}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  );
}
