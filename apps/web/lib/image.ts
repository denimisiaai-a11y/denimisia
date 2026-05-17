import type { ImageVariantName } from '@repo/types';

// Storefront image variant resolver.
//
// Admin uploads originals to R2; the API generates resized WebP variants on
// upload at predictable sibling keys: `products/abc.jpg` →
// `products/abc-{thumb,card,hero}.webp`. This helper converts an original URL
// to the variant URL the storefront should request.
//
// Naming convention MUST stay in sync with apps/api/.../uploads.service.ts
// `buildVariantKey()` — both consume the variant names from @repo/types.
//
// Falls back to the original URL when:
//  - The URL is empty / null
//  - The URL is from a CDN we don't own (e.g. legacy Storola CDN, hot-linked
//    image URLs pasted by admins). We can't synthesize variants for those.
//
// Runtime fallback (variant 404 → original) is handled by the
// <ImageWithFallback> component; this helper only handles URL shape.

export type ImageVariant = ImageVariantName | 'original';

function ownedPublicPrefixes(): string[] {
  const raw = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((s) => `${s}/`);
}

export function getImageVariant(
  url: string | null | undefined,
  variant: ImageVariant = 'card',
): string {
  if (!url) return '';
  if (variant === 'original') return url;

  const prefixes = ownedPublicPrefixes();
  const prefix = prefixes.find((p) => url.startsWith(p));
  if (!prefix) return url;

  const path = url.slice(prefix.length);
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return url;

  const folder = path.slice(0, lastSlash);
  const filename = path.slice(lastSlash + 1);
  const lastDot = filename.lastIndexOf('.');
  const baseName = lastDot === -1 ? filename : filename.slice(0, lastDot);

  return `${prefix}${folder}/${baseName}-${variant}.webp`;
}

/** True when the URL points at a bucket we manage (and can derive variants from). */
export function isOwnedImage(url: string | null | undefined): boolean {
  if (!url) return false;
  return ownedPublicPrefixes().some((p) => url.startsWith(p));
}
