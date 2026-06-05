/* global process */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Catch errors at build time, not runtime
  typescript: { ignoreBuildErrors: false },

  // /500 is a path Vercel and the Pages-Router-era Next.js reserve internally
  // for the built-in error page. Defining an App Router page at
  // app/500/page.tsx silently fails — Vercel serves a 500-status fallback that
  // ignores our notFound() call. A routing-layer redirect sidesteps the
  // reservation entirely so users hitting /500 land cleanly on the homepage.
  //
  // The remaining redirects map common conventional URLs that previously
  // 404'd to their actual destinations:
  //   /signup       -> /register             (we use 'register', not 'signup')
  //   /wishlist     -> /account/wishlist     (auth-gated; middleware bounces guests to /login)
  //   /cart         -> /checkout             (cart UI is part of the checkout flow)
  //   /sitemap.xml  -> /sitemap-index.xml    (search engines look for /sitemap.xml by convention)
  async redirects() {
    return [
      { source: '/500', destination: '/', permanent: true },
      { source: '/signup', destination: '/register', permanent: true },
      { source: '/wishlist', destination: '/account/wishlist', permanent: false },
      { source: '/cart', destination: '/checkout', permanent: false },
      { source: '/sitemap.xml', destination: '/sitemap-index.xml', permanent: true },
    ];
  },

  images: {
    // Limit image sizes for faster loads
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/webp', 'image/avif'],
    // In dev, don't cache failed optimizer responses. The admin CMS preview
    // iframe triggers large bursts of optimizer requests that can saturate
    // the worker pool; cached 5xx responses would make images vanish on the
    // real storefront for a full minute. Prod keeps the default 30-day TTL.
    minimumCacheTTL: process.env.NODE_ENV === 'development' ? 0 : 2592000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storola-client-space.sgp1.cdn.digitaloceanspaces.com',
      },
      {
        // Cloudflare R2 public URL
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        // Unsplash (used in old seed data)
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        // Supabase Storage public bucket
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Security headers. frame-ancestors CSP supersedes X-Frame-Options and lets
  // us allow the admin origin to embed the storefront for WYSIWYG editing
  // while still blocking any other site.
  //
  // `unsafe-inline`/`unsafe-eval` on script-src are required by Next 16 in dev
  // (HMR + React Refresh). Tighten to a nonce strategy in prod.
  // X-XSS-Protection is set to '0' per current OWASP guidance â€” legacy browser
  // implementations contained their own XSS bugs; rely on CSP instead.
  async headers() {
    const adminOrigins = (process.env.NEXT_PUBLIC_ADMIN_ORIGINS ?? 'http://localhost:3002')
      .split(',').map((s) => s.trim()).filter(Boolean).join(' ');
    // Cloudflare Web Analytics: storefront benefits from analytics so the
    // beacon script + its POST endpoint are allowed. Safe to leave even if
    // CF Web Analytics is later disabled on this zone (no-op).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' http://localhost:3001 https://denimisiabd.com https://*.denimisiabd.com https://*.denimisia.com https://*.supabase.co https://*.r2.cloudflarestorage.com https://*.r2.dev cloudflareinsights.com",
      `frame-ancestors 'self' ${adminOrigins}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
