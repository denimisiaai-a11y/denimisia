'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Play, Pause } from 'lucide-react';
import { motion, useInView, useReducedMotion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '@/lib/utils';
import { WishlistButton } from '@/components/ui/wishlist-button';
import { StarBadge } from '@/components/ui/star-badge';

interface ProductData {
  id?: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage?: string;
  colourCount?: number;
  showStarBadge?: boolean;
}

interface BestSellersProps {
  products: ProductData[];
  /** Heading text. Defaults to the styled "Best Sellers." design. */
  title?: string;
}

const AUTOPLAY_MS = 6000;

export function BestSellers({ products, title }: BestSellersProps) {
  const shouldReduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { amount: 0.2, once: true });

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHoveringTrack, setIsHoveringTrack] = useState(false);
  const [perView, setPerView] = useState(3);
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    const updatePerView = () => {
      const w = window.innerWidth;
      if (w < 640) setPerView(1);
      else if (w < 1024) setPerView(2);
      else setPerView(3);
    };
    updatePerView();
    window.addEventListener('resize', updatePerView);
    return () => window.removeEventListener('resize', updatePerView);
  }, []);

  const maxIndex = Math.max(0, products.length - perView);

  const scrollTo = useCallback(
    (index: number) => {
      if (!scrollRef.current) return;
      const clamped = Math.max(0, Math.min(index, maxIndex));
      const track = scrollRef.current;
      const firstCard = track.firstElementChild as HTMLElement | null;
      if (!firstCard) return;
      const cardWidth = firstCard.getBoundingClientRect().width;
      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
      track.scrollTo({ left: clamped * (cardWidth + gap), behavior: 'smooth' });
      setActiveIndex(clamped);
    },
    [maxIndex],
  );

  useEffect(() => {
    setProgressKey((k) => k + 1);
  }, [activeIndex]);

  useEffect(() => {
    if (!isPlaying || isHoveringTrack || shouldReduceMotion || products.length <= perView) return;
    const id = window.setTimeout(() => {
      const next = activeIndex >= maxIndex ? 0 : activeIndex + 1;
      scrollTo(next);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [activeIndex, isPlaying, isHoveringTrack, shouldReduceMotion, perView, maxIndex, products.length, scrollTo]);

  useEffect(() => {
    const track = scrollRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const firstCard = track.firstElementChild as HTMLElement | null;
        if (!firstCard) return;
        const cardWidth = firstCard.getBoundingClientRect().width;
        const styles = window.getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        const idx = Math.round(track.scrollLeft / (cardWidth + gap));
        setActiveIndex((prev) => (prev === idx ? prev : Math.max(0, Math.min(idx, maxIndex))));
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [maxIndex]);

  const displayIndex = useMemo(() => activeIndex + 1, [activeIndex]);

  if (products.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      data-slot="home.bestsellers_section"
      data-slot-kind="product-section"
      className="relative overflow-hidden bg-ink py-24 text-paper md:py-32"
    >
      {/* Outlined ghost backdrop word */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, x: -80 }}
        animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -80 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute -top-6 left-0 right-0 z-0 select-none whitespace-nowrap text-[22vw] font-black uppercase leading-none tracking-tighter text-transparent md:text-[18vw]"
        style={{ WebkitTextStroke: '1px rgba(255,255,255,0.08)' }}
      >
        BESTSELLERS
      </motion.div>

      {/* Slow marquee eyebrow strip */}
      <div className="relative z-10 mb-12 overflow-hidden border-y border-paper/10 py-4">
        <div className="flex animate-marquee gap-12 whitespace-nowrap text-[0.7rem] font-medium uppercase tracking-[0.4em] text-paper/50">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="flex items-center gap-12">
              Proven Classics
              <span className="text-paper/30">&bull;</span>
              Fan Favourites
              <span className="text-paper/30">&bull;</span>
              Most Loved
              <span className="text-paper/30">&bull;</span>
            </span>
          ))}
        </div>
      </div>

      {/* Header row */}
      <div className="relative z-10 mx-auto mb-12 flex max-w-[1600px] items-end justify-between gap-6 px-6 md:mb-16 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="mb-4 block text-[0.7rem] font-medium uppercase tracking-[0.4em] text-paper/60">
            Proven Classics
          </span>
          <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter text-paper md:text-6xl lg:text-7xl">
            {title ? (
              title
            ) : (
              <>
                Best
                <br />
                <span className="italic font-serif font-light">Sellers.</span>
              </>
            )}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="hidden items-center gap-6 md:flex"
        >
          {/* Animated counter */}
          <div className="flex items-baseline gap-2 text-paper/70">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={displayIndex}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="inline-block text-2xl font-black tabular-nums text-paper md:text-3xl"
              >
                {String(displayIndex).padStart(2, '0')}
              </motion.span>
            </AnimatePresence>
            <span className="text-xs uppercase tracking-[0.3em]">
              / {String(products.length).padStart(2, '0')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? 'Pause autoplay' : 'Resume autoplay'}
            className="flex h-11 w-11 items-center justify-center border border-paper/30 text-paper transition-colors hover:border-paper hover:bg-paper hover:text-ink"
          >
            {isPlaying ? <Pause size={14} strokeWidth={1.5} /> : <Play size={14} strokeWidth={1.5} />}
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => scrollTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="Previous"
              className="flex h-11 w-11 items-center justify-center border border-paper/30 text-paper transition-all hover:border-paper hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => scrollTo(activeIndex + 1)}
              disabled={activeIndex >= maxIndex}
              aria-label="Next"
              className="flex h-11 w-11 items-center justify-center border border-paper/30 text-paper transition-all hover:border-paper hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Carousel track */}
      <div
        className="relative z-10"
        onMouseEnter={() => setIsHoveringTrack(true)}
        onMouseLeave={() => setIsHoveringTrack(false)}
      >
        <div
          ref={scrollRef}
          className="scrollbar-hide flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-6 pb-4 md:gap-8 md:px-12"
          style={{ scrollbarWidth: 'none' }}
        >
          {products.map((product, index) => (
            <BestSellerCard
              key={product.slug}
              product={product}
              rank={index + 1}
              isActive={index >= activeIndex && index < activeIndex + perView}
              perView={perView}
              inView={inView}
              revealIndex={index}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="relative z-10 mx-auto mt-10 flex max-w-[1600px] items-center gap-6 px-6 md:px-12">
          <div className="h-px flex-1 bg-paper/15">
            <motion.div
              key={progressKey}
              initial={{ width: '0%' }}
              animate={{
                width: isPlaying && !isHoveringTrack && !shouldReduceMotion ? '100%' : '0%',
              }}
              transition={{
                duration: isPlaying && !isHoveringTrack && !shouldReduceMotion ? AUTOPLAY_MS / 1000 : 0,
                ease: 'linear',
              }}
              className="h-px bg-paper"
            />
          </div>
          <span className="shrink-0 text-[10px] uppercase tracking-[0.3em] text-paper/50">
            Drag or swipe
          </span>
        </div>
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mt-16 flex justify-center md:mt-20"
      >
        <Link
          href="/collections/bestsellers"
          className="group relative inline-flex items-center gap-3 overflow-hidden border border-paper/40 px-10 py-4 text-xs font-medium uppercase tracking-[0.3em] text-paper transition-colors hover:border-paper"
        >
          <span className="absolute inset-0 -translate-x-full bg-paper transition-transform duration-500 ease-out group-hover:translate-x-0" />
          <span className="relative z-10 transition-colors duration-500 group-hover:text-ink">
            Shop All Best Sellers
          </span>
          <ArrowRight
            size={14}
            strokeWidth={1.5}
            className="relative z-10 transition-all duration-500 group-hover:translate-x-1 group-hover:text-ink"
          />
        </Link>
      </motion.div>
    </section>
  );
}

interface BestSellerCardProps {
  product: ProductData;
  rank: number;
  isActive: boolean;
  perView: number;
  inView: boolean;
  revealIndex: number;
}

function BestSellerCard({ product, rank, isActive, perView, inView, revealIndex }: BestSellerCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const displayImage = isHovered && product.hoverImage ? product.hoverImage : product.image;

  const basisClass =
    perView === 1
      ? 'min-w-[88%]'
      : perView === 2
        ? 'min-w-[calc((100%-1.5rem)/2)]'
        : 'min-w-[calc((100%-4rem)/3)]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
      transition={{
        duration: 0.9,
        delay: 0.2 + revealIndex * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`snap-start ${basisClass}`}
    >
      <Link
        href={`/products/${product.slug}`}
        className="group block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image container */}
        <div className="relative aspect-[3/4] overflow-hidden bg-[#0b0b0a]">
          {/* Ken-Burns wrapper on active */}
          <div
            className={`absolute inset-0 transition-transform duration-[1200ms] ease-out ${
              isActive ? 'animate-[kenBurns_9s_ease-in-out_infinite_alternate]' : ''
            } group-hover:scale-[1.06]`}
          >
            <Image
              src={displayImage}
              alt={product.name}
              fill
              className="object-cover transition-opacity duration-500"
              sizes="(max-width: 640px) 88vw, (max-width: 1024px) 45vw, 32vw"
            />
          </div>

          {/* Vignette on hover */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Rank number — giant outlined */}
          <span
            aria-hidden
            className="pointer-events-none absolute -left-2 top-2 select-none text-[7rem] font-black leading-none tracking-tighter text-transparent md:-left-3 md:top-4 md:text-[9rem]"
            style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.55)' }}
          >
            {String(rank).padStart(2, '0')}
          </span>

          {/* "Best seller" tag on top 3 */}
          {rank <= 3 && (
            <span className="absolute left-4 top-4 bg-paper px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-ink">
              Top {rank}
            </span>
          )}

          {product.id && <WishlistButton productId={product.id} variant="card" />}

          {product.showStarBadge && <StarBadge position="top-right" size="md" />}

          {/* Quick add */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute bottom-4 left-4 right-4 translate-y-4 bg-paper py-3.5 text-[10px] font-bold uppercase tracking-[0.25em] text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100"
          >
            Quick Add
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="truncate text-sm font-bold uppercase tracking-[0.15em] text-paper">
              {product.name}
            </h4>
            {product.colourCount !== undefined && product.colourCount > 0 && (
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.25em] text-paper/50">
                {product.colourCount} Colours
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums text-paper">
            {formatPrice(product.price)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
