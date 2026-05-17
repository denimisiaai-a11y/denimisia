import { EDITORIAL_BANNER_SLIDES } from '@/lib/placeholder-images';
import { fetchPageSlots, pickSlotGroup, resolveSlotText, resolveSlotUrl } from '@/lib/page-slots';
import { EditorialBannerClient, type EditorialSlide } from './editorial-banner.client';

/**
 * Server wrapper — merges uploaded slot content with hardcoded fallbacks,
 * then hands a prepared slide array to the client animation component.
 */
export async function EditorialBanner() {
  const slots = await fetchPageSlots('home');
  const carouselSlots = pickSlotGroup(slots, 'home.editorial');

  const slides: EditorialSlide[] = EDITORIAL_BANNER_SLIDES.map((fb, i) => {
    const slot = carouselSlots[i];
    const { src, kind, poster } = resolveSlotUrl(slot, fb.image);
    return {
      slotKey:  slot?.slotKey ?? `editorial_slide_${i + 1}`,
      image:    src,
      kind,
      poster,
      eyebrow:  resolveSlotText(slot, fb.eyebrow, 'subheading'),
      title:    resolveSlotText(slot, fb.title, 'heading'),
      subtitle: resolveSlotText(slot, fb.subtitle, 'body'),
      href:     resolveSlotText(slot, fb.href, 'ctaHref'),
      ctaLabel: resolveSlotText(slot, 'Discover', 'ctaLabel'),
      alt:      slot?.altText ?? fb.title,
    };
  });

  return <EditorialBannerClient slides={slides} />;
}
