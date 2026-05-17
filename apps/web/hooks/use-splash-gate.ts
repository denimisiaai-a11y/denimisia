'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'denimisia:splash-seen';
const AUTO_DISMISS_MS = 3000;
const HINT_DELAY_MS = 1000;
const SWIPE_THRESHOLD_PX = 50;

interface SplashGateState {
  isActive: boolean;
  showHint: boolean;
  dismiss: () => void;
}

function shouldSkipOnMount(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    if (window.sessionStorage.getItem(STORAGE_KEY) === '1') return true;
  } catch {
    // sessionStorage unavailable — still show, just can't persist
  }

  try {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (nav?.type === 'back_forward') return true;
  } catch {
    // performance API unavailable
  }

  return false;
}

export function useSplashGate(enabled: boolean): SplashGateState {
  const [isActive, setIsActive] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    // React has hydrated and taken ownership — hide the SSR prerender overlay
    // immediately, regardless of whether the splash animation runs or skips.
    // Without this, the z-99 prerender div can persist and cover the homepage
    // after the React splash dismisses (clicks pass through via pointer-events:
    // none, but the screen stays black).
    document.documentElement.setAttribute('data-splash-handed-off', '');
    if (shouldSkipOnMount()) return;
    setIsActive(true);
  }, [enabled]);

  const dismiss = useCallback(() => {
    setIsActive((active) => {
      if (!active) return active;
      try {
        window.sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // ignore storage failure — dismissal still works for current view
      }
      // Redundant safety: ensure prerender stays hidden after React splash fades.
      document.documentElement.setAttribute('data-splash-handed-off', '');
      return false;
    });
  }, []);

  useEffect(() => {
    if (!isActive) return;

    // React-managed splash is now covering the SSR overlay — mark the handoff
    // so CSS hides the prerender div. React keeps ownership of the element
    // (no DOM removal, no reconciliation crash).
    document.documentElement.setAttribute('data-splash-handed-off', '');

    const hintTimer = window.setTimeout(() => setShowHint(true), HINT_DELAY_MS);
    const autoTimer = window.setTimeout(dismiss, AUTO_DISMISS_MS);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      }
    };

    const onWheel = () => dismiss();

    let touchStartY: number | null = null;
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (touchStartY === null) return;
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      if (touchStartY - endY > SWIPE_THRESHOLD_PX) dismiss();
      touchStartY = null;
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(hintTimer);
      window.clearTimeout(autoTimer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [isActive, dismiss]);

  return { isActive, showHint, dismiss };
}
