'use client';

import { useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/stores/wishlist';

interface WishlistButtonProps {
  productId: string;
  size?: number;
  className?: string;
  variant?: 'card' | 'detail' | 'ghost';
}

export function WishlistButton({
  productId,
  size = 18,
  className = '',
  variant = 'card',
}: WishlistButtonProps) {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? null;
  const isAuthenticated = status === 'authenticated' && !!accessToken;

  const isIn = useWishlist((s) =>
    isAuthenticated
      ? s.productIds.has(productId)
      : s.guestProductIds.includes(productId),
  );
  const pending = useWishlist((s) => s.pendingIds.has(productId));
  const toggle = useWishlist((s) => s.toggle);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (pending) return;
      try {
        await toggle(accessToken, productId);
      } catch {
        // store rolls back optimistic state; silent UI
      }
    },
    [accessToken, pending, productId, toggle],
  );

  const baseClass =
    variant === 'card'
      ? 'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur transition-all hover:bg-paper'
      : variant === 'detail'
        ? 'flex h-11 w-11 items-center justify-center border border-border text-ink transition-colors hover:bg-[var(--color-surface-low)]'
        : 'inline-flex items-center justify-center text-ink/70 hover:text-ink';

  const pendingClass = pending ? 'opacity-60' : '';
  const filledClass = isIn ? 'text-[#c0392b]' : '';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={isIn}
      aria-label={isIn ? 'Remove from wishlist' : 'Add to wishlist'}
      className={`${baseClass} ${pendingClass} ${filledClass} ${className}`.trim()}
    >
      <Heart
        size={size}
        strokeWidth={1.5}
        fill={isIn ? 'currentColor' : 'none'}
        className={pending ? '' : 'transition-transform active:scale-90'}
      />
    </button>
  );
}
