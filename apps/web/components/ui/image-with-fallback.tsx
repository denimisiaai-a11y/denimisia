'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';
import { getImageVariant, isOwnedImage, type ImageVariant } from '@/lib/image';

interface Props extends Omit<ImageProps, 'src'> {
  /** Original (full-size) image URL, as stored in product.images[]. */
  originalSrc: string;
  /** Variant to request first; falls back to the original on 404 or network error. */
  variant?: ImageVariant;
}

/**
 * Variant-aware Next.js <Image>. Requests the variant URL first; if that
 * 404s (variant generation failed, never ran, or was deleted), silently
 * falls back to the original. Non-owned URLs (e.g. legacy Storola CDN) skip
 * the variant logic entirely and render as-is.
 *
 * The fallback is best-effort: if the original is also 404, Next.js renders
 * a broken-image icon as usual.
 */
export function ImageWithFallback({
  originalSrc,
  variant = 'card',
  alt,
  ...rest
}: Props) {
  const [fellBack, setFellBack] = useState(false);
  const owned = isOwnedImage(originalSrc);
  const variantSrc = owned
    ? getImageVariant(originalSrc, variant)
    : originalSrc;
  const src = fellBack || !owned ? originalSrc : variantSrc;

  return (
    <Image
      {...rest}
      src={src}
      alt={alt}
      onError={() => {
        if (!fellBack && owned && src !== originalSrc) setFellBack(true);
      }}
    />
  );
}
