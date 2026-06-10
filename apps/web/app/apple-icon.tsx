import { ImageResponse } from 'next/og';

// Apple touch icon (home-screen icon on iOS). Generated to match the favicon
// (app/icon.svg): a serif "D" monogram on near-black. Previously missing, so
// iOS "Add to Home Screen" had no branded icon. Swap for a real logo asset
// when available.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 112,
          fontWeight: 600,
        }}
      >
        D
      </div>
    ),
    { ...size },
  );
}
