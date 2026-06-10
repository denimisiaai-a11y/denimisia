import { ImageResponse } from 'next/og';
import { brand } from '@/config/brand';

// Sitewide social-share image, generated at the edge (no static asset needed).
// The metadata layer (lib/seo/metadata.ts) already points og:image and
// twitter:image at `${SITE_URL}/opengraph-image`; this route serves it, fixing
// the previous 404 that made every non-product page share a blank preview.
// Replace with art-directed imagery when a hero asset is available.
export const alt = brand.defaultOgImage.alt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#030302',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            letterSpacing: 18,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 40,
          }}
        >
          Premium Denim
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          {brand.displayName.toUpperCase()}
        </div>
        <div
          style={{
            display: 'flex',
            width: 88,
            height: 2,
            background: 'rgba(255,255,255,0.3)',
            margin: '44px 0',
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 34,
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          {brand.tagline}
        </div>
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 52,
            fontSize: 20,
            letterSpacing: 10,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Made in Bangladesh
        </div>
      </div>
    ),
    { ...size },
  );
}
