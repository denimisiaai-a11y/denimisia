import Image from 'next/image';
import Link from 'next/link';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';
import { fetchPageSlots, pickSlot, resolveSlotText, resolveSlotUrl } from '@/lib/page-slots';

export async function HeroSection() {
  const slots = await fetchPageSlots('home');
  const slot = pickSlot(slots, 'hero_main');
  const { src, kind, poster } = resolveSlotUrl(slot, PLACEHOLDER_HERO);
  const heading  = resolveSlotText(slot, 'Raw Collection', 'heading');
  const sub      = resolveSlotText(slot, 'A study in form, texture, and understated luxury.', 'subheading');
  const ctaLabel = resolveSlotText(slot, 'Explore the Collection', 'ctaLabel');
  const ctaHref  = resolveSlotText(slot, '/collections/spring26', 'ctaHref');
  const alt      = slot?.altText ?? 'Denimisia Spring 2026 Collection';

  return (
    <section
      data-slot="home.hero_main"
      className="relative flex h-screen w-full items-center justify-center"
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
          priority
          className="object-cover"
          sizes="100vw"
        />
      )}
      <div className="absolute inset-0 bg-ink/40" />
      <div className="relative z-10 flex max-w-4xl flex-col items-center gap-6 px-4 text-center text-paper">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.4em] text-paper/80 sm:text-xs">
          Spring / Summer 2026
        </p>
        <h1
          data-slot-field="heading"
          className="text-5xl font-black uppercase leading-[0.9] tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl"
        >
          {heading}
        </h1>
        <p
          data-slot-field="subheading"
          className="mt-2 max-w-2xl text-base font-normal leading-relaxed text-paper/90 md:text-lg"
        >
          {sub}
        </p>
        <Link
          data-slot-field="ctaHref"
          href={ctaHref}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-paper px-12 py-5 text-xs font-medium uppercase tracking-[0.2em] text-ink transition-colors duration-300 hover:bg-white"
        >
          <span data-slot-field="ctaLabel">{ctaLabel}</span>
        </Link>
      </div>
    </section>
  );
}
