'use client';

import { useState, useEffect, useRef } from 'react';

interface ScrollState {
  direction: 'up' | 'down' | 'none';
  isAtTop: boolean;
  scrollY: number;
}

export function useScrollDirection(threshold = 80): ScrollState {
  const [state, setState] = useState<ScrollState>({
    direction: 'none',
    isAtTop: true,
    scrollY: 0,
  });
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const updateScroll = () => {
      const currentY = window.scrollY;
      const isAtTop = currentY < threshold;
      const direction =
        currentY > lastScrollY.current ? 'down' : currentY < lastScrollY.current ? 'up' : state.direction;

      setState({ direction, isAtTop, scrollY: currentY });
      lastScrollY.current = currentY;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScroll);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, state.direction]);

  return state;
}
