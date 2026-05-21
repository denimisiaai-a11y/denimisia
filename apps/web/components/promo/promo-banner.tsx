import Image from 'next/image';
import Link from 'next/link';
import {
  fetchPromoBanners,
  type PromoBannerPosition,
  type PromoBannerRecord,
  type PromoPopupSize,
} from '@/lib/api';

interface PromoBannerProps {
  /** Which position bucket to render from. */
  readonly position: Exclude<PromoBannerPosition, 'popup'>;
}

// Per-position sizing presets driven by the banner's `popupSize` /
// `popupSizeMobile` fields. The TOP strip uses padding; MIDDLE/BOTTOM
// cards use a min-height. Mobile applies the second column on phones.
const TOP_STRIP_PADDING: Record<PromoPopupSize, { desktop: string; mobile: string }> = {
  compact:    { desktop: 'md:py-1.5', mobile: 'py-1' },
  medium:     { desktop: 'md:py-3',   mobile: 'py-2' },
  large:      { desktop: 'md:py-5',   mobile: 'py-3' },
  fullscreen: { desktop: 'md:py-10',  mobile: 'py-6' },
};

const CARD_HEIGHT: Record<PromoPopupSize, { desktop: string; mobile: string }> = {
  compact:    { desktop: 'md:h-52',         mobile: 'h-44' },
  medium:     { desktop: 'md:h-72',         mobile: 'h-56' },
  large:      { desktop: 'md:h-[28rem]',    mobile: 'h-72' },
  fullscreen: { desktop: 'md:h-[70vh]',     mobile: 'h-[55vh]' },
};

/**
 * Static promotional banner placement.
 *
 * Renders ALL active banners with the matching `position`, ordered by
 * `createdAt` desc (newest first). Returns null when no banners are
 * configured for the slot so the surrounding layout collapses naturally.
 *
 * Server component — fetched at render time with a 60s revalidation tag.
 */
export async function PromoBanner({ position }: PromoBannerProps) {
  const banners = await fetchPromoBanners();
  const matching = banners
    .filter((b) => b.position === position && b.isActive)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  if (matching.length === 0) return null;

  if (position === 'top') {
    // Compact strip above the navbar — single banner shown (newest).
    const first = matching[0];
    if (!first) return null;
    return <TopStrip banner={first} />;
  }

  // Middle / Bottom: card stack
  return (
    <section
      data-promo-position={position}
      className="w-full px-4 py-8 sm:px-6 md:px-8 md:py-12"
    >
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 md:grid-cols-2">
        {matching.map((b) => (
          <BannerCard key={b.id} banner={b} />
        ))}
      </div>
    </section>
  );
}

function TopStrip({ banner }: { readonly banner: PromoBannerRecord }) {
  const desktopPad = TOP_STRIP_PADDING[banner.popupSize]?.desktop ?? 'md:py-3';
  const mobilePad  = TOP_STRIP_PADDING[banner.popupSizeMobile]?.mobile ?? 'py-2';
  const inner = (
    <div className={`flex items-center justify-center gap-4 px-4 text-center text-xs uppercase tracking-[0.25em] text-paper sm:text-[11px] ${mobilePad} ${desktopPad}`}>
      <span className="font-bold">{banner.title}</span>
      {banner.subtitle && (
        <span className="hidden text-paper/80 sm:inline">· {banner.subtitle}</span>
      )}
    </div>
  );
  return (
    <div className="w-full bg-ink" data-promo-position="top">
      {banner.link ? (
        <Link href={banner.link} className="block hover:bg-ink/90">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

function BannerCard({ banner }: { readonly banner: PromoBannerRecord }) {
  const desktopH = CARD_HEIGHT[banner.popupSize]?.desktop ?? 'md:h-72';
  const mobileH  = CARD_HEIGHT[banner.popupSizeMobile]?.mobile ?? 'h-56';

  // Two layouts depending on the textOverlay flag.
  // - overlay = true (default): full-bleed image with text on a gradient
  //   floor.
  // - overlay = false: side-by-side card — image on the left half, text
  //   in a white panel on the right half. The whole card becomes the link.
  const body = banner.textOverlay !== false ? (
    <div className={`relative w-full overflow-hidden bg-muted-bg ${mobileH} ${desktopH}`}>
      {banner.image && (
        <Image
          src={banner.image}
          alt={banner.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent" />
      <div className="relative z-10 flex h-full w-full flex-col justify-end p-8 text-paper">
        <h3 className="text-xl font-black uppercase leading-tight tracking-tight sm:text-2xl">
          {banner.title}
        </h3>
        {banner.subtitle && (
          <p className="mt-2 max-w-md text-xs leading-relaxed text-paper/85 sm:text-sm">
            {banner.subtitle}
          </p>
        )}
      </div>
    </div>
  ) : (
    <div className={`grid w-full grid-cols-1 overflow-hidden bg-paper sm:grid-cols-2 ${mobileH} ${desktopH}`}>
      <div className="relative h-full w-full bg-muted-bg">
        {banner.image && (
          <Image
            src={banner.image}
            alt={banner.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 25vw"
          />
        )}
      </div>
      <div className="flex h-full flex-col justify-center p-8 text-ink">
        <h3 className="text-xl font-black uppercase leading-tight tracking-tight sm:text-2xl">
          {banner.title}
        </h3>
        {banner.subtitle && (
          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted sm:text-sm">
            {banner.subtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (banner.link) {
    return (
      <Link href={banner.link} className="group block">
        {body}
      </Link>
    );
  }
  return <div className="group">{body}</div>;
}
