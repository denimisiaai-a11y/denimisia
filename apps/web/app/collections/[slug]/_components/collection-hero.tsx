import Image from 'next/image';
import type { Collection } from '@/lib/collections';

interface Props {
  readonly collection: Collection;
}

function overlayClass(strength: number): string {
  // Map 0-100 to a Tailwind opacity range via inline style for fidelity.
  return '';
}

export function CollectionHero({ collection }: Props) {
  const { heroLayout, name, subtitle, description } = collection;
  const heroImage = collection.heroImageDesktop ?? collection.image;
  const heroMobile = collection.heroImageMobile ?? heroImage;
  const isLight = collection.heroTextColor === 'light';
  const textColorCls = isLight ? 'text-paper' : 'text-ink';
  const alignCls =
    collection.heroAlign === 'center'
      ? 'items-center text-center'
      : collection.heroAlign === 'right'
        ? 'items-end text-right'
        : 'items-start text-left';

  if (heroLayout === 'MINIMAL' || !heroImage) {
    return (
      <section
        style={{ backgroundColor: collection.backgroundColor ?? '#0a0a0a' }}
        className={`mt-20 flex min-h-[40vh] flex-col justify-center px-6 py-20 ${alignCls} ${textColorCls}`}
      >
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] opacity-70">
            {collection.type}
          </p>
          <h1 className="font-serif text-5xl tracking-tight md:text-7xl">{name}</h1>
          {subtitle && (
            <p className="mt-4 text-sm uppercase tracking-[0.25em] opacity-80">{subtitle}</p>
          )}
          {description && (
            <p className="mt-6 max-w-lg text-base leading-relaxed opacity-80">{description}</p>
          )}
        </div>
      </section>
    );
  }

  if (heroLayout === 'VIDEO' && collection.heroVideo) {
    return (
      <section className="relative mt-20 h-[70vh] min-h-[480px] w-full overflow-hidden bg-ink">
        <video
          src={collection.heroVideo}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: collection.heroOverlay / 100 }}
        />
        <div className={`relative z-10 flex h-full flex-col justify-center px-12 ${alignCls} ${textColorCls}`}>
          <h1 className="font-serif text-5xl tracking-tight md:text-7xl">{name}</h1>
          {subtitle && (
            <p className="mt-4 text-sm uppercase tracking-[0.25em] opacity-90">{subtitle}</p>
          )}
        </div>
      </section>
    );
  }

  if (heroLayout === 'SPLIT') {
    return (
      <section className="mt-20 grid min-h-[60vh] grid-cols-1 md:grid-cols-2">
        <div className="relative aspect-[4/5] md:aspect-auto">
          <Image src={heroImage} alt={name} fill priority sizes="50vw" className="object-cover" />
        </div>
        <div
          style={{ backgroundColor: collection.backgroundColor ?? '#0a0a0a' }}
          className={`flex flex-col justify-center px-8 py-16 md:px-16 ${alignCls} ${textColorCls}`}
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] opacity-70">
            {collection.type}
          </p>
          <h1 className="font-serif text-4xl tracking-tight md:text-6xl">{name}</h1>
          {subtitle && (
            <p className="mt-4 text-sm uppercase tracking-[0.25em] opacity-80">{subtitle}</p>
          )}
          {description && (
            <p className="mt-6 max-w-md text-sm leading-relaxed opacity-80">{description}</p>
          )}
        </div>
      </section>
    );
  }

  // Default: FULL_BLEED
  return (
    <section className="relative mt-20 h-[70vh] min-h-[480px] w-full overflow-hidden bg-ink">
      <picture>
        {heroMobile && heroMobile !== heroImage && (
          <source media="(max-width: 768px)" srcSet={heroMobile} />
        )}
        <Image
          src={heroImage}
          alt={name}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </picture>
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black"
        style={{ opacity: (collection.heroOverlay + 20) / 100 }}
      />
      <div className={`absolute inset-0 z-10 flex flex-col justify-end px-8 pb-16 md:px-16 md:pb-24 ${alignCls} ${textColorCls}`}>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] opacity-80">
          {collection.type === 'DROP' ? 'New drop' : collection.type}
        </p>
        <h1 className="font-serif text-5xl tracking-tight md:text-7xl">{name}</h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-sm uppercase tracking-[0.25em] opacity-90">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
