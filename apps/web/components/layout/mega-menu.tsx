'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { NavMenuSection } from '@/lib/constants';
import {
  fetchPageSlots,
  pickSlot,
  resolveSlotUrl,
  type PageSlotRecord,
} from '@/lib/page-slots';

interface FeaturedImage {
  src: string;
  alt: string;
  href: string;
  slotKey?: string;
}

interface MegaMenuProps {
  sections: NavMenuSection[];
  featuredImages?: FeaturedImage[];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onItemClick?: () => void;
}

export function MegaMenu({
  sections,
  featuredImages,
  onMouseEnter,
  onMouseLeave,
  onItemClick,
}: MegaMenuProps) {
  const [navSlots, setNavSlots] = useState<readonly PageSlotRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPageSlots('nav')
      .then((slots) => {
        if (!cancelled) setNavSlots(slots);
      })
      .catch(() => {
        // Mega-menu falls back to the hardcoded src when the slot fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveFeaturedSrc = (img: FeaturedImage): {
    src: string;
    alt: string;
  } => {
    if (!img.slotKey) return { src: img.src, alt: img.alt };
    const slot = pickSlot(navSlots, img.slotKey);
    const { src } = resolveSlotUrl(slot, img.src);
    return { src, alt: slot?.altText ?? img.alt };
  };

  return (
    <div
      className="absolute left-0 top-full w-screen bg-paper shadow-sm"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="mx-auto flex max-w-[1440px] gap-12 px-12 py-10">
        {/* Link sections */}
        <div className="flex flex-1 gap-12">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onItemClick}
                      className="group flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
                    >
                      <span>{item.label}</span>
                      {item.count !== undefined && (
                        <span className="text-xs text-muted/60">{item.count}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Featured images */}
        {featuredImages && featuredImages.length > 0 && (
          <div className="flex gap-4">
            {featuredImages.map((img) => {
              const resolved = resolveFeaturedSrc(img);
              return (
                <Link
                  key={img.href}
                  href={img.href}
                  onClick={onItemClick}
                  className="group relative block"
                >
                  <div className="relative h-[280px] w-[200px] overflow-hidden">
                    <Image
                      data-slot-field="media"
                      data-slot={img.slotKey ? `nav.${img.slotKey}` : undefined}
                      src={resolved.src}
                      alt={resolved.alt}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="200px"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
