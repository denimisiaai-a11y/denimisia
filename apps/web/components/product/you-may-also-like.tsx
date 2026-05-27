'use client';

import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { ProductCard } from '@/components/ui/product-card';
import { cn } from '@/lib/utils';

interface RelatedProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  images: string[];
  variants?: { color: string }[];
  showStarBadge?: boolean;
  activeCampaign?: { finalPrice: number; savingsPercent: number } | null;
}

interface YouMayAlsoLikeProps {
  recommended: RelatedProduct[];
  bestSellers: RelatedProduct[];
  newArrivals: RelatedProduct[];
}

type TabKey = 'recommended' | 'bestSellers' | 'newArrivals';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'bestSellers', label: 'Best Sellers' },
  { key: 'newArrivals', label: 'New Arrivals' },
];

const MIN_SLOTS = 4;

function countColors(product: RelatedProduct): number {
  if (!product.variants || product.variants.length === 0) return 1;
  return new Set(product.variants.map((v) => v.color)).size;
}

function padWithPlaceholders(
  list: RelatedProduct[],
  minSlots: number,
): Array<RelatedProduct | null> {
  const padded: Array<RelatedProduct | null> = [...list];
  while (padded.length < minSlots) padded.push(null);
  return padded;
}

function PlaceholderCard() {
  return (
    <div className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-surface-low)]">
        <div className="flex h-full items-center justify-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted/60">
            Coming Soon
          </span>
        </div>
      </div>
      <div className="mt-6 flex items-start justify-between gap-3">
        <h4 className="truncate text-xs font-bold uppercase tracking-widest text-muted/40">
          New arrival
        </h4>
        <span className="text-xs text-muted/40">—</span>
      </div>
    </div>
  );
}

export function YouMayAlsoLike({
  recommended,
  bestSellers,
  newArrivals,
}: YouMayAlsoLikeProps) {
  const [tab, setTab] = useState<TabKey>('recommended');
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const active = useMemo(() => {
    const map: Record<TabKey, RelatedProduct[]> = {
      recommended,
      bestSellers,
      newArrivals,
    };
    return padWithPlaceholders(map[tab], MIN_SLOTS);
  }, [tab, recommended, bestSellers, newArrivals]);

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, active]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: 'instant' as ScrollBehavior });
    updateScrollState();
  }, [tab, updateScrollState]);

  const scrollByPage = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.85, 240);
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <section className="relative border-t border-border/60 py-16 lg:py-20">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink">
          You May Also Like
        </p>
      </div>

      <div className="mb-10 flex justify-center gap-10">
        {TABS.map(({ key, label }) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={isActive}
              className={cn(
                'relative pb-2 text-sm transition-colors',
                isActive ? 'font-semibold text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 bg-red-600"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="relative px-4 sm:px-8 lg:px-14">
        <CarouselArrow
          direction="prev"
          disabled={!canScrollPrev}
          onClick={() => scrollByPage(-1)}
        />
        <CarouselArrow
          direction="next"
          disabled={!canScrollNext}
          onClick={() => scrollByPage(1)}
        />

        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {active.map((product, i) => (
            <div
              key={product ? product.id : `ph-${tab}-${i}`}
              className="w-[75%] flex-none snap-start sm:w-[45%] md:w-[32%] lg:w-[23.5%]"
            >
              {product ? (
                <ProductCard
                  productId={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.activeCampaign ? product.activeCampaign.finalPrice : Number(product.price)}
                  originalPrice={product.activeCampaign ? Number(product.price) : undefined}
                  image={product.images[0] ?? ''}
                  hoverImage={product.images[1]}
                  colourCount={countColors(product)}
                  starBadge={Boolean(product.showStarBadge)}
                  hideQuickAdd
                />
              ) : (
                <PlaceholderCard />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface CarouselArrowProps {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}

function CarouselArrow({ direction, disabled, onClick }: CarouselArrowProps) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? 'Previous products' : 'Next products'}
      className={cn(
        'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-white/95 text-ink shadow-sm backdrop-blur transition-all duration-300',
        'hover:border-ink hover:bg-ink hover:text-white',
        'disabled:pointer-events-none disabled:opacity-0',
        isPrev ? 'left-1 sm:left-2 lg:left-3' : 'right-1 sm:right-2 lg:right-3',
      )}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {isPrev ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  );
}
