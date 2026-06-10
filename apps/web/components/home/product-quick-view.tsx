'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { X, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { ProductDescription } from '@/components/product/product-description';
import { useIsMobile } from '@/lib/mobile/use-media-query';
import { useCart } from '@/stores/cart';
import { prefetchProduct } from '@/lib/product-prefetch';

interface ProductData {
  name: string;
  slug: string;
  price: number;
  image: string;
  hoverImage?: string;
  colourCount?: number;
}

interface ProductQuickViewProps {
  product: ProductData;
  related: ProductData[];
  onClose: () => void;
}

// Generic fallback copy used until the real description loads (or when the
// admin left description blank). Kept short so an empty product doesn't
// render an obvious "placeholder" feel.
const FALLBACK_DESCRIPTION =
  'Tap "View full details" for fit notes, materials, and care.';

// Collapsible wrapper around ProductDescription: clamps long rich-text to a
// few lines in the quick view and reveals the rest behind "See more". The
// toggle only renders when the content actually overflows the clamp.
function CollapsibleDescription({
  html,
  className,
}: {
  readonly html: string | null | undefined;
  readonly className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) setOverflows(ref.current.scrollHeight > 132);
  }, [html]);

  return (
    <div className={className}>
      <div ref={ref} className={expanded ? '' : 'max-h-[120px] overflow-hidden'}>
        <ProductDescription html={html} />
      </div>
      {overflows || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-ink underline underline-offset-2 hover:opacity-70"
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      ) : null}
    </div>
  );
}

interface FullVariant {
  id: string;
  color: string;
  colorHex?: string | null;
  size: string;
  stock: number;
  price: string | null;
  images: string[];
}

interface FullProduct {
  id: string;
  description: string;
  images: string[];
  price: string;
  variants: FullVariant[];
  isNewArrival?: boolean;
  isTrending?: boolean;
  isFeatured?: boolean;
}

interface ColorSwatch {
  name: string;
  image: string;
  /** Optional CSS hex (e.g. "#94a2b2"). When present the swatch renders
   *  as a solid color circle; otherwise the variant image is used. */
  hex: string | null;
}

/** Lazy-fetch the full product on open so quick view renders the same
 *  variants / description / flags as the detail page. Resolves from the
 *  shared in-memory cache (warmed by hover/focus prefetch on cards), so an
 *  intentional QuickView open is typically instant. Returns null until
 *  loaded; callers should fall back to the basic card data in the meantime. */
function useFullProduct(slug: string): FullProduct | null {
  const [data, setData] = useState<FullProduct | null>(null);
  useEffect(() => {
    let cancelled = false;
    void prefetchProduct(slug).then((value) => {
      if (cancelled) return;
      if (value) setData(value as FullProduct);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return data;
}

function colorsFromProduct(
  full: FullProduct | null,
  fallback: ProductData,
): ColorSwatch[] {
  // Empty while loading so the COLOUR row hides entirely instead of
  // rendering a card-image placeholder that flickers into the real hex
  // swatch the moment the API response arrives.
  if (!full) return [];
  const seen = new Set<string>();
  const out: ColorSwatch[] = [];
  for (const v of full.variants) {
    if (seen.has(v.color)) continue;
    seen.add(v.color);
    out.push({
      name: v.color,
      image: v.images[0] ?? full.images[0] ?? fallback.image,
      hex: v.colorHex ?? null,
    });
  }
  return out.length > 0
    ? out
    : [{ name: '', image: fallback.image, hex: null }];
}

function sizesForColor(full: FullProduct | null, color: string): string[] {
  if (!full || !color) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of full.variants) {
    if (v.color !== color || seen.has(v.size)) continue;
    seen.add(v.size);
    out.push(v.size);
  }
  return out;
}

function eyebrowFromFlags(full: FullProduct | null): string {
  if (!full) return '';
  if (full.isNewArrival) return 'New Arrival';
  if (full.isTrending) return 'Trending';
  if (full.isFeatured) return 'Featured';
  return '';
}

export function ProductQuickView(props: ProductQuickViewProps) {
  const isMobile = useIsMobile();
  return isMobile ? <MobileQuickView {...props} /> : <DesktopQuickView {...props} />;
}

function DesktopQuickView({ product, related, onClose }: ProductQuickViewProps) {
  const [leaving, setLeaving] = useState(false);
  const [selectedColour, setSelectedColour] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const full = useFullProduct(product.slug);
  const swatches = useMemo(
    () => colorsFromProduct(full, product),
    [full, product],
  );
  const sizes = useMemo(
    () => sizesForColor(full, swatches[selectedColour]?.name ?? ''),
    [full, swatches, selectedColour],
  );
  const eyebrow = eyebrowFromFlags(full) || 'New Arrival';
  const description = full?.description?.trim() || FALLBACK_DESCRIPTION;

  // Same purchase flow as MobileQuickView. The desktop layout used to fall
  // back to <Link href=PDP> for both CTAs, which surprised customers who
  // expected the quick view to add inline. Re-uses the same selectedVariant
  // resolver and cart wiring so behaviour matches across breakpoints.
  const addItem = useCart((s) => s.addItem);
  const openCart = useCart((s) => s.openCart);
  const router = useRouter();

  const selectedVariant = useMemo<FullVariant | null>(() => {
    if (!full) return null;
    const color = swatches[selectedColour]?.name;
    if (color === undefined) return null;
    if (sizes.length === 0) {
      return full.variants.find((v) => v.color === color) ?? null;
    }
    if (!selectedSize) return null;
    return (
      full.variants.find(
        (v) => v.color === color && v.size === selectedSize,
      ) ?? null
    );
  }, [full, swatches, selectedColour, selectedSize, sizes]);

  const needsSize = sizes.length > 0 && !selectedSize;
  const outOfStock =
    selectedVariant !== null && selectedVariant.stock === 0;
  const canPurchase =
    full !== null && selectedVariant !== null && !needsSize && !outOfStock;

  const buildCartItem = () => {
    if (!full || !selectedVariant) return null;
    return {
      variantId: selectedVariant.id,
      productId: full.id,
      productName: product.name,
      productSlug: product.slug,
      image: selectedVariant.images[0] ?? product.image,
      color: selectedVariant.color,
      size: selectedVariant.size,
      price: Number(selectedVariant.price ?? product.price),
      qty: 1,
    };
  };

  const handleAddToCart = () => {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    openCart();
    onClose();
  };

  const handleBuyNow = () => {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    onClose();
    router.push('/checkout');
  };

  const primaryLabel = !full
    ? 'Loading…'
    : outOfStock
      ? 'Out of Stock'
      : needsSize
        ? 'Select a Size'
        : 'Add to Cart';

  const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const animFor = (delay: number, duration = 900) =>
    leaving
      ? `denimisiaQvRiseOut 550ms ${easing} forwards`
      : `denimisiaQvRiseIn ${duration}ms ${easing} ${delay}ms forwards`;

  useEffect(() => {
    const { body, documentElement: html } = document;
    const scrollBarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPadding: body.style.paddingRight,
      htmlScrollbarGutter: html.style.scrollbarGutter,
    };
    body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }
    html.style.scrollbarGutter = 'stable';
    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.paddingRight = prev.bodyPadding;
      html.style.scrollbarGutter = prev.htmlScrollbarGutter;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setLeaving(true);
    window.setTimeout(onClose, 550);
  };

  const scrollCarousel = (direction: 'prev' | 'next') => {
    const node = carouselRef.current;
    if (!node) return;
    const delta = node.clientWidth * 0.7 * (direction === 'next' ? 1 : -1);
    node.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8 md:p-10"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick view: ${product.name}`}
    >
      <button
        type="button"
        aria-label="Close quick view"
        onClick={handleClose}
        className="absolute inset-0"
        style={{
          animation: leaving
            ? 'denimisiaQvBackdropOut 550ms cubic-bezier(0.22, 1, 0.36, 1) forwards'
            : 'denimisiaQvBackdropIn 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }}
      />

      <div className="relative z-10 flex max-h-[97vh] w-full max-w-[1162px] flex-col gap-5 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:grid-rows-[auto_auto] lg:items-start lg:gap-6 [&>*]:min-w-0">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-0 top-0 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink opacity-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] transition-[transform,background] duration-300 hover:bg-white hover:scale-105"
          style={{
            animation: leaving
              ? `denimisiaQvRiseOut 400ms ${easing} forwards`
              : `denimisiaQvCloseIn 600ms ${easing} 300ms forwards`,
          }}
        >
          <X size={18} strokeWidth={2} />
        </button>

        <div
          className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-[var(--color-surface-low)] opacity-0 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.45)] lg:row-span-2 lg:aspect-auto lg:h-full"
          style={{ animation: animFor(220) }}
        >
          <Image
            key={swatches[selectedColour]?.image ?? product.image}
            src={swatches[selectedColour]?.image ?? product.image}
            alt={
              swatches[selectedColour]?.name
                ? `${product.name} — ${swatches[selectedColour]?.name}`
                : product.name
            }
            fill
            priority
            className="object-cover transition-opacity duration-300"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>

        <div
          className="flex flex-col gap-3.5 rounded-3xl bg-paper p-6 opacity-0 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.35)] sm:p-7 lg:p-8"
          style={{ animation: animFor(380) }}
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--color-secondary)]">
            {eyebrow}
          </span>
          <h3 className="text-2xl font-black uppercase leading-[0.95] tracking-tight text-ink md:text-3xl lg:text-[2rem]">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-black tracking-tight text-ink">
              {formatPrice(product.price)}
            </span>
            {swatches.length > 0 && swatches[0]?.name ? (
              <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-secondary)]">
                {swatches.length} {swatches.length === 1 ? 'colour' : 'colours'}
              </span>
            ) : null}
          </div>
          <CollapsibleDescription
            html={description}
            className="text-[13px] leading-relaxed text-[var(--color-secondary)]"
          />

          {swatches.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink">
                Colour
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-secondary)]">
                {swatches[selectedColour]?.name ?? ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {swatches.map((swatch, index) => (
                <button
                  key={`${swatch.name}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedColour(index);
                    setSelectedSize(null);
                  }}
                  aria-label={`Colour: ${swatch.name || 'default'}`}
                  aria-pressed={index === selectedColour}
                  className={`relative h-10 w-10 overflow-hidden rounded-full ring-offset-2 ring-offset-paper transition-all duration-200 hover:scale-110 ${
                    index === selectedColour
                      ? 'ring-2 ring-ink'
                      : 'ring-1 ring-ink/15 hover:ring-ink/40'
                  }`}
                  style={swatch.hex ? { backgroundColor: swatch.hex } : undefined}
                >
                  {!swatch.hex && (
                    <Image
                      src={swatch.image}
                      alt={swatch.name || 'colour swatch'}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
          )}

          {sizes.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink">
                  Size
                </span>
                <Link
                  href={`/size-guide`}
                  className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-secondary)] underline-offset-2 hover:underline"
                >
                  Size Guide
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const active = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      aria-pressed={active}
                      className={`min-w-[2.6rem] border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
                        active
                          ? 'border-ink bg-ink text-paper'
                          : 'border-ink/15 bg-paper text-ink hover:border-ink/50'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-1.5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canPurchase}
              className="inline-flex flex-1 items-center justify-center bg-ink px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!canPurchase}
              className="inline-flex flex-1 items-center justify-center border border-ink/15 bg-paper px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.3em] text-ink transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink/15"
            >
              Buy Now
            </button>
            <Link
              href={`/products/${product.slug}`}
              className="inline-flex items-center justify-center border border-ink/15 bg-paper px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.3em] text-ink transition-colors hover:border-ink/40"
            >
              Details
            </Link>
          </div>
        </div>

        {related.length > 0 ? (
          <div
            className="relative flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-3xl border border-white/40 bg-white/25 p-4 opacity-0 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150 sm:p-5 lg:p-5"
            style={{ animation: animFor(540), isolation: 'isolate' }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/4 h-40 w-40 rounded-full bg-white/40 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-paper/30 blur-3xl"
            />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-ink">
                  Complete the Look
                </h4>
                <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.3em] text-[var(--color-secondary)]">
                  Pairs well
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => scrollCarousel('prev')}
                  aria-label="Previous suggestions"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-white/40 text-ink backdrop-blur-md transition-all hover:border-ink/40 hover:bg-white/70"
                >
                  <ChevronLeft size={14} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel('next')}
                  aria-label="Next suggestions"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-white/40 text-ink backdrop-blur-md transition-all hover:border-ink/40 hover:bg-white/70"
                >
                  <ChevronRight size={14} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div
              ref={carouselRef}
              className="relative z-10 flex w-full min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/products/${item.slug}`}
                  className="group flex w-[48%] flex-none snap-start flex-col gap-1.5 rounded-xl border border-white/40 bg-white/30 p-1.5 backdrop-blur-md transition-all duration-300 hover:bg-white/50 sm:w-[36%] lg:w-[38%]"
                >
                  <div className="relative aspect-square w-full min-h-[120px] overflow-hidden rounded-lg bg-white/30">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 640px) 60vw, 25vw"
                    />
                  </div>
                  <div className="flex items-start justify-between gap-1.5 px-1">
                    <span className="line-clamp-1 text-[10px] font-bold uppercase tracking-widest text-ink">
                      {item.name}
                    </span>
                    <ArrowRight
                      size={11}
                      strokeWidth={2}
                      className="mt-0.5 flex-none text-ink/50 transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                  <span className="px-1 pb-1 text-[10px] font-medium text-ink/70">
                    {formatPrice(item.price)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileQuickView({ product, related, onClose }: ProductQuickViewProps) {
  const [selectedColour, setSelectedColour] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const full = useFullProduct(product.slug);
  const swatches = useMemo(
    () => colorsFromProduct(full, product),
    [full, product],
  );
  const sizes = useMemo(
    () => sizesForColor(full, swatches[selectedColour]?.name ?? ''),
    [full, swatches, selectedColour],
  );
  const eyebrow = eyebrowFromFlags(full) || 'New Arrival';
  const description = full?.description?.trim() || FALLBACK_DESCRIPTION;

  const addItem = useCart((s) => s.addItem);
  const openCart = useCart((s) => s.openCart);
  const router = useRouter();

  // Resolve the exact variant the customer is checking out. When the product
  // has no per-variant sizes (e.g. one-size accessories), accept the first
  // variant of the chosen colour automatically.
  const selectedVariant = useMemo<FullVariant | null>(() => {
    if (!full) return null;
    const color = swatches[selectedColour]?.name;
    if (color === undefined) return null;
    if (sizes.length === 0) {
      return full.variants.find((v) => v.color === color) ?? null;
    }
    if (!selectedSize) return null;
    return (
      full.variants.find(
        (v) => v.color === color && v.size === selectedSize,
      ) ?? null
    );
  }, [full, swatches, selectedColour, selectedSize, sizes]);

  const needsSize = sizes.length > 0 && !selectedSize;
  const outOfStock =
    selectedVariant !== null && selectedVariant.stock === 0;
  const canPurchase =
    full !== null && selectedVariant !== null && !needsSize && !outOfStock;

  const buildCartItem = () => {
    if (!full || !selectedVariant) return null;
    return {
      variantId: selectedVariant.id,
      productId: full.id,
      productName: product.name,
      productSlug: product.slug,
      image: selectedVariant.images[0] ?? product.image,
      color: selectedVariant.color,
      size: selectedVariant.size,
      price: Number(selectedVariant.price ?? product.price),
      qty: 1,
    };
  };

  const handleAddToCart = () => {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    openCart();
    onClose();
  };

  const handleBuyNow = () => {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    onClose();
    router.push('/checkout');
  };

  const primaryLabel = outOfStock
    ? 'Out of Stock'
    : needsSize
      ? 'Select a Size'
      : 'Add to Cart';

  return (
    <Drawer.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[120] bg-ink/60 backdrop-blur-sm" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-[121] flex h-[92svh] flex-col rounded-t-3xl bg-paper outline-none shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.25)]"
        >
          {/* Handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div
              aria-hidden
              className="h-1.5 w-10 rounded-full bg-[var(--color-outline-variant)]"
            />
          </div>

          <Drawer.Title className="sr-only">{product.name}</Drawer.Title>

          {/* Scrollable body — min-h-0 is required so flex-1 actually
              shrinks below intrinsic content height; without it, the
              overflow-y-auto never engages and the sticky footer below
              gets pushed off-screen. */}
          <div className="min-h-0 flex-1 overflow-y-auto pb-2">
            {/* Image — portrait frame matches fashion-photo orientation so
                  heads/feet aren't cropped; max-w keeps it sane on tablets
                  where MobileQuickView still triggers, and max-h keeps the
                  sticky footer comfortably in view without scrolling */}
            <div className="px-5 pt-1 pb-4">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-[360px] max-h-[48svh] overflow-hidden rounded-2xl bg-[var(--color-surface-low)]">
                <Image
                  key={swatches[selectedColour]?.image ?? product.image}
                  src={swatches[selectedColour]?.image ?? product.image}
                  alt={
                    swatches[selectedColour]?.name
                      ? `${product.name} — ${swatches[selectedColour]?.name}`
                      : product.name
                  }
                  fill
                  priority
                  sizes="(max-width: 480px) 100vw, 360px"
                  className="object-cover transition-opacity duration-300"
                />
              </div>
            </div>

            {/* Header */}
            <div className="space-y-1.5 px-5">
              <span className="block text-[10px] font-medium uppercase tracking-[0.35em] text-[var(--color-secondary)]">
                {eyebrow}
              </span>
              <h2 className="text-2xl font-black uppercase leading-[1.05] tracking-tight text-ink">
                {product.name}
              </h2>
              <div className="flex items-baseline gap-3 pt-0.5">
                <span className="text-[15px] font-semibold tracking-tight text-ink/85">
                  {formatPrice(product.price)}
                </span>
                {swatches.length > 1 ? (
                  <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-secondary)]">
                    {swatches.length} colours
                  </span>
                ) : null}
              </div>
            </div>

            {/* Colour — only render when there's a real choice to make */}
            {swatches.length > 1 ? (
              <div className="mt-4 space-y-2 px-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink">
                    Colour
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-secondary)]">
                    {swatches[selectedColour]?.name ?? ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {swatches.map((swatch, index) => (
                    <button
                      key={`${swatch.name}-${index}`}
                      type="button"
                      onClick={() => {
                        setSelectedColour(index);
                        setSelectedSize(null);
                      }}
                      aria-label={`Colour: ${swatch.name || 'default'}`}
                      aria-pressed={index === selectedColour}
                      className={`relative h-11 w-11 overflow-hidden rounded-full ring-offset-2 ring-offset-paper transition-all ${
                        index === selectedColour
                          ? 'ring-2 ring-ink'
                          : 'ring-1 ring-ink/15'
                      }`}
                      style={
                        swatch.hex ? { backgroundColor: swatch.hex } : undefined
                      }
                    >
                      {!swatch.hex && (
                        <Image
                          src={swatch.image}
                          alt={swatch.name || 'colour swatch'}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Size */}
            {sizes.length > 0 && (
              <div className="mt-4 space-y-2 px-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink">
                    Size
                  </span>
                  <Link
                    href="/size-guide"
                    onClick={onClose}
                    className="text-[10px] font-medium uppercase tracking-[0.25em] text-[var(--color-secondary)] underline-offset-2 hover:underline"
                  >
                    Size Guide
                  </Link>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {sizes.map((size) => {
                    const active = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        aria-pressed={active}
                        className={`min-h-[44px] border text-[11px] font-bold uppercase tracking-[0.15em] transition-all ${
                          active
                            ? 'border-ink bg-ink text-paper'
                            : 'border-ink/15 bg-paper text-ink'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description — when present, real prose; when the fallback,
                  treat it as a subtle utility hint rather than body copy */}
            {description === FALLBACK_DESCRIPTION ? (
              <p className="mt-4 mx-5 rounded-lg border border-ink/10 bg-[var(--color-surface-low)] px-3 py-2 text-[11px] leading-snug text-[var(--color-secondary)]">
                {description}
              </p>
            ) : (
              <CollapsibleDescription
                html={description}
                className="mt-4 px-5 text-[13px] leading-relaxed text-[var(--color-secondary)]"
              />
            )}

            {/* Complete the Look */}
            {related.length > 0 ? (
              <div className="mt-6 px-5">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-ink">
                      Complete the Look
                    </h4>
                    <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.3em] text-[var(--color-secondary)]">
                      Pairs well
                    </p>
                  </div>
                </div>
                <div className="-mx-5 flex gap-3 snap-x snap-mandatory overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {related.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/products/${item.slug}`}
                      onClick={onClose}
                      className="group flex w-[55%] flex-none snap-start flex-col gap-1.5 rounded-xl border border-ink/10 bg-paper p-1.5"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--color-surface-low)]">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="80vw"
                        />
                      </div>
                      <div className="flex items-start justify-between gap-1.5 px-1 pt-1">
                        <span className="line-clamp-1 text-[11px] font-bold uppercase tracking-widest text-ink">
                          {item.name}
                        </span>
                        <ArrowRight
                          size={12}
                          strokeWidth={2}
                          className="mt-0.5 flex-none text-ink/50"
                        />
                      </div>
                      <span className="px-1 pb-1 text-[11px] font-medium text-ink/70">
                        {formatPrice(item.price)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Sticky footer — flex-shrink-0 guarantees it never collapses if
                content above pushes against the drawer's max height */}
          <div
            className="flex-shrink-0 border-t border-[var(--color-outline-variant)] bg-paper px-5 pt-3"
            style={{ paddingBottom: 'calc(var(--safe-bottom, 0px) + 12px)' }}
          >
            {/* Two CTAs side-by-side so the whole footer stays compact and
                  the drawer can't push Buy Now below the viewport. Add to Cart
                  gets the primary filled treatment + price chip; Buy Now is the
                  outlined secondary that promotes high-intent checkout. */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canPurchase}
                className="flex flex-[1.4] items-center justify-center gap-2.5 bg-ink py-3.5 text-[11px] font-medium uppercase tracking-[0.25em] text-paper transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>{primaryLabel}</span>
                {canPurchase ? (
                  <>
                    <span aria-hidden className="h-3 w-px bg-paper/35" />
                    <span className="font-semibold tracking-tight normal-case">
                      {formatPrice(
                        Number(selectedVariant?.price ?? product.price),
                      )}
                    </span>
                  </>
                ) : null}
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!canPurchase}
                className="flex flex-1 items-center justify-center gap-1.5 border border-ink bg-paper py-3.5 text-[11px] font-medium uppercase tracking-[0.25em] text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-paper disabled:hover:text-ink"
              >
                <span>Buy Now</span>
                <ArrowRight size={12} strokeWidth={2.5} />
              </button>
            </div>
            <Link
              href={`/products/${product.slug}`}
              onClick={onClose}
              className="mt-1.5 block w-full py-1 text-center text-[10px] uppercase tracking-[0.25em] text-ink/55"
            >
              View Full Details →
            </Link>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
