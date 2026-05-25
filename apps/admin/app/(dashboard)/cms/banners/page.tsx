'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/api';
import { ImageUploader } from '@/components/image-uploader';

type PopupSize = 'compact' | 'medium' | 'large' | 'fullscreen';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image: string;
  link: string | null;
  position: 'popup' | 'top' | 'middle' | 'bottom';
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  popupSize: PopupSize;
  popupSizeMobile: PopupSize;
  textOverlay: boolean;
  popupWidthPct: number;
  popupHeightPct: number;
  popupWidthPctMobile: number;
  popupHeightPctMobile: number;
  imageFit: 'cover' | 'contain';
}

interface BannerFormData {
  title: string;
  subtitle: string;
  image: string;
  link: string;
  position: 'popup' | 'top' | 'middle' | 'bottom';
  isActive: boolean;
  startDate: string;
  endDate: string;
  popupSize: PopupSize;
  popupSizeMobile: PopupSize;
  textOverlay: boolean;
  popupWidthPct: number;
  popupHeightPct: number;
  popupWidthPctMobile: number;
  popupHeightPctMobile: number;
  imageFit: 'cover' | 'contain';
}

const EMPTY_FORM: BannerFormData = {
  title: '',
  subtitle: '',
  image: '',
  link: '',
  position: 'middle',
  isActive: true,
  startDate: '',
  endDate: '',
  popupSize: 'large',
  popupSizeMobile: 'medium',
  textOverlay: false,
  popupWidthPct: 95,
  popupHeightPct: 0,
  popupWidthPctMobile: 95,
  popupHeightPctMobile: 0,
  imageFit: 'cover',
};

const POSITION_ORDER: Record<Banner['position'], number> = {
  popup:  0,
  top:    1,
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
      image: banner.image,
      link: banner.link ?? '',
      position: banner.position,
      isActive: banner.isActive,
      startDate: banner.startDate ? banner.startDate.slice(0, 10) : '',
      endDate: banner.endDate ? banner.endDate.slice(0, 10) : '',
      popupSize: banner.popupSize ?? 'large',
      popupSizeMobile: banner.popupSizeMobile ?? 'medium',
      textOverlay: Boolean(banner.textOverlay),
      popupWidthPct:        banner.popupWidthPct        ?? 95,
      popupHeightPct:       banner.popupHeightPct       ?? 0,
      popupWidthPctMobile:  banner.popupWidthPctMobile  ?? 95,
      popupHeightPctMobile: banner.popupHeightPctMobile ?? 0,
      imageFit:             banner.imageFit             ?? 'cover',
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
      image: form.image,
      link: form.link || null,
      position: form.position,
      isActive: form.isActive,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      popupSize: form.popupSize,
      popupSizeMobile: form.popupSizeMobile,
      textOverlay: form.textOverlay,
      popupWidthPct:        form.popupWidthPct,
      popupHeightPct:       form.popupHeightPct,
      popupWidthPctMobile:  form.popupWidthPctMobile,
      popupHeightPctMobile: form.popupHeightPctMobile,
      imageFit:             form.imageFit,
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
                Image *
              </label>
              <ImageUploader
                key={editingId ?? 'new-banner'}
                value={form.image ? [form.image] : []}
                onChange={(urls) => updateField('image', urls[0] ?? '')}
                token={token}
                folder="banners"
                maxFiles={1}
              />
              <p className="mt-2 text-[10px] tracking-wide text-secondary">
                Recommended 2560×1440 (16:9). Drag-and-drop or click to upload.
              </p>
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
                <option value="popup">Popup (modal, 10s delay)</option>
                <option value="middle">Middle (between sections)</option>
                <option value="bottom">Bottom (before footer)</option>
              </select>
            </div>
            <>
                <div className="col-span-2 rounded border border-outline-variant/30 bg-surface-container-low p-4">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    Dimensions — Desktop
                  </p>
                  <SliderRow
                    label="Width"
                    value={form.popupWidthPct}
                    onChange={(v) => updateField('popupWidthPct', v)}
                    min={20}
                    max={100}
                    unit="vw"
                  />
                  <SliderRow
                    label="Height"
                    value={form.popupHeightPct}
                    onChange={(v) => updateField('popupHeightPct', v)}
                    min={0}
                    max={100}
                    unit="vh"
                    autoLabel="Auto (content-driven, max 92vh)"
                  />
                </div>
                <div className="col-span-2 rounded border border-outline-variant/30 bg-surface-container-low p-4">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                    Dimensions — Mobile
                  </p>
                  <SliderRow
                    label="Width"
                    value={form.popupWidthPctMobile}
                    onChange={(v) => updateField('popupWidthPctMobile', v)}
                    min={20}
                    max={100}
                    unit="vw"
                  />
                  <SliderRow
                    label="Height"
                    value={form.popupHeightPctMobile}
                    onChange={(v) => updateField('popupHeightPctMobile', v)}
                    min={0}
                    max={100}
                    unit="vh"
                    autoLabel="Auto (content-driven, max 92vh)"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between gap-4 rounded border border-outline-variant/30 bg-surface-container-low px-4 py-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface">
                      Image fit
                    </p>
                    <p className="mt-1 text-[10px] text-secondary">
                      {form.imageFit === 'cover'
                        ? 'Cover — fills the area, may crop edges so no letterbox.'
                        : 'Contain — shows the full image, may leave letterbox bars.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 overflow-hidden rounded border border-outline-variant/30">
                    {(['cover', 'contain'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateField('imageFit', mode)}
                        aria-pressed={form.imageFit === mode}
                        className={
                          'px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ' +
                          (form.imageFit === mode
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-secondary hover:text-on-surface')
                        }
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                {form.position !== 'top' && (
                  <div className="col-span-2 flex items-center justify-between gap-4 rounded border border-outline-variant/30 bg-surface-container-low px-4 py-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface">
                        Text overlay
                      </p>
                      <p className="mt-1 text-[10px] text-secondary">
                        {form.textOverlay
                          ? 'Headline + CTA render on top of the image (gradient backdrop).'
                          : 'Headline + CTA render in a white side panel next to the image.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('textOverlay', !form.textOverlay)}
                      aria-pressed={form.textOverlay}
                      className={
                        'relative h-6 w-11 shrink-0 rounded-full transition-colors ' +
                        (form.textOverlay ? 'bg-primary' : 'bg-surface-container-high')
                      }
                    >
                      <span
                        className={
                          'absolute top-1 h-4 w-4 rounded-full bg-paper transition-transform ' +
                          (form.textOverlay ? 'translate-x-6' : 'translate-x-1')
                        }
                      />
                    </button>
                  </div>
                )}
              </>
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
                onClick={() => updateField('isActive', !form.isActive)}
                aria-pressed={form.isActive}
                aria-label="Toggle visibility"
                className={`w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${
                  form.isActive ? 'bg-primary' : 'bg-surface-container-high'
                }`}
              >
                <span
                  className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${
                    form.isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                {form.isActive ? 'Visible on storefront' : 'Hidden'}
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
                    {banner.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={banner.image}
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
                        {banner.isActive ? 'Visible' : 'Hidden'}
                      </span>
                      <div
                        aria-hidden
                        className={`w-10 h-5 rounded-full relative flex items-center px-1 ${
                          banner.isActive ? 'bg-primary' : 'bg-surface-container-high'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${
                            banner.isActive ? 'translate-x-5' : 'translate-x-0'
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

interface SliderRowProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (next: number) => void;
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  /** Shown when value === 0 (treated as "auto"). */
  readonly autoLabel?: string;
}

function SliderRow({ label, value, onChange, min, max, unit, autoLabel }: SliderRowProps) {
  const isAuto = autoLabel !== undefined && value === 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-on-surface">
          {label}
        </span>
        <span className="font-mono text-[11px] text-secondary">
          {isAuto ? 'auto' : `${value}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block w-full accent-primary"
      />
      {isAuto && autoLabel && (
        <p className="mt-1 text-[10px] text-secondary">{autoLabel}</p>
      )}
    </div>
  );
}
