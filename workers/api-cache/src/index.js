/**
 * denimisia-api-cache
 *
 * Caches public catalog GETs at Cloudflare edge so Render free-plan cold
 * starts are invisible to customers.
 *
 * Free CF plan refuses to cache responses combining `Vary: Origin` with
 * `Access-Control-Allow-Credentials: true` — this Worker bypasses that
 * by managing the cache manually.
 *
 * Safety: try/catch wraps all cache logic. Any error falls through to a
 * direct origin fetch. Rollback: delete the Workers Route binding.
 */

const EDGE_TTL_SECONDS = 60;

const CACHEABLE_PATHS = [
  /^\/api\/v1\/products(?:\/|\?|$)/,
  /^\/api\/v1\/categories(?:\/|\?|$)/,
  /^\/api\/v1\/collections(?:\/|\?|$)/,
  /^\/api\/v1\/series(?:\/|\?|$)/,
  /^\/api\/v1\/bundles(?:\/|\?|$)/,
  /^\/api\/v1\/campaigns(?:\/|\?|$)/,
  /^\/api\/v1\/new-arrivals(?:\/|\?|$)/,
  /^\/api\/v1\/trending(?:\/|\?|$)/,
  /^\/api\/v1\/featured(?:\/|\?|$)/,
  /^\/api\/v1\/cms\/sections(?:\/|\?|$)/,
];

const NEVER_CACHE = [
  /^\/api\/v1\/auth(?:\/|$)/,
  /^\/api\/v1\/admin(?:\/|$)/,
  // Admin product reads live under /products/admin/:id, which matches the
  // /products cacheable prefix below — exclude them explicitly so they're
  // never served stale (e.g. a deleted variant lingering after a delete).
  /^\/api\/v1\/products\/admin(?:\/|$)/,
  /^\/api\/v1\/users(?:\/|$)/,
  /^\/api\/v1\/orders(?:\/|$)/,
  /^\/api\/v1\/cart(?:\/|$)/,
  /^\/api\/v1\/wishlist(?:\/|$)/,
  /^\/api\/v1\/inbox(?:\/|$)/,
  /^\/api\/v1\/handoff(?:\/|$)/,
  /^\/api\/v1\/returns(?:\/|$)/,
  /^\/api\/v1\/uploads(?:\/|$)/,
  /^\/api\/v1\/media(?:\/|$)/,
  /^\/api\/v1\/sse(?:\/|$)/,
  /^\/health/,
  /^\/ready/,
];

function isCacheable(path) {
  if (NEVER_CACHE.some((re) => re.test(path))) return false;
  return CACHEABLE_PATHS.some((re) => re.test(path));
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET') {
      const r = await fetch(request);
      const tagged = new Response(r.body, r);
      tagged.headers.set('X-Cache-Worker', 'denimisia-api-cache');
      tagged.headers.set('X-Cache-Status', 'PASSTHROUGH-METHOD');
      return tagged;
    }

    // Authenticated requests are private: never read from or write to the
    // shared edge cache. The cache key is the URL only (it ignores the token),
    // so caching an authed response would serve stale data after admin edits
    // and could hand one caller's authed response to another.
    if (request.headers.get('Authorization')) {
      const r = await fetch(request);
      const tagged = new Response(r.body, r);
      tagged.headers.set('X-Cache-Worker', 'denimisia-api-cache');
      tagged.headers.set('X-Cache-Status', 'PASSTHROUGH-AUTH');
      return tagged;
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (!isCacheable(path)) {
      const r = await fetch(request);
      const tagged = new Response(r.body, r);
      tagged.headers.set('X-Cache-Worker', 'denimisia-api-cache');
      tagged.headers.set('X-Cache-Status', 'PASSTHROUGH-PATH');
      return tagged;
    }

    try {
      const cacheKey = new Request(url.toString(), { method: 'GET' });
      const cache = caches.default;

      const cached = await cache.match(cacheKey);
      if (cached) {
        const r = new Response(cached.body, cached);
        r.headers.set('X-Cache-Worker', 'denimisia-api-cache');
        r.headers.set('X-Cache-Status', 'HIT');
        return r;
      }

      const originResponse = await fetch(request);

      if (originResponse.ok) {
        const forCache = new Response(originResponse.clone().body, originResponse);
        forCache.headers.delete('set-cookie');
        forCache.headers.set('Cache-Control', `public, max-age=${EDGE_TTL_SECONDS}`);
        ctx.waitUntil(cache.put(cacheKey, forCache));
      }

      const out = new Response(originResponse.body, originResponse);
      out.headers.set('X-Cache-Worker', 'denimisia-api-cache');
      out.headers.set('X-Cache-Status', originResponse.ok ? 'MISS' : 'MISS-NOCACHE');
      return out;
    } catch (err) {
      try {
        const r = await fetch(request);
        const tagged = new Response(r.body, r);
        tagged.headers.set('X-Cache-Worker', 'denimisia-api-cache');
        tagged.headers.set('X-Cache-Status', 'BYPASS-ERROR');
        tagged.headers.set('X-Cache-Error', String(err && err.message || err).slice(0, 200));
        return tagged;
      } catch {
        return new Response('Service unavailable', { status: 503 });
      }
    }
  },
};
