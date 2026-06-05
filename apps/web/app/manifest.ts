import type { MetadataRoute } from 'next';
import { brand } from '@/config/brand';

// PWA web app manifest — gives the site an installable identity (name, theme,
// icon) for "Add to Home Screen" on Android/iOS. Theme color matches the
// brand ink (#030302). Icons reference the existing SVG favicon plus the
// generated apple-icon PNG; replace with a maskable PNG logo when available.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.displayName,
    short_name: brand.displayName,
    description: brand.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#030302',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
