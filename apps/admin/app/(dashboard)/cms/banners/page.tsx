'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/api';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  link: string | null;
  position: 'top' | 'middle' | 'bottom';
  active: boolean;
  startDate: string | null;
  endDate: string | null;
}

interface BannerFormData {
  title: string;
  subtitle: string;
  imageUrl: string;
  link: string;
  position: 'top' | 'middle' | 'bottom';
  active: boolean;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: BannerFormData = {
  title: '',
  subtitle: '',
  imageUrl: '',
  link: '',
  position: 'top',
  active: true,
  startDate: '',
  endDate: '',
};

const POSITION_ORDER: Record<Banner['position'], number> = {
  top: 1,
  middle: 2,
  bottom: 3,
};

export default function BannersPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadBanners = useCallback(async () => {
    if (!token) return;
    try {
      const data = await adminFetch<Banner[]>('/cms/banners', token);
      setBanners(Array.isArray(data) ? data : []);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function openEditForm(banner: Banner) {
    setForm({
      title: banner.title,
      subtitle: banner.subtitle ?? '',
      imageUrl: banner.imageUrl,
      link: banner.link ?? '',
      position: banner.position,
      active: banner.active,
      startDate: banner.startDate ? banner.startDate.slice(0, 10) : '',
      endDate: banner.endDate ? banner.endDate.slice(0, 10) : '',
    });
    setEditingId(banner.id);
    setShowForm(true);
    setError(null);
  }

  function updateField<K extends keyof BannerFormData>(key: K, value: BannerFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title,
      subtitle: form.subtitle || null,
      imageUrl: form.imageUrl,
      link: form.link || null,
      position: form.position,
      active: form.active,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };

    try {
      if (editingId) {
        await adminFetch(`/cms/banners/${editingId}`, token, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch('/cms/banners', token, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditingId(null);
      await loadBanners();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await adminFetch(`/cms/banners/${id}`, token, { method: 'DELETE' });
      setDeleteConfirm(null);
      await loadBanners();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete banner');
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
            Homepage Banners
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Curate the cinematic sequence above the fold.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={openCreateForm}
            className="bg-primary text-on-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            New Banner
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-surface-container-lowest p-4 border border-primary/30 text-primary text-xs font-body tracking-wide">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-10 bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]"
        >
          <div className="flex items-center justify-between mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-secondary">
              {editingId ? 'Edit Banner' : 'New Banner'}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-secondary hover:text-on-surface transition-colors"
              aria-label="Close form"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Title *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Subtitle
              </label>
              <input
                type="text"
                value={form.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Image URL *
              </label>
              {form.imageUrl ? (
                <div className="mb-3 bg-surface-container-low border border-outline-variant/15 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl}
                    alt="Banner preview"
                    className="w-full h-48 object-cover"
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
                required
                value={form.imageUrl}
                onChange={(e) => updateField('imageUrl', e.target.value)}
                placeholder="https://..."
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Link URL
              </label>
              <input
                type="url"
                value={form.link}
                onChange={(e) => updateField('link', e.target.value)}
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Position
              </label>
              <select
                value={form.position}
                onChange={(e) =>
                  updateField('position', e.target.value as BannerFormData['position'])
                }
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              >
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                End Date
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => updateField('active', !form.active)}
                aria-pressed={form.active}
                aria-label="Toggle visibility"
                className={`w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${
                  form.active ? 'bg-primary' : 'bg-surface-container-high'
                }`}
              >
                <span
                  className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${
                    form.active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                {form.active ? 'Visible on storefront' : 'Hidden'}
              </span>
            </div>
          </div>

          <div className="mt-10 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-on-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId ? 'Update Banner' : 'Create Banner'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="bg-surface-container-highest text-on-surface px-6 py-2 text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Banner List */}
      <div className="bg-surface-container-lowest shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        <div className="bg-surface-container-low/50 px-6 py-5 grid grid-cols-[auto_1fr_auto] gap-6 items-center">
          <div className="w-[120px] text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Preview
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Banner
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary text-right pr-2">
            Controls
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-xs uppercase tracking-widest text-secondary">
            Loading banners…
          </div>
        ) : banners.length === 0 ? (
          <div className="px-6 py-20 flex flex-col items-center gap-3 text-secondary">
            <span className="material-symbols-outlined text-4xl text-secondary/40">
              photo_library
            </span>
            <p className="text-xs uppercase tracking-[0.2em]">No banners yet</p>
            <p className="text-sm text-secondary/80 font-body">
              Create your first banner to open the sequence.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {banners
              .slice()
              .sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position])
              .map((banner) => (
                <div
                  key={banner.id}
                  className="px-6 py-5 grid grid-cols-[auto_1fr_auto] gap-6 items-center hover:bg-surface-container-low/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-[120px] h-20 bg-surface-container-high overflow-hidden flex items-center justify-center">
                    {banner.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={banner.imageUrl}
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-secondary/40 text-2xl">
                        image
                      </span>
                    )}
                  </div>

                  {/* Title + subtitle */}
                  <div>
                    <h4 className="font-headline text-base font-semibold uppercase tracking-wide text-on-surface">
                      {banner.title}
                    </h4>
                    {banner.subtitle && (
                      <p className="text-xs text-secondary italic mt-1">{banner.subtitle}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {banner.position}
                      </span>
                      {(banner.startDate || banner.endDate) && (
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">event</span>
                          {banner.startDate
                            ? new Date(banner.startDate).toLocaleDateString()
                            : '—'}
                          {' / '}
                          {banner.endDate
                            ? new Date(banner.endDate).toLocaleDateString()
                            : '—'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-secondary">
                        {banner.active ? 'Visible' : 'Hidden'}
                      </span>
                      <div
                        aria-hidden
                        className={`w-10 h-5 rounded-full relative flex items-center px-1 ${
                          banner.active ? 'bg-primary' : 'bg-surface-container-high'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${
                            banner.active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditForm(banner)}
                      className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-on-surface hover:text-primary transition-colors"
                    >
                      Edit
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>

                    {deleteConfirm === banner.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(banner.id)}
                          className="text-[10px] font-bold tracking-widest uppercase text-primary hover:opacity-80"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          className="text-[10px] font-bold tracking-widest uppercase text-secondary hover:text-on-surface"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(banner.id)}
                        className="text-[10px] font-bold tracking-widest uppercase text-secondary hover:text-primary transition-colors"
                        aria-label="Delete banner"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
