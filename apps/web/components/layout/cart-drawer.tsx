'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCart } from '@/stores/cart';
import { useEditModeUrlOnly } from '@/hooks/use-iframe-edit-mode';
import { useIsMobile } from '@/lib/mobile/use-media-query';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { CartScrollableBody, CartFooter } from './cart-content';
import { cn } from '@/lib/utils';

export function CartDrawer() {
  const editMode = useEditModeUrlOnly();
  const isMobile = useIsMobile();
  const { isOpen, closeCart, count } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen && !isMobile) {
      document.body.style.overflow = 'hidden';
    } else if (!isMobile) {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isMobile]);

  if (editMode) return null;

  if (mounted && isMobile) {
    return (
      <BottomSheet
        open={isOpen}
        onOpenChange={(o) => (o ? null : closeCart())}
        title="Cart"
        description={count() > 0 ? `${count()} ${count() === 1 ? 'item' : 'items'}` : undefined}
        footer={<CartFooter mounted={mounted} />}
      >
        <CartScrollableBody mounted={mounted} />
      </BottomSheet>
    );
  }

  const safeCount = mounted ? count() : 0;

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm transition-opacity duration-[450ms]',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeCart}
      />

      <aside
        aria-label="Shopping cart"
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-paper shadow-2xl transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-start justify-between border-b border-[var(--color-outline-variant)] px-6 py-5">
          <div>
            <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.35em] text-[var(--color-secondary)]">
              Your Selection
            </span>
            <h2 className="text-xl font-black uppercase leading-none tracking-tight text-ink">
              Cart
              {safeCount > 0 && (
                <span className="ml-2 text-ink/30">({safeCount})</span>
              )}
            </h2>
          </div>
          <button
            onClick={closeCart}
            aria-label="Close cart"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-low)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <CartScrollableBody mounted={mounted} />
        </div>

        <footer className="border-t border-[var(--color-outline-variant)] bg-paper">
          <CartFooter mounted={mounted} />
        </footer>
      </aside>
    </>
  );
}
