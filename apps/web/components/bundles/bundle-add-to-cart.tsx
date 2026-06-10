'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useCart } from '@/stores/cart';
import type { PlaceholderBundle } from '@/lib/placeholder-bundles';

interface BundleAddToCartProps {
  bundle: PlaceholderBundle;
}

function formatPrice(value: number): string {
  return `BDT ${value.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

export function BundleAddToCart({ bundle }: BundleAddToCartProps) {
  const addItem = useCart((s) => s.addItem);
  const openCart = useCart((s) => s.openCart);
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    addItem({
      variantId: `bundle:${bundle.slug}`,
      productId: `bundle:${bundle.slug}`,
      productName: bundle.name,
      productSlug: bundle.slug,
      image: bundle.heroImage,
      color: 'Bundle',
      size: `${bundle.items.length} items`,
      price: bundle.bundlePrice,
      qty: 1,
    });
    setJustAdded(true);
    openCart();
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      aria-live="polite"
      className="mt-auto flex w-full items-center justify-center gap-3 bg-ink px-8 py-5 text-xs font-bold uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
    >
      {justAdded ? (
        <>
          <Check size={16} strokeWidth={2.5} />
          Added to Cart
        </>
      ) : (
        <>Add Bundle to Cart — {formatPrice(bundle.bundlePrice)}</>
      )}
    </button>
  );
}
