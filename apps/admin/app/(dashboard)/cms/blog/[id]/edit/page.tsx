'use client';

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/api';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface BlogFormData {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  tags: string;
  published: boolean;
}

interface BlogPostRecord {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  tags: string[] | string | null;
  published: boolean;
  status: 'PUBLISHED' | 'DRAFT';
}

const EMPTY_FORM: BlogFormData = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  coverImageUrl: '',
  tags: '',
  published: false,
};

function toTagsString(tags: BlogPostRecord['tags']): string {
  if (Array.isArray(tags)) return tags.join(', ');
  if (typeof tags === 'string') return tags;
  return '';
}

export default function EditBlogPostPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [form, setForm] = useState<BlogFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const post = await adminFetch<BlogPostRecord>(`/cms/blog/${id}`, token);
      setForm({
        title: post.title ?? '',
        slug: post.slug ?? '',
        excerpt: post.excerpt ?? '',
        body: post.body ?? '',
        coverImageUrl: post.coverImageUrl ?? '',
        tags: toTagsString(post.tags),
        published: Boolean(post.published) || post.status === 'PUBLISHED',
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load entry');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  function updateField<K extends keyof BlogFormData>(key: K, value: BlogFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSlugChange(value: string) {
    setForm((prev) => ({ ...prev, slug: generateSlug(value) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id) return;
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt || null,
      body: form.body,
      coverImageUrl: form.coverImageUrl || null,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      published: form.published,
    };

    try {
      await adminFetch(`/cms/blog/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      router.push('/cms/blog');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12">
        <div className="py-20 text-center text-xs uppercase tracking-widest text-secondary">
          Loading entry…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary mb-2">
            Content Management
          </p>
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Edit Journal Entry
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Refine the thread.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/cms/blog')}
            className="bg-surface-container-highest text-on-surface px-6 py-2 text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Journal
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-surface-container-lowest p-4 border border-primary/30 text-primary text-xs font-body tracking-wide">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary mb-6">
            The Story
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Title *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Enter post title"
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-lg font-headline tracking-wide text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Slug
              </label>
              <div className="flex items-center gap-2 border-b border-outline-variant/25 focus-within:border-primary">
                <span className="text-xs uppercase tracking-[0.2em] text-secondary">/blog/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="slug"
                  className="flex-1 border-0 bg-transparent py-2 text-sm text-on-surface focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Excerpt
              </label>
              <textarea
                value={form.excerpt}
                onChange={(e) => updateField('excerpt', e.target.value)}
                rows={2}
                placeholder="A single sentence that sets the tone."
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0 resize-y italic"
              />
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary mb-6">
            The Manuscript
          </p>

          <div className="bg-surface-container-lowest border border-outline-variant/15 p-6">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-3">
              Body *
            </label>
            <textarea
              required
              value={form.body}
              onChange={(e) => updateField('body', e.target.value)}
              rows={18}
              placeholder="Write your post content here..."
              className="w-full border-0 bg-transparent text-sm text-on-surface font-body leading-relaxed focus:outline-none focus:ring-0 resize-y"
            />
          </div>
        </section>

        <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary mb-6">
            Presentation
          </p>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Cover Image
              </label>
              {form.coverImageUrl ? (
                <div className="mb-3 bg-surface-container-low border border-outline-variant/15 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-40 object-cover"
                  />
                </div>
              ) : (
                <div className="mb-3 border border-dashed border-outline-variant/30 bg-surface-container-low flex flex-col items-center justify-center py-10 gap-2">
                  <span className="material-symbols-outlined text-secondary/60 text-3xl">
                    cloud_upload
                  </span>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
                    Drop image · paste URL below
                  </p>
                </div>
              )}
              <input
                type="url"
                value={form.coverImageUrl}
                onChange={(e) => updateField('coverImageUrl', e.target.value)}
                placeholder="https://..."
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Tags
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => updateField('tags', e.target.value)}
                placeholder="fashion, denim, style"
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
              <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-secondary/70">
                Comma-separated
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateField('published', !form.published)}
              aria-pressed={form.published}
              aria-label="Toggle publish state"
              className={`w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${
                form.published ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${
                  form.published ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              {form.published ? 'Published' : 'Draft'}
            </span>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-on-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/cms/blog')}
            className="bg-surface-container-highest text-on-surface px-6 py-2 text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
