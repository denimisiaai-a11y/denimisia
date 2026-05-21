'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  fetchPromoBanners,
  type PromoBannerRecord,
} from '@/lib/api';

const DELAY_MS = 10 * 1000;              // 10 seconds
const SESSION_KEY = 'denimisia:promo-popup-seen';
const MOBILE_BREAKPOINT_PX = 768;        // matches Tailwind md:

/**
 * Time-delayed promotional popup.
 *
 * Behaviour:
 * - Fetches active banners on mount.
 * - Selects the most recent banner with position === 'popup'.
 * - Waits DELAY_MS, then shows a modal overlay.
 * - Dismissal is sticky for the rest of the browser tab session
 *   (sessionStorage); reopening the site in a new tab will show it again.
 * - If multiple banners have position === 'popup', the most recently
 *   created one wins. (Sort key is createdAt desc.)
 * - Bails silently when fetch fails or no popup banner is configured.
 */
export function PromoPopup() {
  const [banner, setBanner] = useState<PromoBannerRecord | null>(null);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track viewport so we can pick mobile vs desktop dimensions per banner.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[PromoPopup] mounted');
    if (typeof window === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Respect prior dismissal for this session.
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') {
        // eslint-disable-next-line no-console
        console.log('[PromoPopup] gated by sessionStorage; clear with sessionStorage.removeItem("denimisia:promo-popup-seen")');
        return;
      }
    } catch {
      // sessionStorage can throw in private modes; ignore and continue.
    }

    let cancelled = false;
    void (async () => {
      const banners = await fetchPromoBanners();
      if (cancelled) return;
      const popups = banners
        .filter((b) => b.position === 'popup' && b.isActive)
        .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
      const pick = popups[0];
      // eslint-disable-next-line no-console
      console.log('[PromoPopup] fetched', { totalBanners: banners.length, popupBanners: popups.length, picked: pick?.title ?? null, delayMs: DELAY_MS });
      if (!pick) return;
      setBanner(pick);
      timer = setTimeout(() => {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.log('[PromoPopup] firing now');
          setOpen(true);
        }
      }, DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // ignore
    }
  };

  if (!open || !banner) return null;

  const widthPct  = isMobile
    ? (banner.popupWidthPctMobile ?? 95)
    : (banner.popupWidthPct ?? 95);
  const heightPct = isMobile
    ? (banner.popupHeightPctMobile ?? 0)
    : (banner.popupHeightPct ?? 0);
  const overlay   = banner.textOverlay;
  const imageFitClass = banner.imageFit === 'contain' ? 'object-contain' : 'object-cover';

  const modalStyle: React.CSSProperties = {
    width:  `${widthPct}vw`,
    maxHeight: heightPct > 0 ? `${heightPct}vh` : '92vh',
    ...(heightPct > 0 && { height: `${heightPct}vh` }),
  };

  const content = (
    <div
      className="relative overflow-hidden bg-paper text-ink shadow-2xl"
      style={modalStyle}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close promotion"
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center bg-paper/90 text-ink transition-colors hover:bg-paper"
      >
        <span className="text-2xl leading-none" aria-hidden>×</span>
      </button>

      {overlay ? (
        // Overlay layout: image fills the modal, text floats over a
        // gradient backdrop pinned to the bottom. When the outer modal has
        // an explicit height, this fills it; in auto mode the aspect ratio
        // gives the modal a natural size.
        <div className={`relative w-full bg-muted-bg ${heightPct > 0 ? 'h-full' : 'aspect-[16/9]'}`}>
          {banner.image && (
            <Image
              src={banner.image}
              alt={banner.title}
              fill
              className={imageFitClass}
              sizes="(max-width: 768px) 95vw, 100vw"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-8 py-10 text-paper sm:px-14 sm:py-14 md:px-20 md:py-20">
            <h2 className="max-w-3xl text-3xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-6xl">
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-paper/85 sm:text-lg md:mt-5">
                {banner.subtitle}
              </p>
            )}
            {banner.link && (
              <div className="mt-6 md:mt-8">
                <Link
                  href={banner.link}
                  onClick={dismiss}
                  className="inline-flex items-center justify-center bg-paper px-12 py-4 text-xs font-medium uppercase tracking-[0.25em] text-ink transition-opacity hover:opacity-85"
                >
                  Discover
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Side-by-side layout: image 60% on desktop, text 40% on white panel.
        // Stacks vertically on mobile with the image height capped per the
        // mobile size preset so the CTA stays in the viewport.
        <div className="grid h-full grid-cols-1 overflow-y-auto md:grid-cols-[3fr_2fr]">
          <div className={`relative flex w-full items-center justify-center bg-muted-bg ${heightPct > 0 ? 'h-full md:h-full' : 'aspect-[4/3] max-h-[55vh] md:aspect-[3/4] md:max-h-none'}`}>
            {banner.image && (
              <Image
                src={banner.image}
                alt={banner.title}
                fill
                className={imageFitClass}
                sizes="(max-width: 768px) 95vw, 60vw"
                priority
              />
            )}
          </div>

          <div className="flex flex-col justify-center px-8 py-8 sm:px-12 sm:py-12 md:px-14 md:py-16">
            <h2 className="text-3xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="mt-4 text-base leading-relaxed text-muted md:mt-5 md:text-lg">
                {banner.subtitle}
              </p>
            )}
            {banner.link && (
              <div className="mt-6 md:mt-8">
                <Link
                  href={banner.link}
                  onClick={dismiss}
                  className="inline-flex items-center justify-center bg-ink px-12 py-4 text-xs font-medium uppercase tracking-[0.25em] text-paper transition-opacity hover:opacity-85"
                >
                  Discover
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={banner.title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div onClick={(e) => e.stopPropagation()}>{content}</div>
    </div>
  );
}
