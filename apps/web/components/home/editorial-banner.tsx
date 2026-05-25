import { EDITORIAL_BANNER_SLIDES } from '@/lib/placeholder-images';
import {
  fetchPageSlots,
  pickSlotGroup,
  resolveSlotText,
  resolveSlotUrl,
  type PageSlotRecord,
} from '@/lib/page-slots';
import { EditorialBannerClient, type EditorialSlide } from './editorial-banner.client';

function isSlotFilled(slot: PageSlotRecord): boolean {
  return Boolean(
    slot.asset?.publicUrl ||
      slot.heading ||
      slot.subheading ||
      slot.body,
  );
}

interface EditorialBannerProps {
  /**
   * Slot group key the banner reads from. Defaults to `home.editorial`.
   * Multiple instances of this section on the homepage can point at
   * different slot groups so each carousel shows different content.
   */
  readonly slotGroupKey?: string;
}

/**
 * Server wrapper — merges uploaded slot content with hardcoded fallbacks,
 * then hands a prepared slide array to the client animation component.
 *
 * Slide count is admin-driven: only slots with an uploaded asset or any text
 * content are rendered. When no admin slot is filled yet, the hardcoded
 * EDITORIAL_BANNER_SLIDES fallback keeps the section visually alive.
 */
export async function EditorialBanner({ slotGroupKey = 'home.editorial' }: EditorialBannerProps = {}) {
  const slots = await fetchPageSlots('home');
  const filled = pickSlotGroup(slots, slotGroupKey).filter(isSlotFilled);

  const slides: EditorialSlide[] = filled.length > 0
    ? filled.map((slot, i) => {
        const fb = EDITORIAL_BANNER_SLIDES[i] ?? EDITORIAL_BANNER_SLIDES[0];
        const { src, kind, poster } = resolveSlotUrl(slot, fb.image);
        return {
          slotKey:  slot.slotKey,
          image:    src,
          kind,
          poster,
          eyebrow:  resolveSlotText(slot, fb.eyebrow, 'subheading'),
          title:    resolveSlotText(slot, fb.title, 'heading'),
          subtitle: resolveSlotText(slot, fb.subtitle, 'body'),
          href:     resolveSlotText(slot, fb.href, 'ctaHref'),
          ctaLabel: resolveSlotText(slot, 'Discover', 'ctaLabel'),
          alt:      slot.altText ?? fb.title,
        };
      })
    : EDITORIAL_BANNER_SLIDES.map((fb, i) => ({
        slotKey:  `editorial_slide_${i + 1}`,
        image:    fb.image,
        kind:     'IMAGE' as const,
        poster:   null,
        eyebrow:  fb.eyebrow,
        title:    fb.title,
        subtitle: fb.subtitle,
        href:     fb.href,
        ctaLabel: 'Discover',
        alt:      fb.title,
      }));

  return <EditorialBannerClient slides={slides} />;
}
