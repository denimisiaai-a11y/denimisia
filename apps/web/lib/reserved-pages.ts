import type { Metadata } from 'next';
import { SITE_URL } from '@/config/brand';
import { noindexRobots } from '@/lib/seo/metadata';

/**
 * Reserved future URLs. They render a branded "coming soon" placeholder so the
 * paths are claimed (no 404) and reachable, but are `noindex` until real
 * content ships (thin placeholder pages shouldn't be indexed). When a section
 * goes live, replace its route with the real page and drop the noindex.
 */
export interface ReservedPage {
  title: string;
  eyebrow: string;
  description: string;
}

export const RESERVED_PAGES = {
  blog: {
    title: 'Blog',
    eyebrow: 'Coming Soon',
    description:
      'The Denimisia blog is on its way — notes on craft, fit, and the making of considered denim.',
  },
  news: {
    title: 'News',
    eyebrow: 'Coming Soon',
    description: 'Brand news and announcements are launching here shortly.',
  },
  journal: {
    title: 'Journal',
    eyebrow: 'Coming Soon',
    description:
      'Our journal — stories on denim, craft, and the people behind the label — arrives soon.',
  },
  press: {
    title: 'Press',
    eyebrow: 'Coming Soon',
    description:
      'Press resources and media coverage will live here. For enquiries, reach us via Contact.',
  },
  media: {
    title: 'Media',
    eyebrow: 'Coming Soon',
    description: 'Our media library and brand assets are coming soon.',
  },
  lookbook: {
    title: 'Lookbook',
    eyebrow: 'Coming Soon',
    description:
      'The seasonal lookbook is being shot. Check back soon to see the collection styled in full.',
  },
  editorial: {
    title: 'Editorial',
    eyebrow: 'Coming Soon',
    description: 'Editorial features and styling stories are launching here shortly.',
  },
  sustainability: {
    title: 'Sustainability',
    eyebrow: 'Coming Soon',
    description:
      'How we think about durable fabrics, responsible making, and lasting design — coming soon.',
  },
  sustainable: {
    title: 'Sustainability',
    eyebrow: 'Coming Soon',
    description:
      'How we think about durable fabrics, responsible making, and lasting design — coming soon.',
  },
  ethical: {
    title: 'Ethical Sourcing',
    eyebrow: 'Coming Soon',
    description:
      'Our approach to fair, ethical sourcing and the partners we work with — details coming soon.',
  },
  'supply-chain': {
    title: 'Supply Chain',
    eyebrow: 'Coming Soon',
    description:
      'Transparency on where and how our denim is made — our supply-chain story is coming soon.',
  },
  'our-story': {
    title: 'Our Story',
    eyebrow: 'Coming Soon',
    description:
      'The story behind Denimisia — why we started and what we make — is being written. Stay tuned.',
  },
  'our-process': {
    title: 'Our Process',
    eyebrow: 'Coming Soon',
    description:
      'From fabric to finish — a look at how each piece is made. Coming soon.',
  },
  wholesale: {
    title: 'Wholesale',
    eyebrow: 'Coming Soon',
    description:
      'Wholesale and stockist information is on its way. For early enquiries, please use Contact.',
  },
  'bulk-order': {
    title: 'Bulk Orders',
    eyebrow: 'Coming Soon',
    description:
      'Bulk and corporate ordering is coming soon. For early enquiries, please reach us via Contact.',
  },
  'business-order': {
    title: 'Business Orders',
    eyebrow: 'Coming Soon',
    description:
      'Business and corporate ordering is coming soon. For early enquiries, please reach us via Contact.',
  },
} satisfies Record<string, ReservedPage>;

export type ReservedSlug = keyof typeof RESERVED_PAGES;

export function reservedMetadata(slug: ReservedSlug): Metadata {
  const page = RESERVED_PAGES[slug];
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `${SITE_URL}/${slug}` },
    robots: noindexRobots,
  };
}
