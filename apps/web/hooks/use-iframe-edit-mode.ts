'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Returns true when the storefront is rendered inside the admin CMS preview
 * iframe (URL has `?edit=1` AND we're actually in a nested browsing context).
 *
 * Heavy chrome (splash, navbar, footer, cart drawer, signup sticker) should
 * unmount in edit mode so the admin iframe shows only the content being
 * edited, not the full user-flow surface.
 *
 * The URL param is checked synchronously (same render as SSR) so server and
 * first client paint agree. The iframe check is a second render — on plain
 * storefront navigations with `?edit=1` typed into the address bar (which
 * shouldn't happen in practice), chrome still renders after first paint.
 */
export function useIframeEditMode(): boolean {
  const params = useSearchParams();
  const editParam = params?.get('edit') === '1';
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setInIframe(window.self !== window.top);
  }, []);

  return editParam && inIframe;
}

/**
 * Synchronous URL-only variant. Safe for SSR. Use when you need chrome to
 * disappear on the server render (no hydration flash). Slightly less strict
 * — a user visiting `/?edit=1` directly also gets chrome hidden, which is
 * acceptable since the URL is internal.
 */
export function useEditModeUrlOnly(): boolean {
  const params = useSearchParams();
  return params?.get('edit') === '1';
}
