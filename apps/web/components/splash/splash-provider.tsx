'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface SplashContextValue {
  isSplashActive: boolean;
  setSplashActive: (active: boolean) => void;
}

const SplashContext = createContext<SplashContextValue>({
  isSplashActive: false,
  setSplashActive: () => {},
});

export function SplashProvider({ children }: { children: ReactNode }) {
  const [isSplashActive, setSplashActive] = useState(false);
  const value = useMemo(
    () => ({ isSplashActive, setSplashActive }),
    [isSplashActive]
  );
  return <SplashContext.Provider value={value}>{children}</SplashContext.Provider>;
}

export function useSplash(): SplashContextValue {
  return useContext(SplashContext);
}
