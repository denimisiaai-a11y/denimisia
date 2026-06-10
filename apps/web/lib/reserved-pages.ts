import type { Metadata } from 'next';
import { SITE_URL } from '@/config/brand';
import { noindexRobots } from '@/lib/seo/metadata';

/**
 * Reserved future URLs. They render a "coming soon" placeholder so the paths
 * are claimed (no 404) and reachable, but are noindex until real content
 * ships. When a section goes live, replace its route with the real page and
 * drop the noindex.
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
    description: 'Our blog is coming soon.',
  },
  news: {
    title: 'News',
    eyebrow: 'Coming Soon',
    description: 'News and announcements are coming soon.',
  },
  journal: {
    title: 'Journal',
    eyebrow: 'Coming Soon',
    description: 'Our journal is coming soon.',
  },
  press: {
    title: 'Press',
    eyebrow: 'Coming Soon',
    description: 'Press resources are coming soon. For enquiries, use our contact page.',
  },
  media: {
    title: 'Media',
    eyebrow: 'Coming Soon',
    description: 'Our media library is coming soon.',
  },
  lookbook: {
    title: 'Lookbook',
    eyebrow: 'Coming Soon',
    description: 'The lookbook is coming soon.',
  },
  editorial: {
    title: 'Editorial',
    eyebrow: 'Coming Soon',
    description: 'Editorial features are coming soon.',
  },
  sustainability: {
    title: 'Sustainability',
    eyebrow: 'Coming Soon',
    description: 'Our sustainability page is coming soon.',
  },
  sustainable: {
    title: 'Sustainability',
    eyebrow: 'Coming Soon',
    description: 'Our sustainability page is coming soon.',
  },
  ethical: {
    title: 'Ethical Sourcing',
    eyebrow: 'Coming Soon',
    description: 'Our ethical sourcing page is coming soon.',
  },
  'supply-chain': {
    title: 'Supply Chain',
    eyebrow: 'Coming Soon',
    description: 'Our supply chain page is coming soon.',
  },
  'our-story': {
    title: 'Our Story',
    eyebrow: 'Coming Soon',
    description: 'Our story is coming soon.',
  },
  'our-process': {
    title: 'Our Process',
    eyebrow: 'Coming Soon',
    description: 'Our process is coming soon.',
  },
  wholesale: {
    title: 'Wholesale',
    eyebrow: 'Coming Soon',
    description: 'Wholesale information is coming soon. For enquiries, use our contact page.',
  },
  'bulk-order': {
    title: 'Bulk Orders',
    eyebrow: 'Coming Soon',
    description: 'Bulk ordering is coming soon. For enquiries, use our contact page.',
  },
  'business-order': {
    title: 'Business Orders',
    eyebrow: 'Coming Soon',
    description: 'Business ordering is coming soon. For enquiries, use our contact page.',
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
