import Image from 'next/image';
import Link from 'next/link';
import { PLACEHOLDER_BRAND_STORY } from '@/lib/placeholder-images';
import { fetchPageSlots, pickSlot, resolveSlotText, resolveSlotUrl } from '@/lib/page-slots';

export async function BrandStory() {
  const slots = await fetchPageSlots('home');
  const slot = pickSlot(slots, 'brand_story_backdrop');
  const { src, kind, poster } = resolveSlotUrl(slot, PLACEHOLDER_BRAND_STORY);
  const heading = resolveSlotText(slot, 'Made in Bangladesh.', 'heading');
  const body = resolveSlotText(
    slot,
    'Premium denim crafted with intention. Built to age gracefully with you, our garments represent the pinnacle of local manufacturing and global design standards.',
    'body',
  );
  const ctaLabel = resolveSlotText(slot, 'Our Story', 'ctaLabel');
  const ctaHref  = resolveSlotText(slot, '/about', 'ctaHref');

  return (
    <section
      data-slot="home.brand_story_backdrop"
      className="relative flex min-h-[480px] w-full items-center justify-center overflow-hidden md:h-[716px]"
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
          alt={slot?.altText ?? 'Denimisia brand story'}
          fill
          className="object-cover"
          sizes="100vw"
        />
      )}
      <div className="absolute inset-0 bg-ink/50" />
      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-8 px-6 text-center text-paper">
        <h2
          data-slot-field="heading"
          className="text-4xl font-black uppercase leading-[0.95] tracking-tighter md:text-6xl"
        >
          {heading}
        </h2>
        <p
          data-slot-field="body"
          className="max-w-2xl text-base font-normal leading-relaxed text-paper/90 md:text-lg"
        >
          {body}
        </p>
        <Link
          data-slot-field="ctaHref"
          href={ctaHref}
          className="mt-4 border-b border-paper pb-2 text-xs font-medium uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-70"
        >
          <span data-slot-field="ctaLabel">{ctaLabel}</span> &rarr;
        </Link>
      </div>
    </section>
  );
}
