'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Trash2, ShoppingBag, Loader2, TrendingDown, Sparkles, Share2, Check } from 'lucide-react';
import { useWishlist } from '@/stores/wishlist';
import { useCart } from '@/stores/cart';
import { formatPrice } from '@/lib/utils';
import {
  createWishlistShareToken,
  revokeWishlistShareToken,
  type WishlistItem,
} from '@/lib/api';

function pickDefaultVariant(product: WishlistItem['product']) {
  if (!product?.variants?.length) return null;
  const inStock = product.variants.find((v) => v.stock > 0);
  return inStock ?? product.variants[0];
}

export function WishlistClient() {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? null;

  const items = useWishlist((s) => s.items);
  const hydrated = useWishlist((s) => s.hydrated);
  const guestCount = useWishlist((s) => s.guestProductIds.length);
  const toggle = useWishlist((s) => s.toggle);
  const addToCart = useCart((s) => s.addItem);
  const openCart = useCart((s) => s.openCart);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (!accessToken) return;
    setShareBusy(true);
    try {
      const { shareToken } = await createWishlistShareToken(accessToken);
      const url = `${window.location.origin}/wishlist/${shareToken}`;
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard blocked — URL is still shown
      }
    } finally {
      setShareBusy(false);
    }
  }, [accessToken]);

  const handleRevokeShare = useCallback(async () => {
    if (!accessToken) return;
    setShareBusy(true);
    try {
      await revokeWishlistShareToken(accessToken);
      setShareUrl(null);
    } finally {
      setShareBusy(false);
    }
  }, [accessToken]);

  const handleRemove = useCallback(
    async (productId: string) => {
      if (!accessToken) return;
      setBusyId(productId);
      try {
        await toggle(accessToken, productId);
      } finally {
        setBusyId(null);
      }
    },
    [accessToken, toggle],
  );

  const handleMoveToCart = useCallback(
    (item: WishlistItem) => {
      const variant = pickDefaultVariant(item.product);
      if (!item.product || !variant) return;
      const price =
        'price' in variant && variant.price !== undefined && variant.price !== null
          ? Number(variant.price)
          : Number(item.product.price);
      addToCart({
        variantId: variant.id,
        productId: item.product.id,
        productName: item.product.name,
        productSlug: item.product.slug,
        image: item.product.images?.[0] ?? '',
        color: variant.color,
        size: variant.size,
        price,
        qty: 1,
      });
      openCart();
    },
    [addToCart, openCart],
  );

  if (status === 'loading' || (status === 'authenticated' && !hydrated)) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 size={20} className="animate-spin text-muted" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return (
      <div className="space-y-3 text-sm text-muted">
        <p>
          <Link href="/login" className="text-ink underline underline-offset-4">
            Sign in
          </Link>{' '}
          to view your saved pieces.
        </p>
        {guestCount > 0 && (
          <p className="text-xs uppercase tracking-[0.2em] text-muted/80">
            {guestCount} piece{guestCount === 1 ? '' : 's'} saved on this device — they&apos;ll appear here after you sign in.
          </p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted">Your wishlist is empty.</p>
        <Link
          href="/shop"
          className="mt-6 inline-block border border-ink px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Discover Pieces
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          {items.length} piece{items.length === 1 ? '' : 's'} saved
        </p>
        <div className="flex items-center gap-3">
          {shareUrl ? (
            <>
              <input
                type="text"
                value={shareUrl}
                readOnly
                onFocus={(e) => e.target.select()}
                className="w-64 border border-border bg-transparent px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="flex items-center gap-1.5 border border-ink bg-ink px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-paper transition-colors hover:bg-ink/90"
              >
                {copied ? <Check size={12} /> : <Share2 size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleRevokeShare}
                disabled={shareBusy}
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted underline underline-offset-4 hover:text-ink disabled:opacity-50"
              >
                Revoke
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleShare}
              disabled={shareBusy}
              className="flex items-center gap-1.5 border border-ink px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {shareBusy ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
              Share wishlist
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        if (!item.product) return null;
        const variant = pickDefaultVariant(item.product);
        const currentPrice = Number(item.product.price);
        const currentStock = item.product.variants?.reduce(
          (sum, v) => sum + v.stock,
          0,
        ) ?? 0;
        const outOfStock = !variant || variant.stock === 0;
        const busy = busyId === item.productId;

        const savedPrice =
          item.savedAtPrice !== null && item.savedAtPrice !== undefined
            ? Number(item.savedAtPrice)
            : null;
        const savedStock = item.savedAtStock ?? null;
        const priceDropAmount =
          savedPrice !== null && currentPrice < savedPrice
            ? savedPrice - currentPrice
            : 0;
        const backInStock =
          savedStock !== null && savedStock === 0 && currentStock > 0;

        return (
          <div key={item.id} className="group">
            <Link
              href={`/products/${item.product.slug}`}
              className="block"
              aria-label={item.product.name}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-surface-low)]">
                {item.product.images?.[0] && (
                  <Image
                    src={item.product.images[0]}
                    alt={item.product.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                )}
                <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
                  {outOfStock && (
                    <span className="bg-ink/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.25em] text-paper">
                      Out of stock
                    </span>
                  )}
                  {backInStock && (
                    <span className="flex items-center gap-1 bg-[#1f8a3f] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.25em] text-paper">
                      <Sparkles size={10} /> Back in stock
                    </span>
                  )}
                  {priceDropAmount > 0 && (
                    <span className="flex items-center gap-1 bg-[#c0392b] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.25em] text-paper">
                      <TrendingDown size={10} /> {formatPrice(priceDropAmount)} off
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <div className="mt-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-bold uppercase tracking-widest text-ink">
                    {item.product.name}
                  </h3>
                </div>
                <span className="shrink-0 text-xs font-medium text-ink">
                  {formatPrice(Number(item.product.price))}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleMoveToCart(item)}
                  disabled={outOfStock}
                  className="flex-1 border border-ink bg-ink px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted"
                >
                  <ShoppingBag size={12} className="-mt-0.5 mr-1.5 inline" />
                  {outOfStock ? 'Unavailable' : 'Add to bag'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(item.productId)}
                  disabled={busy}
                  aria-label="Remove from wishlist"
                  className="flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}
