'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchPageSlots,
  pickSlot,
  resolveSlotUrl,
  type PageSlotRecord,
} from '@/lib/page-slots';

interface Fit {
  label: string;
  slug: string;
  image: string;
}

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

const FITS: Fit[] = [
  { label: 'Cargo', slug: 'cargo', image: U('1594633312681-425c7b97ccd1') },
  { label: 'Culotte', slug: 'culotte', image: U('1534528741775-53994a69daeb') },
  { label: 'Flare', slug: 'flare', image: U('1514995669114-6081e934b693') },
  { label: 'Wide Leg', slug: 'wide-leg', image: U('1604176354204-9268737828e4') },
  { label: 'Mom', slug: 'mom', image: U('1591047139829-d91aecb6caea') },
  { label: 'Jegging', slug: 'jegging', image: U('1515886657613-9f3515b0c78f') },
  { label: 'Slouchy', slug: 'slouchy', image: U('1485462537746-965f33f7f6a7') },
  { label: 'Skinny', slug: 'skinny', image: U('1542272604-787c3835535d') },
  { label: 'Straight', slug: 'straight', image: U('1491553895911-0055eca6402d') },
  { label: 'Sweatshirt', slug: 'sweatshirt', image: U('1556906781-9a412961c28c') },
  { label: 'Jacket', slug: 'jacket', image: U('1548142813-c348350df52b') },
];

function slotKeyForFit(slug: string): string {
  // Must match the slot key encoding in apps/api/src/modules/media/media.config.ts
  return `fit_${slug.replace(/-/g, '_')}`;
}

export function FitCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shopSlots, setShopSlots] = useState<readonly PageSlotRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPageSlots('shop')
      .then((slots) => {
        if (!cancelled) setShopSlots(slots);
      })
      .catch(() => {
        // Fall back to hardcoded fit images — slot fetch is best-effort.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.firstElementChild?.clientWidth ?? 220;
    const distance = cardWidth + 24;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative mx-auto max-w-[1440px] px-6 pt-28 pb-8 lg:px-12">
      <p className="mb-6 text-center text-xs uppercase tracking-[0.3em] text-muted">
        Shop by Fit
      </p>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-[calc(50%+14px)] items-center justify-center rounded-full bg-ink text-paper shadow-md transition-opacity duration-300 hover:opacity-85"
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          className="absolute right-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-[calc(50%+14px)] items-center justify-center rounded-full bg-ink text-paper shadow-md transition-opacity duration-300 hover:opacity-85"
        >
          <ChevronRight size={20} strokeWidth={1.75} />
        </button>

        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-6 overflow-x-auto scroll-smooth"
        >
          {FITS.map((fit) => {
            const slot = pickSlot(shopSlots, slotKeyForFit(fit.slug));
            const { src } = resolveSlotUrl(slot, fit.image);
            return (
              <Link
                key={fit.slug}
                href={`/shop/women/${fit.slug}`}
                className="group block min-w-[180px] flex-shrink-0 md:min-w-[220px]"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-surface-low)]">
                  <Image
                    data-slot-field="media"
                    data-slot={`shop.${slotKeyForFit(fit.slug)}`}
                    src={src}
                    alt={slot?.altText ?? `${fit.label} fit`}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 18vw"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/10" />
                </div>
                <p className="mt-4 text-center text-xs font-medium uppercase tracking-[0.25em] text-ink">
                  {fit.label}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
