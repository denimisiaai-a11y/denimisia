import { Header, applyDecorators } from '@nestjs/common';

/**
 * Marks a public GET endpoint as cacheable by shared caches (Cloudflare,
 * Vercel Edge, browsers). Use only on endpoints that return data identical
 * for all clients — never on user-scoped data (cart, profile, orders).
 *
 * Defaults: fresh for 60s, may serve stale for 5 min while async-revalidating.
 * Override per-endpoint when the data changes more or less often.
 */
export const PublicCache = (
  sMaxAge = 60,
  staleWhileRevalidate = 300,
): MethodDecorator =>
  applyDecorators(
    Header(
      'Cache-Control',
      `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    ),
  );
