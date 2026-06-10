/**
 * In-browser cache for full-product responses keyed by slug. Storefront calls
 * `prefetchProduct(slug)` when a card is hovered or focused; the QuickView
 * modal awaits the same promise on open, so the user usually sees a fully-
 * hydrated modal instead of a 2-second LOADING button.
 *
 * Pairs with the 60s Redis cache on /products/:slug — first hover anywhere
 * warms both caches; later hovers hit the in-memory promise and never touch
 * the network.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// In-memory promise cache. Promises (not resolved values) so concurrent
// hovers/clicks share a single in-flight request instead of racing.
const cache = new Map<string, Promise<unknown>>();

export function prefetchProduct(slug: string): Promise<unknown> {
  if (!slug) return Promise.resolve(null);
  let p = cache.get(slug);
  if (!p) {
    p = fetch(`${API}/products/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && typeof json === 'object' && 'success' in json && (json as { success: boolean }).success) {
          return (json as { data: unknown }).data;
        }
        return null;
      })
      .catch(() => null);
    cache.set(slug, p);
  }
  return p;
}

export function getCachedProduct(slug: string): Promise<unknown> | undefined {
  return cache.get(slug);
}
