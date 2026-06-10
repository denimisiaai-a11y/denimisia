'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Field, Checkbox } from '@/components/form';
import { Banner, PrimaryButton } from '@/components/admin-ui';
import type { CollectionDetail } from '../editor-shell';

interface Props {
  readonly collection: CollectionDetail;
  readonly onSaved: (c: CollectionDetail) => void;
}

type HeroLayout = 'FULL_BLEED' | 'SPLIT' | 'VIDEO' | 'MINIMAL';
type SortMode = 'MANUAL' | 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'BESTSELLING';

const HERO_DESC: Record<HeroLayout, string> = {
  FULL_BLEED: 'Full-width image, title overlaid centered. Best for premium drops.',
  SPLIT: '50/50 image and text side-by-side. Better for editorial copy.',
  VIDEO: 'Full-width muted autoplay video loop. High-impact.',
  MINIMAL: 'No image — typography on solid background. Editorial.',
};

export function LayoutTab({ collection, onSaved }: Props) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const initialFilters = (collection.filterConfig as Record<string, boolean> | null) ?? {
    size: true,
    color: true,
    price: true,
    fit: true,
  };

  const [form, setForm] = useState({
    heroLayout: collection.heroLayout,
    gridColumnsDesktop: collection.gridColumnsDesktop,
    gridColumnsMobile: collection.gridColumnsMobile,
    defaultSort: collection.defaultSort,
    showFilters: collection.showFilters,
    filterConfig: initialFilters,
    showCountdown: collection.showCountdown,
    showSocialProof: collection.showSocialProof,
    showRelated: collection.showRelated,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminFetch<CollectionDetail>(
        `/collections/${collection.id}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(form),
        },
      );
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const hasEndDate = Boolean(collection.endDate);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl">Layout</h2>
        <p className="mt-1 text-sm text-secondary">
          How the collection page is composed: hero style, product grid, sort, filters, extras.
        </p>
      </div>

      {error && <Banner tone="error" message={error} />}

      <Field label="Hero layout" name="heroLayout" hint={HERO_DESC[form.heroLayout]}>
        <div className="grid grid-cols-2 gap-3">
          {(['FULL_BLEED', 'SPLIT', 'VIDEO', 'MINIMAL'] as HeroLayout[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm({ ...form, heroLayout: opt })}
              className={`border p-4 text-left transition-colors ${
                form.heroLayout === opt
                  ? 'border-on-surface bg-surface-container-low'
                  : 'border-outline-variant/30 hover:border-outline-variant/60'
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
                {opt.replace('_', ' ')}
              </p>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Grid columns (desktop)" name="gridColumnsDesktop">
          <select
            id="gridColumnsDesktop"
            value={form.gridColumnsDesktop}
            onChange={(e) => setForm({ ...form, gridColumnsDesktop: Number(e.target.value) })}
            className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
          >
            <option value={2}>2 columns — large product cards</option>
            <option value={3}>3 columns — balanced (default)</option>
            <option value={4}>4 columns — denser, shopping feel</option>
          </select>
        </Field>
        <Field label="Grid columns (mobile)" name="gridColumnsMobile">
          <select
            id="gridColumnsMobile"
            value={form.gridColumnsMobile}
            onChange={(e) => setForm({ ...form, gridColumnsMobile: Number(e.target.value) })}
            className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
          >
            <option value={1}>1 column — full-width cards</option>
            <option value={2}>2 columns — split (default)</option>
          </select>
        </Field>
      </div>

      <Field label="Default sort order" name="defaultSort">
        <select
          id="defaultSort"
          value={form.defaultSort}
          onChange={(e) => setForm({ ...form, defaultSort: e.target.value as SortMode })}
          className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
        >
          <option value="MANUAL">Manual — admin-defined order</option>
          <option value="NEWEST">Newest first</option>
          <option value="PRICE_ASC">Price: low to high</option>
          <option value="PRICE_DESC">Price: high to low</option>
          <option value="BESTSELLING">Bestselling first</option>
        </select>
      </Field>

      <div className="border-t border-outline-variant/10 pt-6 space-y-4">
        <h3 className="font-display text-base">Filters</h3>
        <Checkbox
          label="Show filter bar on collection page"
          checked={form.showFilters}
          onChange={(e) => setForm({ ...form, showFilters: e.target.checked })}
        />
        {form.showFilters && (
          <div className="ml-6 grid grid-cols-2 gap-2">
            {(['size', 'color', 'price', 'fit'] as const).map((f) => (
              <Checkbox
                key={f}
                label={f.charAt(0).toUpperCase() + f.slice(1)}
                checked={form.filterConfig[f] ?? true}
                onChange={(e) =>
                  setForm({
                    ...form,
                    filterConfig: { ...form.filterConfig, [f]: e.target.checked },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-outline-variant/10 pt-6 space-y-4">
        <h3 className="font-display text-base">Extras</h3>

        <Checkbox
          label={
            hasEndDate
              ? 'Show countdown timer (uses End Date)'
              : 'Show countdown timer — set End Date in Schedule tab first'
          }
          checked={form.showCountdown}
          onChange={(e) => setForm({ ...form, showCountdown: e.target.checked })}
        />

        <Checkbox
          label={'Show social proof ("X customers shopped this")'}
          checked={form.showSocialProof}
          onChange={(e) => setForm({ ...form, showSocialProof: e.target.checked })}
        />

        <Checkbox
          label="Show related collections at bottom"
          checked={form.showRelated}
          onChange={(e) => setForm({ ...form, showRelated: e.target.checked })}
        />
      </div>

      <div className="border-t border-outline-variant/10 pt-6">
        <PrimaryButton icon="check" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Layout'}
        </PrimaryButton>
      </div>
    </div>
  );
}
