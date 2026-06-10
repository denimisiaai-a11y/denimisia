/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      { protocol: 'https', hostname: 'storola-client-space.sgp1.cdn.digitaloceanspaces.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Supabase storage covers legacy media that pre-dates the R2 migration.
      // Admin previews of those assets render through here until they are
      // copied over via scripts/migrate-supabase-to-r2.ts.
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  // Security headers. `unsafe-inline`/`unsafe-eval` on script-src are required
  // by Next 16 in dev (HMR + React Refresh). Tighten to a nonce strategy in prod.
  // `frame-src` permits embedding the storefront for the WYSIWYG CMS preview.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 'interest-cohort' (FLoC opt-out) is deprecated — Chrome/Brave 100+
          // stopped recognising it and print a console warning. Removed.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            // connect-src must allow direct-browser-to-R2 uploads. The S3 API
            // endpoint is `*.r2.cloudflarestorage.com` (per-bucket subdomain
            // prefix). The public CDN is `*.r2.dev`. Listing the full hosts
            // here would tie the CSP to one bucket; the wildcards stay
            // future-proof across bucket rotations.
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' http://localhost:3001 https://denimisiabd.com https://*.denimisiabd.com https://*.denimisia.com https://*.r2.cloudflarestorage.com https://*.r2.dev; frame-src 'self' http://localhost:3000 https://denimisiabd.com https://*.denimisiabd.com https://*.denimisia.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
