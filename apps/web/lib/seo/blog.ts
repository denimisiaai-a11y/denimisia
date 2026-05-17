import type { Metadata } from 'next';
import { buildMetadata } from './metadata';
import { plainText } from './truncate';

interface BlogPostLike {
  title: string;
  slug: string;
  excerpt?: string | null;
  body?: string;
  coverImage?: string | null;
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
}

export function generateBlogMetadata(post: BlogPostLike): Metadata {
  const source = post.excerpt ?? post.body ?? 'Read the latest from Denimisia.';
  const desc = plainText(source, 160);

  return buildMetadata({
    title: post.title,
    description: desc,
    pathname: `/blog/${post.slug}`,
    ogType: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt ?? post.publishedAt,
    authors: post.author ? [post.author] : undefined,
    images: post.coverImage
      ? [{ url: post.coverImage, alt: post.title, width: 1200, height: 630 }]
      : undefined,
  });
}
