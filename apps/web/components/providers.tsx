'use client';

import { Suspense } from 'react';
import { SessionProvider } from 'next-auth/react';
import { WishlistSync } from './wishlist-sync';

// SessionProvider uses useSearchParams internally. Without a Suspense boundary
// here, every page transitively opts out of static prerender, which breaks
// `next build` on any route that's otherwise eligible for SSG.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SessionProvider>
        <WishlistSync />
        {children}
      </SessionProvider>
    </Suspense>
  );
}
