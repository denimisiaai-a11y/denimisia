/**
 * Reusable hero slot renderer.
 *
 * Handles:
 * - image vs video switch
 * - data-slot / data-slot-field tagging for the admin draft listener
 * - graceful fallback to a provided placeholder when no asset is uploaded yet
 * - optional CTA rendering with slot-bound label + href
 *
 * Usage:
 *   <SlotHero
 *     pageKey="about"
 *     slotKey="about_hero"
 *     fallbackImage={ABOUT_HERO_FALLBACK}
 *     fallbackHeading="Denim with a point of view."
 *   />
 */

import Image from 'next/image';
import Link from 'next/link';
import {
  fetchPageSlots,
  pickSlot,
  resolveSlotText,
  resolveSlotUrl,
  type PageSlotRecord,
} from '@/lib/page-slots';

export interface SlotHeroProps {
  readonly pageKey: string;
  readonly slotKey: string;
  readonly fallbackImage: string;
  readonly fallbackHeading?: string;
  readonly fallbackSubheading?: string;
  readonly fallbackCtaLabel?: string;
  readonly fallbackCtaHref?: string;
  readonly height?: string;
  readonly overlay?: boolean;
  readonly textAlign?: 'left' | 'center';
  readonly priority?: boolean;
  readonly className?: string;
  /** Optional already-fetched slots to avoid re-fetching. */
  readonly preloadedSlots?: readonly PageSlotRecord[];
}

export async function SlotHero(props: SlotHeroProps) {
  const slots = props.preloadedSlots ?? (await fetchPageSlots(props.pageKey));
  const slot = pickSlot(slots, props.slotKey);
  const { src, kind, poster } = resolveSlotUrl(slot, props.fallbackImage);
  const heading    = resolveSlotText(slot, props.fallbackHeading ?? '', 'heading');
  const subheading = resolveSlotText(slot, props.fallbackSubheading ?? '', 'subheading');
  const ctaLabel   = resolveSlotText(slot, props.fallbackCtaLabel ?? '', 'ctaLabel');
  const ctaHref    = resolveSlotText(slot, props.fallbackCtaHref ?? '', 'ctaHref');
  const alt        = slot?.altText ?? heading;
  const showOverlay = props.overlay !== false;
  const align = props.textAlign ?? 'center';

  return (
    <section
      data-slot={`${props.pageKey}.${props.slotKey}`}
      className={`relative flex w-full items-center overflow-hidden ${
        align === 'center' ? 'justify-center text-center' : 'justify-start text-left'
      } ${props.height ?? 'h-[60vh]'} ${props.className ?? ''}`}
    >
      {kind === 'VIDEO' ? (
        <video
          data-slot-field="media"
          src={src}
          poster={poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Image
          data-slot-field="media"
          src={src}
          alt={alt}
          fill
          priority={props.priority}
          className="object-cover"
          sizes="100vw"
        />
      )}
      {showOverlay && <div className="absolute inset-0 bg-ink/40" />}
      <div className={`relative z-10 flex max-w-4xl flex-col gap-4 px-6 text-paper ${
        align === 'center' ? 'items-center' : 'items-start'
      }`}>
        {heading && (
          <h1
            data-slot-field="heading"
            className="text-4xl font-black uppercase leading-[0.95] tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {heading}
          </h1>
        )}
        {subheading && (
          <p
            data-slot-field="subheading"
            className="max-w-2xl text-sm font-normal leading-relaxed text-paper/90 md:text-base"
          >
            {subheading}
          </p>
        )}
        {ctaLabel && ctaHref && (
          <Link
            data-slot-field="ctaHref"
            href={ctaHref}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-paper px-10 py-4 text-xs font-medium uppercase tracking-[0.2em] text-ink transition-colors duration-300 hover:bg-white"
          >
            <span data-slot-field="ctaLabel">{ctaLabel}</span>
          </Link>
        )}
      </div>
    </section>
  );
}
