import type { Collection } from '@/lib/collections';

interface Props {
  readonly collection: Collection;
}

export function PromoBanner({ collection }: Props) {
  if (collection.type !== 'PROMO' || !collection.promoCode) return null;

  return (
    <div className="border border-[#D4A853]/40 bg-[#D4A853]/10 px-6 py-4 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#D4A853]">
        Promo · auto-applies at checkout
      </p>
      <p className="mt-2 font-serif text-2xl tracking-tight text-ink">
        Code {collection.promoCode}
      </p>
      {collection.subtitle && (
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
          {collection.subtitle}
        </p>
      )}
    </div>
  );
}
