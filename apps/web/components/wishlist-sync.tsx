'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useWishlist } from '@/stores/wishlist';

export function WishlistSync() {
  const { data: session, status } = useSession();
  const hydrate = useWishlist((s) => s.hydrate);
  const mergeGuestIntoServer = useWishlist((s) => s.mergeGuestIntoServer);
  const resetServer = useWishlist((s) => s.resetServer);
  const prevStatusRef = useRef<typeof status>(status);

  useEffect(() => {
    if (status === 'loading') return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === 'authenticated' && session?.accessToken) {
      // Guest → authenticated transition: merge local into server, then rehydrate
      if (prev !== 'authenticated') {
        const token = session.accessToken;
        void mergeGuestIntoServer(token).then(() => {
          void hydrate(token);
        });
      } else {
        void hydrate(session.accessToken);
      }
    } else {
      // Unauthenticated (fresh mount or post-logout): clear server-side cache,
      // guest IDs in localStorage persist
      resetServer();
    }
  }, [status, session?.accessToken, hydrate, mergeGuestIntoServer, resetServer]);

  return null;
}
