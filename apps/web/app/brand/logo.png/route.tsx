import { ImageResponse } from 'next/og';

// Organization JSON-LD logo. config/brand.ts references this exact URL
// (`${SITE_URL}/brand/logo.png`); it previously 404'd, so Google's
// Organization/knowledge-panel logo enrichment failed and structured-data
// validators warned. Generated 512x512 monogram matching the favicon
// (app/icon.svg) and apple-icon. Swap for a real raster logo when available.
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#ffffff',
          fontFamily: 'serif',
          fontSize: 300,
          fontWeight: 600,
        }}
      >
        D
      </div>
    ),
    { width: 512, height: 512 },
  );
}
