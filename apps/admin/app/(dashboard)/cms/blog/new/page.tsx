'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminFetch } from '@/lib/api';
import { ImageUploader } from '@/components/image-uploader';

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

const EMPTY_FORM: BlogFormData = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  coverImageUrl: '',
  tags: '',
  published: false,
};

export default function NewBlogPostPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const router = useRouter();

  const [form, setForm] = useState<BlogFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);

  function updateField<K extends keyof BlogFormData>(key: K, value: BlogFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-generate slug from title unless user has manually edited slug
      if (key === 'title' && !slugEdited) {
        next.slug = generateSlug(value as string);
      }
      return next;
    });
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setForm((prev) => ({ ...prev, slug: generateSlug(value) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
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
      await adminFetch('/cms/blog', token, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      router.push('/cms/blog');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create blog post');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-12">
      {/* Hero Title */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary mb-2">
            Content Management
          </p>
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            New Journal Entry
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            A single thread, woven with intent.
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

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-surface-container-lowest p-4 border border-primary/30 text-primary text-xs font-body tracking-wide">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section: Story */}
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
                  placeholder="auto-generated-from-title"
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

        {/* Section: Body */}
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

        {/* Section: Presentation */}
        <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary mb-6">
            Presentation
          </p>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Cover Image
              </label>
              <ImageUploader
                value={form.coverImageUrl ? [form.coverImageUrl] : []}
                onChange={(urls) =>
                  updateField('coverImageUrl', urls[0] ?? '')
                }
                token={token}
                folder="cms"
                maxFiles={1}
              />
              <p className="mt-2 text-[10px] tracking-wide text-secondary">
                Recommended at least 1600×900 (16:9). Used as the post header
                and in the blog index card.
              </p>
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
              {form.published ? 'Publish immediately' : 'Save as draft'}
            </span>
          </div>
        </section>

        {/* Submit Bar */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-on-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Post'}
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
