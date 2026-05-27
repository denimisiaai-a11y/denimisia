import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return '৳' + new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Resolve the display price + the strikethrough comparison for a product
 * card / PDP. When the API returns an active campaign, the campaign's
 * finalPrice becomes the headline price and the original product price
 * becomes the strikethrough. Otherwise returns the raw price with no
 * comparison.
 *
 * Accepts both string (Prisma Decimal) and number price inputs so callers
 * can pass API rows directly.
 */
export function priceWithCampaign(input: {
  price: string | number;
  activeCampaign?: { finalPrice: number } | null;
}): { price: number; originalPrice?: number } {
  const base = typeof input.price === 'string' ? Number(input.price) : input.price;
  if (input.activeCampaign) {
    return { price: input.activeCampaign.finalPrice, originalPrice: base };
  }
  return { price: base };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .trim();
}
