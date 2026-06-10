'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Minus,
  Plus,
  RefreshCw,
  Shield,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import { useCart } from '@/stores/cart';
// Buying flow uses the ৳ glyph (see lib/utils); aliased so call sites stay tidy.
import { formatTaka as formatPrice } from '@/lib/utils';

export const FREE_SHIPPING_THRESHOLD = 5000;

export function CartScrollableBody({ mounted }: { mounted: boolean }) {
  const { items, closeCart, removeItem, updateQty, total } = useCart();
  const safeTotal = mounted ? total() : 0;
  const remainingFree = Math.max(0, FREE_SHIPPING_THRESHOLD - safeTotal);
  const shippingProgress = Math.min(100, (safeTotal / FREE_SHIPPING_THRESHOLD) * 100);
  const qualifiesFree = safeTotal >= FREE_SHIPPING_THRESHOLD && safeTotal > 0;

  if (!mounted || items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-surface-low)]">
          <ShoppingBag size={34} strokeWidth={1} className="text-ink/30" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-ink">
            Your cart is empty
          </p>
          <p className="mt-2 text-xs text-[var(--color-secondary)]">
            Discover considered pieces, crafted to last.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={closeCart}
            className="bg-ink px-10 py-3.5 text-[10px] font-bold uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-85"
          >
            Continue Shopping
          </button>
          <Link
            href="/bundles"
            onClick={closeCart}
            className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink underline-offset-4 hover:underline"
          >
            View Bundles →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Shipping progress */}
      <div className="border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-6 py-4">
        <div className="mb-2.5 flex items-center gap-2">
          {qualifiesFree ? (
            <Sparkles size={14} strokeWidth={1.75} className="text-ink" />
          ) : (
            <Truck size={14} strokeWidth={1.75} className="text-ink" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
            {qualifiesFree ? (
              "You've unlocked free shipping"
            ) : (
              <>
                <span className="text-ink/60">You&apos;re </span>
                {formatPrice(remainingFree)}
                <span className="text-ink/60"> away from free shipping</span>
              </>
            )}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(shippingProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1 w-full overflow-hidden rounded-full bg-ink/10"
        >
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${shippingProgress}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="px-6 py-6">
        <ul className="space-y-7">
          {items.map((item) => {
            const isBundle = item.variantId.startsWith('bundle:');
            const detailHref = isBundle
              ? `/bundles/${item.productSlug}`
              : `/products/${item.productSlug}`;
            const lineTotal = item.price * item.qty;
            return (
              <li key={item.variantId} className="group relative flex gap-4">
                <Link
                  href={detailHref}
                  onClick={closeCart}
                  className="relative h-28 w-24 flex-shrink-0 overflow-hidden rounded-[8px] bg-[var(--color-surface-highest)]"
                >
                  <Image
                    src={item.image}
                    alt={item.productName}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="96px"
                  />
                  {isBundle && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-paper">
                      Bundle
                    </span>
                  )}
                </Link>

                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Link
                        href={detailHref}
                        onClick={closeCart}
                        className="line-clamp-2 text-sm font-bold uppercase tracking-wide text-ink transition-colors hover:text-ink/70"
                      >
                        {item.productName}
                      </Link>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-[var(--color-secondary)]">
                        {item.color} <span className="text-ink/30">·</span> {item.size}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-[var(--color-secondary)]">
                        <Truck size={11} strokeWidth={1.75} />
                        Arrives in 3–5 days
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      aria-label={`Remove ${item.productName} from cart`}
                      className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-secondary)] opacity-60 transition-all hover:bg-[var(--color-surface-low)] hover:text-ink hover:opacity-100 group-hover:opacity-100"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                    <div className="flex items-center rounded-full border border-ink/15">
                      <button
                        onClick={() =>
                          updateQty(item.variantId, Math.max(1, item.qty - 1))
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-l-full text-ink/60 transition-colors hover:bg-[var(--color-surface-low)] hover:text-ink"
                        aria-label="Decrease quantity"
                        disabled={item.qty <= 1}
                      >
                        <Minus size={13} strokeWidth={1.75} />
                      </button>
                      <span className="flex h-8 w-7 items-center justify-center text-xs font-bold tabular-nums text-ink">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.variantId, item.qty + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-r-full text-ink/60 transition-colors hover:bg-[var(--color-surface-low)] hover:text-ink"
                        aria-label="Increase quantity"
                      >
                        <Plus size={13} strokeWidth={1.75} />
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-ink">
                        {formatPrice(lineTotal)}
                      </p>
                      {item.qty > 1 && (
                        <p className="mt-0.5 text-[10px] tabular-nums text-[var(--color-secondary)]">
                          {formatPrice(item.price)} each
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

export function CartFooter({ mounted }: { mounted: boolean }) {
  const { items, closeCart, total } = useCart();
  if (!mounted || items.length === 0) return null;

  const safeTotal = total();
  const qualifiesFree = safeTotal >= FREE_SHIPPING_THRESHOLD && safeTotal > 0;

  return (
    <>
      {/* Trust row */}
      <div className="grid grid-cols-3 gap-2 border-b border-[var(--color-outline-variant)] px-6 py-4 text-[9px] font-medium uppercase tracking-[0.15em] text-[var(--color-secondary)]">
        <div className="flex items-center justify-center gap-1.5">
          <Shield size={12} strokeWidth={1.5} className="text-ink/60" />
          <span>Secure</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 border-x border-[var(--color-outline-variant)]">
          <RefreshCw size={12} strokeWidth={1.5} className="text-ink/60" />
          <span>Free Returns</span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <Sparkles size={12} strokeWidth={1.5} className="text-ink/60" />
          <span>Made in BD</span>
        </div>
      </div>

      {/* Summary */}
      <div className="px-6 pb-5 pt-4">
        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-secondary)]">
              Subtotal
            </dt>
            <dd className="tabular-nums text-ink">{formatPrice(safeTotal)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-secondary)]">
              Shipping
            </dt>
            <dd className="tabular-nums">
              {qualifiesFree ? (
                <span className="font-bold text-ink">Free</span>
              ) : (
                <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-secondary)]">
                  Calculated at checkout
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mb-5 flex items-baseline justify-between border-t border-[var(--color-outline-variant)] pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink">
            Total
          </span>
          <span className="text-2xl font-black tabular-nums text-ink">
            {formatPrice(safeTotal)}
          </span>
        </div>

        <Link
          href="/checkout"
          onClick={closeCart}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden bg-ink px-8 py-4 text-xs font-bold uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-90"
        >
          <span>Checkout</span>
          <span className="text-paper/60">·</span>
          <span className="tabular-nums">{formatPrice(safeTotal)}</span>
        </Link>

        <p className="mt-3 text-center text-[9px] uppercase tracking-[0.25em] text-[var(--color-secondary)]">
          Tax included where applicable
        </p>
      </div>
    </>
  );
}
