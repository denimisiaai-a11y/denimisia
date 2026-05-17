import { SITE_URL, brand } from '@/config/brand';
import { absoluteUrl } from '../canonical';
import { plainText } from '../truncate';
import type { JsonLdNode } from './types';

interface ArticleLike {
  title: string;
  slug: string;
  body?: string;
  excerpt?: string | null;
  coverImage?: string | null;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}

export function articleJsonLd(post: ArticleLike): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${absoluteUrl(`/blog/${post.slug}`)}#article`,
    headline: post.title,
    description: post.excerpt ? plainText(post.excerpt, 300) : undefined,
    // articleBody must be plain text per schema.org — strip markdown/HTML
    // and cap length to avoid gigantic payload.
    articleBody: post.body ? plainText(post.body, 5000) : undefined,
    image: post.coverImage ?? brand.defaultOgImage.url,
    author: {
      '@type': 'Person',
      name: post.author ?? brand.displayName,
    },
    publisher: { '@id': `${SITE_URL}/#organization` },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(`/blog/${post.slug}`),
    },
    inLanguage: 'en-BD',
  };
}
