'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface EditorialSlide {
  readonly slotKey: string;
  readonly image: string;
  readonly kind: 'IMAGE' | 'VIDEO';
  readonly poster: string | null;
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly ctaLabel: string;
  readonly alt: string;
}

const SLIDE_DURATION_MS = 3200;

interface EditorialBannerClientProps {
  readonly slides: readonly EditorialSlide[];
}

export function EditorialBannerClient({ slides }: EditorialBannerClientProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <section
      className="relative h-[75vh] w-full overflow-hidden bg-ink"
      aria-roledescription="carousel"
      aria-label="Editorial campaign highlights"
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.slotKey}
            data-slot={`home.${slide.slotKey}`}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${
              active ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!active}
          >
            {slide.kind === 'VIDEO' ? (
              <video
                data-slot-field="media"
                src={slide.image}
                poster={slide.poster ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <Image
                data-slot-field="media"
                src={slide.image}
                alt={slide.alt}
                fill
                priority={i === 0}
                className={`object-cover transition-transform duration-[6000ms] ease-out ${
                  active ? 'scale-105' : 'scale-100'
                }`}
                sizes="100vw"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-ink/20 via-ink/35 to-ink/55" />
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center text-paper">
              <p
                data-slot-field="subheading"
                className={`text-[0.65rem] font-medium uppercase tracking-[0.45em] text-paper/80 transition-all duration-700 sm:text-xs ${
                  active ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                {slide.eyebrow}
              </p>
              <h2
                data-slot-field="heading"
                className={`max-w-4xl text-4xl font-black uppercase leading-[0.95] tracking-tight transition-all duration-700 delay-100 sm:text-5xl md:text-6xl lg:text-7xl ${
                  active ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                }`}
              >
                {slide.title}
              </h2>
              <p
                data-slot-field="body"
                className={`max-w-xl text-sm font-normal leading-relaxed text-paper/85 transition-all duration-700 delay-200 md:text-base ${
                  active ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                {slide.subtitle}
              </p>
              <Link
                data-slot-field="ctaHref"
                href={slide.href}
                className={`mt-4 inline-flex items-center justify-center bg-paper px-11 py-4 text-[11px] font-medium uppercase tracking-[0.3em] text-ink transition-all duration-700 delay-300 hover:bg-white ${
                  active ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                <span data-slot-field="ctaLabel">{slide.ctaLabel}</span>
              </Link>
            </div>
          </div>
        );
      })}

      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4">
        {slides.map((slide, i) => (
          <button
            key={slide.slotKey}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            className="group relative h-3 w-12 cursor-pointer"
          >
            <span className="absolute inset-x-0 top-1/2 block h-[2px] -translate-y-1/2 bg-paper/40 transition-colors group-hover:bg-paper/70" />
            <span
              className={`absolute left-0 top-1/2 block h-[2px] -translate-y-1/2 bg-paper transition-[width] ease-linear ${
                i === index ? 'w-full' : 'w-0'
              }`}
              style={{
                transitionDuration: i === index ? `${SLIDE_DURATION_MS}ms` : '0ms',
              }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
