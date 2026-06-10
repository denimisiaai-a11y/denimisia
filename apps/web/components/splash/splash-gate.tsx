'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useSplashGate } from '@/hooks/use-splash-gate';
import { useEditModeUrlOnly } from '@/hooks/use-iframe-edit-mode';
import { useSplash } from './splash-provider';
import { SplashShader } from './splash-shader';

const EASE_EXPO_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;

export function SplashGate() {
  const pathname = usePathname();
  const editMode = useEditModeUrlOnly();
  const enabled = pathname === '/' && !editMode;
  const { isActive, showHint, dismiss } = useSplashGate(enabled);
  const { setSplashActive } = useSplash();

  useEffect(() => {
    setSplashActive(isActive);
    return () => setSplashActive(false);
  }, [isActive, setSplashActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="denimisia-splash-gate"
          role="dialog"
          aria-label="Welcome to Denimisia"
          onClick={dismiss}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE_STANDARD }}
          className="fixed inset-0 z-[100] flex cursor-pointer select-none items-center justify-center overflow-hidden bg-[#030302]"
        >
          <SplashShader />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.35)_70%,rgba(0,0,0,0.6)_100%)]" />
          <div className="relative z-10 flex flex-col items-center gap-5">
            <motion.span
              layoutId="denimisia-brand-mark"
              initial={{ opacity: 0, y: 80, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                opacity: { duration: 1.1, ease: EASE_EXPO_OUT },
                y: { duration: 1.3, ease: EASE_EXPO_OUT },
                scale: { duration: 1.3, ease: EASE_EXPO_OUT },
                layout: { duration: 1.2, ease: EASE_EXPO_OUT },
                default: { duration: 1.2, ease: EASE_EXPO_OUT },
              }}
              className="text-[clamp(2.2rem,11vw,4.2rem)] font-semibold uppercase tracking-[0.18em] text-white md:text-[6.3rem] md:tracking-[0.3em]"
            >
              DENIMISIA
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3, duration: 1.1, ease: EASE_EXPO_OUT }}
              className="text-[11px] uppercase tracking-[0.2em] text-white/50"
            >
              Made in Bangladesh
            </motion.span>
          </div>
          <motion.span
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: showHint ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_STANDARD }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/40"
          >
            Tap to enter
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
