// Adapts an API `Bundle` (from lib/api.ts) into the rich `PlaceholderBundle`
// shape used by /bundles and /bundles/[slug] rendering. Keeps the existing
// subcomponents (BundleCard, BundleAddToCart, BundleItemsAccordion) usable
// without a separate render path for real-vs-placeholder data.

import type { Bundle, BundleItem } from '@/lib/api';
import type {
  PlaceholderBundle,
  PlaceholderBundleItem,
} from '@/lib/placeholder-bundles';
import { resolveProductImage } from '@/lib/placeholder-images';

// Old seed data baked /images/stitch/*.jpg paths that never shipped; treat
// them as "no image" so the optimizer doesn't 400.
function isUsableImage(src: string | null | undefined): src is string {
  return Boolean(src && !src.startsWith('/images/stitch/'));
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function itemToView(item: BundleItem): PlaceholderBundleItem {
  const image = item.product.images.find(isUsableImage)
    ?? resolveProductImage(undefined, item.product.slug);
  return {
    name: item.product.name,
    image,
    price: toNumber(item.product.price),
    quantity: 1,
    description:
      item.product.description?.trim() ||
      `Ships in ${item.color}.`,
    features: item.color ? [`Color · ${item.color}`] : [],
    productHref: `/products/${item.product.slug}`,
  };
}

export function bundleToView(bundle: Bundle): PlaceholderBundle {
  const items = bundle.items.map(itemToView);
  const heroImage =
    (isUsableImage(bundle.image) ? bundle.image : null) ??
    items[0]?.image ??
    resolveProductImage(undefined, bundle.slug);

  const originalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const bundlePrice = toNumber(bundle.bundlePrice);
  const savingsPercent =
    originalPrice > 0 && bundlePrice > 0 && bundlePrice < originalPrice
      ? Math.round(((originalPrice - bundlePrice) / originalPrice) * 100)
      : 0;

  return {
    slug: bundle.slug,
    name: bundle.name,
    eyebrow: bundle.badgeText,
    badgeText: bundle.badgeText,
    tagline: bundle.description?.split('\n')[0]?.slice(0, 140) ?? '',
    description: bundle.description ?? '',
    heroImage,
    gallery: items.map((i) => i.image).slice(0, 4),
    items,
    originalPrice: originalPrice || bundlePrice,
    bundlePrice,
    savingsPercent,
    category: 'signature',
  };
}
