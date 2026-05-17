'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/api';
import { ConfirmModal } from '@/components/modal';
import { IconButton } from '@/components/admin-ui';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  author: string | null;
  status: 'PUBLISHED' | 'DRAFT';
  published: boolean;
  createdAt: string;
  updatedAt: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
}

export default function BlogListPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!token) return;
    try {
      const data = await adminFetch<BlogPost[]>('/cms/blog', token);
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleDeleteConfirmed() {
    if (!deleteTarget || !token || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await adminFetch(`/cms/blog/${deleteTarget.id}`, token, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadPosts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setDeleting(false);
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
            Editorial Journal
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            The written voice of the atelier.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/cms/blog/new"
            className="bg-primary text-on-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">edit_note</span>
            New Entry
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-primary/30 bg-primary/5 text-primary text-xs font-body">
          {error}
        </div>
      )}

      {/* Journal List */}
      <div className="bg-surface-container-lowest shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        <div className="bg-surface-container-low/50 px-6 py-5 grid grid-cols-[auto_1fr_auto_auto] gap-6 items-center">
          <div className="w-20 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Cover
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Entry
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary w-28">
            Author
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary text-right w-32">
            Status
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-xs uppercase tracking-widest text-secondary">
            Loading entries…
          </div>
        ) : posts.length === 0 ? (
          <div className="px-6 py-20 flex flex-col items-center gap-3 text-secondary">
            <span className="material-symbols-outlined text-4xl text-secondary/40">
              menu_book
            </span>
            <p className="text-xs uppercase tracking-[0.2em]">The journal is empty</p>
            <Link
              href="/cms/blog/new"
              className="mt-2 text-[11px] font-bold uppercase tracking-widest text-primary hover:opacity-80"
            >
              Write the first entry →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {posts.map((post) => {
              const isPublished = post.published || post.status === 'PUBLISHED';
              return (
                <div
                  key={post.id}
                  className="px-6 py-5 grid grid-cols-[auto_1fr_auto_auto] gap-6 items-center hover:bg-surface-container-low/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-surface-container-high overflow-hidden flex items-center justify-center">
                    {post.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.coverImageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-secondary/40 text-2xl">
                        article
                      </span>
                    )}
                  </div>

                  {/* Title + excerpt + slug */}
                  <div>
                    <h4 className="font-headline text-base font-semibold uppercase tracking-wide text-on-surface">
                      {post.title}
                    </h4>
                    {post.excerpt && (
                      <p className="text-xs text-secondary italic mt-1 line-clamp-1">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">link</span>
                        /{post.slug}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Author */}
                  <div className="w-28 text-xs text-secondary font-body">
                    {post.author ?? 'Unknown'}
                  </div>

                  {/* Status + Edit + Delete */}
                  <div className="flex items-center gap-3 w-40 justify-end">
                    <span
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                        isPublished
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-container-high text-secondary'
                      }`}
                    >
                      {isPublished ? 'Published' : 'Draft'}
                    </span>
                    <Link
                      href={`/cms/blog/${post.id}/edit`}
                      aria-label={`Edit ${post.title}`}
                      className="text-secondary hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </Link>
                    <IconButton
                      icon="delete"
                      label={`Delete ${post.title}`}
                      tone="danger"
                      onClick={() => setDeleteTarget(post)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        title="Delete Journal Entry"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.title}"? This cannot be undone.`
            : 'Delete this entry?'
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />
    </div>
  );
}
