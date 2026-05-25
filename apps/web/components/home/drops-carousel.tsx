'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Collection } from '@/lib/collections';

interface Props {
  readonly collections: Collection[];
}

const AUTO_ROTATE_MS = 6000;

export function DropsCarousel({ collections }: Props) {
  const [index, setIndex] = useState(0);
  const total = collections.length;

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;
    const id = window.setInterval(next, AUTO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [next, total]);

  if (total === 0) return null;

  return (
    <section className="relative bg-ink text-paper">
      <div className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
        {collections.map((c, i) => {
          const hero = c.heroImageDesktop ?? c.image;
          if (!hero) return null;
          return (
            <div
              key={c.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <Image
                src={hero}
                alt={c.name}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
              <div className="relative z-10 flex h-full flex-col justify-center px-8 md:px-16">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-paper/70">
                  {c.type === 'DROP' ? 'New drop' : c.type === 'PROMO' ? 'Promo' : 'Featured edit'}
                </p>
                <h2 className="max-w-2xl font-serif text-4xl tracking-tight md:text-6xl">{c.name}</h2>
                {c.subtitle && (
                  <p className="mt-4 max-w-md text-sm uppercase tracking-[0.25em] text-paper/85">
                    {c.subtitle}
                  </p>
                )}
                <Link
                  href={`/collections/${c.slug}`}
                  className="mt-8 inline-block w-fit border border-paper px-6 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-paper transition-colors hover:bg-paper hover:text-ink"
                >
                  Shop the drop →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {collections.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show drop ${i + 1}`}
              className={`h-1 w-8 transition-colors ${
                i === index ? 'bg-paper' : 'bg-paper/30 hover:bg-paper/60'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
