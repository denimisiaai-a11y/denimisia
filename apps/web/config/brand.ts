/**
 * Denimisia brand identity. Single source of truth for Organization/LocalBusiness
 * schema, OG defaults, contact info, and social links.
 *
 * PLACEHOLDER values — replace TODO entries with real data before launch.
 * Non-URL social entries are filtered out at render time, so leaving "TODO"
 * strings in socialProfiles is safe but they will NOT surface.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://denimisiabd.com';

export const brand = {
  legalName: 'Denimisia',
  displayName: 'Denimisia',
  tagline: 'Premium denim and essentials. Crafted to last.',
  description:
    'Denimisia is a Bangladesh-based premium denim label — heritage fits, durable fabrics, and considered essentials designed to last.',
  foundingYear: 2024,

  logo: {
    url: `${SITE_URL}/brand/logo.png`,
    width: 512,
    height: 512,
  },

  defaultOgImage: {
    url: `${SITE_URL}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: 'Denimisia — Premium denim and essentials',
  },

  socialProfiles: [
    'https://www.facebook.com/denimisia',
    'https://www.instagram.com/denimisia.bd/',
    // 'https://www.youtube.com/@denimisia',
    // 'https://x.com/denimisia',
    // 'https://www.tiktok.com/@denimisia',
  ],

  contact: {
    email: 'hello@denimisia.com',
    phone: '+8801XXXXXXXXX',
    supportEmail: 'support@denimisia.com',
  },

  office: {
    name: 'Denimisia Showroom',
    streetAddress: 'TBD',
    addressLocality: 'Dhaka',
    addressRegion: 'Dhaka',
    postalCode: 'TBD',
    addressCountry: 'BD',
    geo: { latitude: 23.8103, longitude: 90.4125 },
    openingHours: ['Mo-Sa 10:00-20:00'],
    note: 'Come by to try on pieces before buying — by appointment preferred.',
  },

  twitter: {
    site: '@denimisia',
    creator: '@denimisia',
  },
} as const;

export type Brand = typeof brand;
