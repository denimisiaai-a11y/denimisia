'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { ImageWithFallback } from './image-with-fallback';
import { StarBadge } from './star-badge';
import { WishlistButton } from './wishlist-button';

interface ProductCardProps {
  productId?: string;
  name: string;
  slug: string;
  /** Current sticker price the customer pays. If a campaign discount
   *  applies, this is the campaign's `finalPrice`. */
  price: number;
  /** Original (pre-discount) price. When set AND greater than `price`,
   *  it renders as strikethrough alongside the discounted price and a
   *  small "-N%" pill appears on the card. */
  originalPrice?: number;
  image: string;
  hoverImage?: string;
  colourCount?: number;
  rating?: number;
  reviewCount?: number;
  hideQuickAdd?: boolean;
  hideWishlist?: boolean;
  /** Renders a ★ badge in the top-left corner when true. Set by admins
   *  per-product via the new-product / edit-product Placement section. */
  starBadge?: boolean;
}

export function ProductCard({
  productId,
  name,
  slug,
  price,
  originalPrice,
  image,
  hoverImage,
  colourCount,
  rating,
  reviewCount,
  hideQuickAdd = false,
  hideWishlist = false,
  starBadge = false,
}: ProductCardProps) {
  const hasDiscount =
    typeof originalPrice === 'number' && originalPrice > price;
  const savingsPercent = hasDiscount
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;
  const [isHovered, setIsHovered] = useState(false);
  const baseSrc = isHovered && hoverImage ? hoverImage : image;

  return (
    <Link
      href={`/products/${slug}`}
      className="group block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image container */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-surface-low)]">
        <ImageWithFallback
          originalSrc={baseSrc}
          variant="card"
          alt={name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {!hideQuickAdd && (
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="absolute bottom-4 left-4 right-4 bg-ink py-3 text-[10px] font-medium uppercase tracking-widest text-paper opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            Quick Add
          </button>
        )}
        {!hideWishlist && productId && (
          <WishlistButton productId={productId} variant="card" />
        )}
        {starBadge && <StarBadge position="top-left" size="sm" />}
        {hasDiscount && (
          <span className="absolute top-3 right-3 bg-ink px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-paper">
            −{savingsPercent}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-xs font-bold uppercase tracking-widest text-ink">
            {name}
          </h4>
          {rating !== undefined && (
            <div className="mt-1 flex items-center gap-1.5">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-[10px] ${
                      i < Math.round(rating) ? 'text-ink' : 'text-border'
                    }`}
                  >
                    &#9733;
                  </span>
                ))}
              </div>
              {reviewCount !== undefined && (
                <span className="text-[11px] text-[var(--color-secondary)]">
                  ({reviewCount})
                </span>
              )}
            </div>
          )}
          {colourCount !== undefined && colourCount > 0 && (
            <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-secondary)]">
              {colourCount} Colours
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs font-medium text-ink">
            {formatPrice(price)}
          </span>
          {hasDiscount && (
            <span className="ml-2 text-[11px] text-muted line-through">
              {formatPrice(originalPrice!)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
