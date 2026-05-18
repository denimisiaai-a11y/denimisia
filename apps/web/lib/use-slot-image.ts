'use client';

import { useEffect, useState } from 'react';
import {
  fetchPageSlots,
  pickSlot,
  resolveSlotUrl,
  type MediaKind,
} from '@/lib/page-slots';

interface UseSlotImageResult {
  readonly src: string;
  readonly kind: MediaKind;
  readonly poster: string | null;
  readonly altText: string | null;
  readonly isLoading: boolean;
}

/**
 * Client-side slot image fetcher for client components that cannot import
 * the server-rendered <SlotHero> / <AuthEditorialPanel> directly.
 *
 * First paint uses the fallback src so the layout does not shift. The
 * resolved slot src (if any) swaps in once the API responds. On error,
 * the fallback remains.
 */
export function useSlotImage(
  pageKey: string,
  slotKey: string,
  fallbackSrc: string,
): UseSlotImageResult {
  const [result, setResult] = useState<UseSlotImageResult>({
    src: fallbackSrc,
    kind: 'IMAGE',
    poster: null,
    altText: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetchPageSlots(pageKey)
      .then((slots) => {
        if (cancelled) return;
        const slot = pickSlot(slots, slotKey);
        const { src, kind, poster } = resolveSlotUrl(slot, fallbackSrc);
        setResult({
          src,
          kind,
          poster,
          altText: slot?.altText ?? null,
          isLoading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({
          src: fallbackSrc,
          kind: 'IMAGE',
          poster: null,
          altText: null,
          isLoading: false,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [pageKey, slotKey, fallbackSrc]);

  return result;
}
