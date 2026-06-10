'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Info, Plus, Truck } from 'lucide-react';
import type { Product } from './page';
import { useCart } from '@/stores/cart';
import { formatPrice, cn } from '@/lib/utils';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { SizeGuideModal } from '@/components/product/size-guide-modal';
import { SizeAndFitModal } from '@/components/products/size-and-fit-modal';
import { ProductDescription } from '@/components/product/product-description';
import type { FitLandmarks } from '@repo/fit-engine';
import { WishlistButton } from '@/components/ui/wishlist-button';
import { pickCategory, detectRise, detectGender } from '@/lib/size-charts';

interface ProductDetailProps {
  product: Product;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const addItem = useCart((s) => s.addItem);
  const openCart = useCart((s) => s.openCart);

  // Get unique colors and sizes
  const colors = useMemo(
    () => [...new Set(product.variants.map((v) => v.color))],
    [product.variants]
  );

  const [selectedColor, setSelectedColor] = useState(colors[0] ?? '');
  const [selectedSize, setSelectedSize] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  const sizeGuideCategory = useMemo(() => pickCategory(product), [product]);
  const sizeGuideRise = useMemo(() => detectRise(product), [product]);
  const sizeGuideGender = useMemo(() => detectGender(product), [product]);

  // Find matching variant
  const selectedVariant = useMemo(
    () =>
      product.variants.find(
        (v) => v.color === selectedColor && v.size === selectedSize
      ),
    [product.variants, selectedColor, selectedSize]
  );

  // Get available sizes for selected color
  const availableSizes = useMemo(
    () =>
      product.variants
        .filter((v) => v.color === selectedColor)
        .map((v) => ({ size: v.size, stock: v.stock })),
    [product.variants, selectedColor]
  );

  // Image source priority:
  //   1. The exact (color, size) variant if it has its own images.
  //   2. Any variant of the selected color that has images (so the gallery
  //      updates the moment you tap a color, even before picking a size).
  //   3. The product-level images.
  const images = useMemo(() => {
    if (selectedVariant?.images.length) return selectedVariant.images;
    const colorVariantWithImages = product.variants.find(
      (v) => v.color === selectedColor && v.images.length > 0,
    );
    if (colorVariantWithImages) return colorVariantWithImages.images;
    return product.images;
  }, [product.variants, product.images, selectedVariant, selectedColor]);

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      image: images[0] ?? '',
      color: selectedVariant.color,
      size: selectedVariant.size,
      // variant.price is commonly null in this catalog; fall back to
      // product.price and honour an active campaign so the cart stores the
      // real unit price (same number the display shows and orders.service
      // bills). Without this the cart/checkout showed ৳0 while the emailed
      // invoice charged the full amount.
      price: product.activeCampaign
        ? product.activeCampaign.finalPrice
        : Number(selectedVariant.price ?? product.price),
      qty: 1,
    });
    openCart();
  };

  // Per-variant price is optional in the admin form, so variant.price is
  // commonly null. Fall back to product.price so we don't render ৳0 the
  // moment a size is selected.
  const baseUnit = Number(selectedVariant?.price ?? product.price);
  // Active campaign price wins over both variant price and product price
  // — same number the customer will be charged at checkout (orders.service
  // re-applies the campaign rule against the product's base price).
  const price = product.activeCampaign ? product.activeCampaign.finalPrice : baseUnit;
  // Strikethrough comparison: prefer the original product price when a
  // campaign is active (the customer is saving against today's price, not
  // against a historical compareAtPrice marketing strikethrough).
  const compareAtPrice = product.activeCampaign
    ? baseUnit
    : product.compareAtPrice
      ? Number(product.compareAtPrice)
      : null;

  return (
    <div className="pt-24">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-[1440px] px-6 py-4 lg:px-12">
        <nav className="flex items-center gap-1 text-xs text-muted">
          <Link href="/" className="hover:text-ink">Home</Link>
          <ChevronRight size={12} />
          {product.category && (
            <>
              <Link href={`/collections/${product.category.slug}`} className="hover:text-ink">
                {product.category.name}
              </Link>
              <ChevronRight size={12} />
            </>
          )}
          <span className="text-ink">{product.name}</span>
        </nav>
      </div>

      {/* Product layout */}
      <div className="mx-auto grid max-w-[1440px] gap-8 px-6 pb-20 lg:grid-cols-2 lg:gap-16 lg:px-12">
        {/* Left: Image gallery */}
        <div>
          {/* Main image */}
          <div className="relative aspect-[3/4] overflow-hidden bg-muted-bg">
            {images[activeImageIndex] && (
              <ImageWithFallback
                originalSrc={images[activeImageIndex]}
                variant="hero"
                alt={`${product.name} - image ${activeImageIndex + 1}`}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={cn(
                    'relative h-20 w-16 flex-shrink-0 overflow-hidden bg-muted-bg border-2 transition-colors',
                    activeImageIndex === i ? 'border-ink' : 'border-transparent'
                  )}
                >
                  <ImageWithFallback
                    originalSrc={img}
                    variant="thumb"
                    alt={`Thumbnail ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product info */}
        <div className="lg:pt-4">
          <div className="flex items-start justify-between gap-6">
            <h1 className="text-xl font-semibold text-ink md:text-2xl">{product.name}</h1>
            <div className="flex flex-col items-end">
              <span className="whitespace-nowrap text-lg font-semibold text-ink">
                {formatPrice(price)}
              </span>
              {compareAtPrice && compareAtPrice > price && (
                <span className="whitespace-nowrap text-sm text-muted line-through">
                  {formatPrice(compareAtPrice)}
                </span>
              )}
              {product.activeCampaign && (
                <Link
                  href={`/campaigns/${product.activeCampaign.campaignSlug}`}
                  className="mt-1 inline-flex items-center gap-1 bg-ink px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-paper hover:opacity-90"
                  title={product.activeCampaign.campaignName}
                >
                  −{product.activeCampaign.savingsPercent}% · {product.activeCampaign.campaignName}
                </Link>
              )}
            </div>
          </div>


          {/* Color selector — solid hex swatch when the variant has a
              colorHex, fallback to a variant image circle otherwise. */}
          {colors.length > 1 && (
            <div className="mt-8">
              <p className="mb-3 flex items-baseline gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                <span>Select Color</span>
                <sup className="text-[10px] font-normal text-muted">{colors.length}</sup>
                <span className="ml-3 font-normal normal-case tracking-normal text-muted">
                  {selectedColor}
                </span>
              </p>
              <div className="inline-flex items-center gap-3">
                {colors.map((color) => {
                  const variant = product.variants.find((v) => v.color === color);
                  const swatchHex = variant?.colorHex ?? null;
                  const swatchImg = variant?.images[0] ?? product.images[0];
                  const isActive = selectedColor === color;
                  return (
                    // Outer wrapper keeps a constant 48x48 footprint so the
                    // active state can't shift adjacent swatches. The inner
                    // circle is the same 40x40 for every swatch — active
                    // adds an inset ring drawn _inside_ the circle, no
                    // ring-offset (which would visually enlarge the dot).
                    <span
                      key={color}
                      className="relative inline-flex h-12 w-12 items-center justify-center"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedColor(color);
                          setSelectedSize('');
                          setActiveImageIndex(0);
                        }}
                        aria-label={color}
                        aria-pressed={isActive}
                        className={cn(
                          'relative h-10 w-10 overflow-hidden rounded-full border border-ink/10 bg-paper transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-80 hover:opacity-100',
                        )}
                        style={swatchHex ? { backgroundColor: swatchHex } : undefined}
                      >
                        {!swatchHex && swatchImg && (
                          <Image
                            src={swatchImg}
                            alt={color}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        )}
                      </button>
                      {isActive && (
                        // Ring drawn on a sibling so the swatch itself
                        // stays exactly 40x40 — the indicator is the only
                        // thing that grows on active.
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-full border-2 border-ink"
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size selector — single outlined row with underline + diagonal strike */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                Select Size
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSizeChartOpen(true)}
                  className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted underline underline-offset-[3px] decoration-ink/20 transition-colors hover:text-ink hover:decoration-ink"
                >
                  Size &amp; Fit
                </button>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="rounded-full bg-muted-bg px-3 py-1 text-[11px] font-medium text-ink underline underline-offset-[3px] decoration-ink/30 transition-colors hover:decoration-ink"
                >
                  Find Your Size
                </button>
              </div>
            </div>
            <div className="flex w-full border border-border">
              {availableSizes.map(({ size, stock }, i) => {
                const isActive = selectedSize === size;
                const isOOS = stock === 0;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => !isOOS && setSelectedSize(size)}
                    disabled={isOOS}
                    className={cn(
                      'relative flex-1 py-3.5 text-center text-sm font-medium uppercase tracking-[0.1em] transition-colors',
                      i !== 0 && 'border-l border-border',
                      isOOS ? 'cursor-not-allowed text-muted/40' : 'text-ink hover:bg-ink/[0.03]'
                    )}
                  >
                    <span
                      className={cn(
                        'relative inline-block',
                        isActive && 'after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-px after:bg-ink'
                      )}
                    >
                      {size}
                    </span>
                    {isOOS && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="block h-px w-[55%] rotate-[-22deg] bg-muted/50" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model fit */}
          <p className="mt-4 text-xs leading-relaxed text-muted">
            <strong className="font-semibold text-ink">Male</strong> model is 6&apos; & 70kg, wearing the size M.{' '}
            <strong className="font-semibold text-ink">Female</strong> model is 5&apos;9&quot; & 48kg, wearing the size S.
          </p>

          {/* Add to Cart + Wishlist */}
          <div className="mt-8 flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant || selectedVariant.stock === 0}
              className={cn(
                'flex-1 py-4 text-sm font-semibold uppercase tracking-[0.15em] transition-colors',
                selectedVariant && selectedVariant.stock > 0
                  ? 'bg-ink text-paper hover:bg-ink/90'
                  : 'cursor-not-allowed bg-muted-bg text-muted'
              )}
            >
              {!selectedSize
                ? 'Select a Size'
                : selectedVariant && selectedVariant.stock === 0
                  ? 'Out of Stock'
                  : 'Add to Cart'}
            </button>
            <WishlistButton
              productId={product.id}
              variant="detail"
              size={20}
              className="px-4"
            />
          </div>

          {/* Stock indicator */}
          {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 5 && (
            <p className="mt-2 text-xs text-warning">
              Only {selectedVariant.stock} left in stock
            </p>
          )}

          {/* Collapsible details */}
          <div className="mt-10 border-t border-border">
            <details className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between py-5">
                <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                  <Info size={16} strokeWidth={1.5} className="text-muted" />
                  Product Details
                </span>
                <Plus size={16} className="text-muted transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <div className="space-y-4 pb-5 pl-7 pr-2 text-sm leading-relaxed text-muted">
                <ProductDescription html={product.description} />
                {product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-muted-bg px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </details>

            <details className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between py-5">
                <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                  <Truck size={16} strokeWidth={1.5} className="text-muted" />
                  Shipping Details
                </span>
                <Plus size={16} className="text-muted transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <div className="space-y-2 pb-5 pl-7 pr-2 text-sm leading-relaxed text-muted">
                <p>Free shipping on orders over BDT 2,000.</p>
                <p>Standard delivery: 3–5 business days across Bangladesh.</p>
                <p>Express delivery: 1–2 business days (additional charge applies).</p>
                <p>30-day returns. Items must be unused with original tags attached.</p>
              </div>
            </details>
          </div>
        </div>
      </div>

      <SizeGuideModal
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        category={sizeGuideCategory}
        rise={sizeGuideRise}
        gender={sizeGuideGender}
      />

      <SizeAndFitModal
        productId={product.id}
        productName={product.name}
        productType={
          (product as unknown as {
            type?: 'PANTS' | 'SHIRTS' | 'JACKETS' | null;
          }).type ?? null
        }
        fitLandmarks={
          (product as unknown as { fitLandmarks?: FitLandmarks | null })
            .fitLandmarks ?? null
        }
        open={sizeChartOpen}
        onClose={() => setSizeChartOpen(false)}
      />
    </div>
  );
}
