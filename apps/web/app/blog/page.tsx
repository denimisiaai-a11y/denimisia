import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getBlogPosts, type BlogPost } from '@/lib/api';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Blog',
  description: 'Stories, style guides, and news from Denimisia.',
  pathname: '/blog',
  canonicalAllowed: ['page'],
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="overflow-hidden rounded-sm border border-border bg-paper transition-shadow duration-300 hover:shadow-md">
        <div className="relative aspect-[16/9] bg-muted-bg">
          {post.coverImage ? (
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs uppercase tracking-[0.15em] text-muted">Denimisia</span>
            </div>
          )}
        </div>

        <div className="p-5">
          {post.publishedAt && (
            <time className="mb-2 block text-[11px] uppercase tracking-[0.1em] text-muted">
              {formatDate(post.publishedAt)}
            </time>
          )}

          <h2 className="mb-2 line-clamp-2 text-sm font-medium text-ink">
            {post.title}
          </h2>

          {post.excerpt && (
            <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-muted">
              {post.excerpt}
            </p>
          )}

          {post.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted-bg px-2.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ink underline underline-offset-4 transition-colors group-hover:text-muted">
            Read More &rarr;
          </span>
        </div>
      </article>
    </Link>
  );
}

export default async function BlogPage() {
  let posts: BlogPost[] = [];

  try {
    const data = await getBlogPosts(1, 12);
    posts = data.posts ?? [];
  } catch {
    // Backend may not be running
  }

  return (
    <main>
      <SlotHero
        pageKey="blog-index"
        slotKey="blog_hero"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Journal"
        fallbackSubheading="Style notes, drops, and stories."
        height="h-[45vh] min-h-[320px]"
        priority
      />
      <div className="mx-auto max-w-[1440px] px-6 pt-20 pb-16 lg:px-12">
        <h1 className="sr-only">Blog</h1>

      {posts.length > 0 ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-lg py-20 text-center">
          <p className="mb-2 text-lg font-medium text-ink">No posts yet</p>
          <p className="text-sm text-muted">
            We&apos;re working on something exciting. Check back soon for style guides,
            behind-the-scenes stories, and denim care tips.
          </p>
        </div>
      )}
      </div>
    </main>
  );
}
