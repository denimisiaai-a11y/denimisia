import { ImageResponse } from 'next/og';

// Browsers and many crawlers auto-request /favicon.ico regardless of the
// <link rel="icon"> tags. We already ship app/icon.svg for modern browsers,
// but /favicon.ico itself was 404-ing. Serve a 32x32 PNG monogram here (modern
// UAs accept PNG content for favicon.ico). force-static so it's cached.
export const dynamic = 'force-static';
export const contentType = 'image/png';

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
          fontSize: 22,
          fontWeight: 600,
        }}
      >
        D
      </div>
    ),
    { width: 32, height: 32 },
  );
}
