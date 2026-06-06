'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, ArrowRight, Heart, Truck, RefreshCcw, Star } from 'lucide-react';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { formatPrice } from '@/lib/utils';
import { NAV_FEATURED } from '@/lib/placeholder-images';
import { useSlotImage } from '@/lib/use-slot-image';
import { WishlistButton } from '@/components/ui/wishlist-button';

interface ProductData {
  id?: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage?: string;
  colourCount?: number;
}

interface BestsellersCollectionProps {
  products: ProductData[];
  isPlaceholder: boolean;
}

const SORT_OPTIONS = [
  { value: 'rank', label: 'Bestselling' },
  { value: 'new', label: 'Newest' },
  { value: 'price-asc', label: 'Price · Low to high' },
  { value: 'price-desc', label: 'Price · High to low' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export function BestsellersCollection({ products, isPlaceholder }: BestsellersCollectionProps) {
  const { src: parallaxHeroSrc, altText: parallaxHeroAlt } = useSlotImage(
    'collection-bestsellers',
    'bestsellers_parallax_hero',
    NAV_FEATURED.seriesBestSellers,
  );
  const [sort, setSort] = useState<SortValue>('rank');
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1.1, 1.3]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  const sorted = [...products].sort((a, b) => {
    switch (sort) {
      case 'price-asc':
        return a.price - b.price;
      case 'price-desc':
        return b.price - a.price;
      case 'new':
        return a.slug.localeCompare(b.slug);
      default:
        return 0;
    }
  });

  const rankMap = new Map(products.map((p, i) => [p.slug, i + 1]));

  return (
    <div className="bg-paper">
      {/* Editorial hero */}
      <section
        ref={heroRef}
        data-slot="collection-bestsellers.bestsellers_parallax_hero"
        className="relative mt-20 h-[85vh] min-h-[560px] w-full overflow-hidden bg-ink text-paper"
      >
        <motion.div
          style={{ y: heroY, scale: heroScale, opacity: heroOpacity }}
          className="absolute inset-0"
        >
          <Image
            data-slot-field="media"
            src={parallaxHeroSrc}
            alt={parallaxHeroAlt ?? 'Bestsellers hero'}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-60"
          />
        </motion.div>

        <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/30 to-ink" />

        {/* Vertical rule lines */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-paper/10 md:block"
        />

        {/* Outlined backdrop word */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute bottom-[-4vw] left-0 right-0 select-none whitespace-nowrap text-center text-[24vw] font-black uppercase leading-none tracking-tighter text-transparent"
          style={{ WebkitTextStroke: '1px rgba(255,255,255,0.08)' }}
        >
          BESTSELLERS
        </motion.div>

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="mb-6 block text-[0.7rem] font-medium uppercase tracking-[0.5em] text-paper/70">
              The Archive &middot; Proven Classics
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-black uppercase leading-[0.9] tracking-tighter text-paper"
            style={{ fontSize: 'clamp(3rem, 10vw, 8rem)' }}
          >
            Best
            <br />
            <span className="font-serif font-light italic">Sellers.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-xl text-sm leading-relaxed text-paper/75 md:text-base"
          >
            The pieces our community keeps coming back for. Ranked by reorders, restocks, and
            time on waitlist &mdash; the cuts we&apos;ll never retire.
          </motion.p>

          {/* Stat row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 grid grid-cols-3 gap-8 border-y border-paper/15 px-8 py-6 md:mt-14 md:gap-16"
          >
            <HeroStat value={String(products.length).padStart(2, '0')} label="Pieces" />
            <HeroStat value="4.8" label="Avg rating" suffix={<Star size={11} strokeWidth={1.5} className="fill-paper" />} />
            <HeroStat value="3×" label="Restocked" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 1 }}
            className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-paper/60"
          >
            <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="h-8 w-px bg-paper/40"
            />
          </motion.div>
        </div>
      </section>

      {/* Breadcrumb + intro band */}
      <section className="border-b border-[var(--color-border)] bg-paper">
        <div className="mx-auto max-w-[1600px] px-6 py-6 md:px-12">
          <nav className="flex items-center gap-1 text-[11px] uppercase tracking-[0.25em] text-[var(--color-secondary)]">
            <Link href="/" className="transition-colors hover:text-ink">
              Home
            </Link>
            <ChevronRight size={12} />
            <Link href="/collections" className="transition-colors hover:text-ink">
              Collections
            </Link>
            <ChevronRight size={12} />
            <span className="text-ink">Bestsellers</span>
          </nav>
        </div>
      </section>

      {/* Value bar */}
      <section className="border-b border-[var(--color-border)] bg-paper">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 divide-y divide-[var(--color-border)] px-6 md:grid-cols-3 md:divide-x md:divide-y-0 md:px-12">
          <ValueTile
            icon={<Heart size={18} strokeWidth={1.5} />}
            title="Community-voted"
            copy="Ranked by how often you come back for more."
          />
          <ValueTile
            icon={<RefreshCcw size={18} strokeWidth={1.5} />}
            title="Restocked on-demand"
            copy="These cuts carry over to every collection."
          />
          <ValueTile
            icon={<Truck size={18} strokeWidth={1.5} />}
            title="Free shipping over BDT 2,000"
            copy="Made in Bangladesh, delivered nationwide."
          />
        </div>
      </section>

      {/* Controls bar */}
      <section className="sticky top-[72px] z-20 border-b border-[var(--color-border)] bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-6 py-5 md:px-12">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-secondary)]">
            <span className="text-ink">{sorted.length}</span> piece
            {sorted.length === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.25em]">
            <span className="hidden text-[var(--color-secondary)] md:inline">Sort</span>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
                className="appearance-none border border-[var(--color-border)] bg-paper py-2 pl-4 pr-10 text-[11px] uppercase tracking-[0.25em] text-ink transition-colors hover:border-ink focus:border-ink focus:outline-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronRight
                size={12}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-ink"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Ranked grid */}
      <section className="mx-auto max-w-[1600px] px-6 pb-24 pt-16 md:px-12 md:pb-32 md:pt-20">
        <div className="grid grid-cols-2 gap-x-4 gap-y-14 md:grid-cols-3 md:gap-x-6 md:gap-y-20 lg:grid-cols-4">
          {sorted.map((product, index) => (
            <RankedCard
              key={product.slug}
              product={product}
              rank={rankMap.get(product.slug) ?? index + 1}
              displayIndex={index}
            />
          ))}
        </div>

        {isPlaceholder && (
          <p className="mt-16 text-center text-[11px] uppercase tracking-[0.25em] text-[var(--color-secondary)]/70">
            Showing curated preview &mdash; full assortment syncing soon.
          </p>
        )}
      </section>

      {/* Editorial band */}
      <section className="bg-ink py-24 text-paper md:py-32">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-6 md:grid-cols-[1fr_1.2fr] md:gap-20 md:px-12">
          <div>
            <span className="mb-4 block text-[0.7rem] font-medium uppercase tracking-[0.4em] text-paper/60">
              The Practice
            </span>
            <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter md:text-5xl lg:text-6xl">
              Why <span className="font-serif font-light italic">these?</span>
            </h2>
          </div>
          <div className="flex flex-col gap-6 text-sm leading-relaxed text-paper/80 md:text-base">
            <p>
              Every season we retire a collection and let the numbers speak. These are the cuts
              you kept reordering, the ones that sold through before restock emails went out, the
              ones that showed up across your styling photos.
            </p>
            <p>
              They carry forward &mdash; evolved, refined, never reinvented for novelty. Built to
              age, and to keep aging.
            </p>
            <Link
              href="/collections"
              className="group mt-2 inline-flex w-fit items-center gap-3 border-b border-paper/40 pb-2 text-xs uppercase tracking-[0.3em] text-paper transition-colors hover:border-paper"
            >
              Browse all collections
              <ArrowRight
                size={14}
                strokeWidth={1.5}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroStat({
  value,
  label,
  suffix,
}: {
  value: string;
  label: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex items-baseline gap-1.5 text-2xl font-black tabular-nums md:text-3xl">
        {value}
        {suffix}
      </span>
      <span className="text-[10px] uppercase tracking-[0.3em] text-paper/60">{label}</span>
    </div>
  );
}

function ValueTile({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex items-start gap-4 px-0 py-6 md:px-8">
      <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--color-border)] text-ink">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-ink">{title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-secondary)]">{copy}</p>
      </div>
    </div>
  );
}

interface RankedCardProps {
  product: ProductData;
  rank: number;
  displayIndex: number;
}

function RankedCard({ product, rank, displayIndex }: RankedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { amount: 0.2, once: true });
  const shouldReduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const displayImage = isHovered && product.hoverImage ? product.hoverImage : product.image;

  const rowIndex = displayIndex % 4;
  const delay = shouldReduceMotion ? 0 : 0.05 * rowIndex;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/products/${product.slug}`}
        className="group block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-surface-low)]">
          <Image
            src={displayImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
          />

          {/* Vignette on hover */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          {/* Rank badge */}
          <span
            aria-hidden
            className="pointer-events-none absolute -left-1 top-1 select-none text-[5.5rem] font-black leading-none tracking-tighter text-transparent md:-left-2 md:top-2 md:text-[7rem]"
            style={{ WebkitTextStroke: '1.25px rgba(255,255,255,0.85)' }}
          >
            {String(rank).padStart(2, '0')}
          </span>

          {rank <= 3 && (
            <span className="absolute left-3 top-3 bg-ink px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.25em] text-paper">
              Top {rank}
            </span>
          )}

          {product.id && <WishlistButton productId={product.id} variant="card" />}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="absolute bottom-4 left-4 right-4 translate-y-3 bg-paper py-3.5 text-[10px] font-bold uppercase tracking-[0.25em] text-ink opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100"
          >
            Quick Add
          </button>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="truncate text-xs font-bold uppercase tracking-[0.18em] text-ink">
              {product.name}
            </h4>
            {product.colourCount !== undefined && product.colourCount > 0 && (
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.25em] text-[var(--color-secondary)]">
                {product.colourCount} Colours
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-ink">
            {formatPrice(product.price)}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
