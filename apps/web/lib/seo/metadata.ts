import type { Metadata } from 'next';
import { SITE_URL, brand } from '@/config/brand';
import { buildCanonical } from './canonical';
import { truncate } from './truncate';

/**
 * Shared metadata helper. Every route-specific factory composes on top of this
 * so metadataBase, hreflang, Twitter card defaults, and OG fallbacks are
 * consistent across the site.
 */

export interface BuildMetadataArgs {
  title: string;
  description: string;
  /** Path without query string, leading slash, no trailing slash (except root). */
  pathname: string;
  /** Raw search params from the route. Canonical strips tracking/filter noise. */
  searchParams?: Record<string, string | string[] | undefined>;
  /** Allowlist of query params that SHOULD appear in the canonical URL. */
  canonicalAllowed?: readonly string[];
  /** Absolute or site-relative image URL for OG/Twitter cards. */
  images?: {
    url: string;
    width?: number;
    height?: number;
    alt?: string;
  }[];
  /** Optional route-specific robots override. */
  robots?: Metadata['robots'];
  /**
   * OG type. Defaults to 'website'. Next.js's Metadata API only accepts a
   * narrow set of og:type values at runtime — 'product' is a valid OG protocol
   * value but rejected here, so product/bundle pages stay on 'website'.
   */
  ogType?: 'website' | 'article' | 'profile' | 'book';
  /** Published/modified times for articles. */
  publishedTime?: string;
  modifiedTime?: string;
  /** Author byline, for article pages. */
  authors?: string[];
}

const DESC_MAX = 160;

export function buildMetadata({
  title,
  description,
  pathname,
  searchParams,
  canonicalAllowed,
  images,
  robots,
  ogType = 'website',
  publishedTime,
  modifiedTime,
  authors,
}: BuildMetadataArgs): Metadata {
  const desc = truncate(description, DESC_MAX);
  const canonical = buildCanonical({
    pathname,
    searchParams,
    overrideAllowed: canonicalAllowed,
  });
  const ogImages =
    images && images.length > 0
      ? images
      : [brand.defaultOgImage];

  return {
    title,
    description: desc,
    alternates: {
      canonical,
      languages: {
        'en-BD': canonical,
      },
    },
    openGraph: {
      type: ogType as 'website',
      title,
      description: desc,
      url: canonical,
      siteName: brand.displayName,
      locale: 'en_BD',
      images: ogImages,
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(authors && { authors }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      site: brand.twitter.site,
      creator: brand.twitter.creator,
      images: ogImages.map((img) => img.url),
    },
    robots,
  };
}

/** Shared default metadata for pages without custom overrides. */
export const defaultMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${brand.displayName} — ${brand.tagline}`,
    template: `%s — ${brand.displayName}`,
  },
  description: brand.description,
  applicationName: brand.displayName,
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'denim',
    'premium denim',
    'jeans',
    'Bangladesh denim',
    'men denim',
    'women denim',
    'denimisia',
  ],
  authors: [{ name: brand.displayName, url: SITE_URL }],
  creator: brand.displayName,
  publisher: brand.legalName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Intentionally no default alternates/canonical: per-page metadata inherits
  // partial values, so a root-level canonical would leak "/" as the canonical
  // URL onto every list page that only overrides title/description.
  openGraph: {
    type: 'website',
    siteName: brand.displayName,
    locale: 'en_BD',
    title: `${brand.displayName} — ${brand.tagline}`,
    description: brand.description,
    images: [brand.defaultOgImage],
  },
  twitter: {
    card: 'summary_large_image',
    site: brand.twitter.site,
    creator: brand.twitter.creator,
    title: `${brand.displayName} — ${brand.tagline}`,
    description: brand.description,
    images: [brand.defaultOgImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

/**
 * Route-level metadata for thin/private pages that should never index. We
 * keep follow=true so Googlebot can still traverse internal links (e.g.
 * "continue shopping" CTAs). Standard noindex-follow pattern for auth pages.
 */
export const noindexRobots: NonNullable<Metadata['robots']> = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
};
