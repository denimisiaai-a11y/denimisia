import { cache } from 'react';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogPostBySlug } from '@/lib/api';

// React cache dedupes per-request so generateMetadata and the page render
// share a single API call rather than hitting the backend twice.
const loadPost = cache(async (slug: string) => {
  try {
    return await getBlogPostBySlug(slug);
  } catch {
    return null;
  }
});
import { JsonLd } from '@/components/seo/json-ld';
import { generateBlogMetadata } from '@/lib/seo/blog';
import { buildFallbackMetadata } from '@/lib/seo/defaults';
import { articleJsonLd } from '@/lib/seo/jsonld/article';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld/breadcrumb';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) return buildFallbackMetadata({ pathname: `/blog/${slug}` });
  const authorName = post.author
    ? `${post.author.firstName} ${post.author.lastName}`.trim()
    : undefined;
  return generateBlogMetadata({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? null,
    body: post.body,
    coverImage: post.coverImage ?? null,
    publishedAt: post.publishedAt ?? undefined,
    updatedAt: post.publishedAt ?? undefined,
    author: authorName,
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await loadPost(slug);
  if (!post) notFound();

  const authorName = post.author
    ? `${post.author.firstName} ${post.author.lastName}`.trim()
    : 'Denimisia';

  return (
    <article className="pb-20">
      <JsonLd
        id="ld-article"
        data={[
          articleJsonLd({
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? null,
            body: post.body,
            coverImage: post.coverImage ?? null,
            author: authorName,
            publishedAt: post.publishedAt ?? undefined,
            updatedAt: post.publishedAt ?? undefined,
          }),
          breadcrumbJsonLd([
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />
      {/* Cover Image */}
      {post.coverImage && (
        <div className="relative h-[40vh] min-h-[300px] w-full bg-muted-bg md:h-[50vh]">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-ink/30" />
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 pt-12 lg:px-0">
        {/* Back link */}
        <Link
          href="/blog"
          className="mb-8 inline-block text-xs font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:text-ink"
        >
          &larr; Back to Blog
        </Link>

        {/* Header */}
        <header className="mb-10">
          {post.publishedAt && (
            <time className="mb-3 block text-[11px] uppercase tracking-[0.1em] text-muted">
              {formatDate(post.publishedAt)}
            </time>
          )}

          <h1 className="mb-4 text-2xl font-medium leading-tight text-ink md:text-3xl lg:text-4xl">
            {post.title}
          </h1>

          <p className="text-xs text-muted">
            By <span className="font-medium text-ink">{authorName}</span>
          </p>
        </header>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="mb-8 border-l-2 border-ink pl-4 text-sm italic leading-relaxed text-muted">
            {post.excerpt}
          </p>
        )}

        {/* Body */}
        <div className="space-y-5 text-sm leading-relaxed text-muted">
          {post.body.split('\n').filter(Boolean).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mt-12 border-t border-border pt-6">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted-bg px-3 py-1 text-[11px] uppercase tracking-[0.05em] text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-16 border-t border-border pt-8 text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.15em] text-muted">
            Continue Reading
          </p>
          <Link
            href="/blog"
            className="btn-pill btn-pill-white border border-ink text-xs"
          >
            All Posts
          </Link>
        </div>
      </div>
    </article>
  );
}
