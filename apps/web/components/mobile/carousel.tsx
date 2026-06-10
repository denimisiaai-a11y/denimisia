'use client';

import { Children, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

type Variant = 'snap' | 'gallery';

interface CarouselProps {
  /**
   * "snap" → pure CSS scroll-snap (default; zero-JS, 60fps everywhere).
   * "gallery" → embla-based, with programmatic control + dot indicators. Lazy-loaded.
   */
  variant?: Variant;
  /** Gap between slides in pixels. Default: 12. */
  gap?: number;
  /** Show dot indicators below the carousel. Default: false. */
  showDots?: boolean;
  /**
   * Slide width hint for snap variant. e.g. "80%", "240px", "min(280px, 80vw)".
   * Default: "min(280px, 80vw)".
   */
  slideWidth?: string;
  className?: string;
  children: ReactNode;
}

const CarouselGallery = dynamic(
  () => import('./carousel-gallery').then((m) => m.CarouselGallery),
  { ssr: false },
);

export function Carousel({
  variant = 'snap',
  gap = 12,
  showDots = false,
  slideWidth = 'min(280px, 80vw)',
  className,
  children,
}: CarouselProps) {
  if (variant === 'gallery') {
    return (
      <CarouselGallery gap={gap} showDots={showDots} className={className}>
        {children}
      </CarouselGallery>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex overflow-x-auto scrollbar-hide',
          'snap-x snap-mandatory',
          '[scroll-padding-inline-start:1rem]',
          '[overscroll-behavior-x:contain]',
          '[touch-action:pan-x]',
        )}
        style={{ gap: `${gap}px`, paddingInline: '1rem' }}
      >
        {Children.map(children, (child, i) => (
          <div
            key={i}
            className="snap-start shrink-0 [content-visibility:auto]"
            style={{ width: slideWidth }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
