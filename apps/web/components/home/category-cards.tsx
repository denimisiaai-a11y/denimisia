import Image from 'next/image';
import Link from 'next/link';
import { CATEGORY_CARDS } from '@/lib/constants';
import { fetchPageSlots, pickSlotGroup, resolveSlotText, resolveSlotUrl } from '@/lib/page-slots';

export async function CategoryCards() {
  const slots = await fetchPageSlots('home');
  const cardSlots = pickSlotGroup(slots, 'home.category_cards');

  const cards = CATEGORY_CARDS.map((card, i) => {
    const slot = cardSlots[i];
    const { src } = resolveSlotUrl(slot, card.image);
    return {
      slotKey: slot?.slotKey ?? `category_card_${i + 1}`,
      href:    resolveSlotText(slot, card.href, 'ctaHref'),
      label:   resolveSlotText(slot, card.label, 'heading'),
      subtitle: resolveSlotText(slot, card.subtitle, 'subheading'),
      image:   src,
      alt:     slot?.altText ?? card.label,
    };
  });

  return (
    <section className="denimisia-category-gallery grid grid-cols-1 md:h-[696px] md:grid-cols-3">
      {cards.map((card) => (
        <Link
          key={card.slotKey}
          data-slot={`home.${card.slotKey}`}
          data-slot-field="ctaHref"
          href={card.href}
          className="group relative h-[532px] overflow-hidden md:h-full"
        >
          <Image
            data-slot-field="media"
            src={card.image}
            alt={card.alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent opacity-40" />
          <div className="absolute bottom-12 left-12">
            <h3
              data-slot-field="heading"
              className="text-2xl font-bold uppercase tracking-[0.3em] text-paper"
            >
              {card.label}
            </h3>
            <p
              data-slot-field="subheading"
              className="mt-2 text-xs uppercase tracking-widest text-paper/70"
            >
              {card.subtitle}
            </p>
          </div>
        </Link>
      ))}
    </section>
  );
}
