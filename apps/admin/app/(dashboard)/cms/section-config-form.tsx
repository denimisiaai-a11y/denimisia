'use client';

import { useState } from 'react';
import {
  type HomepageSectionType,
  SECTION_TYPE_META,
  HAS_CONFIG_FIELDS,
} from './section-types';

interface SectionConfigFormProps {
  readonly type: HomepageSectionType;
  readonly initial: Record<string, unknown>;
  readonly onSubmit: (config: Record<string, unknown>) => Promise<void>;
  readonly onCancel: () => void;
}

/**
 * Per-type config editor. Each section type that has editable fields gets
 * its own form. Slot-driven sections (HERO, CATEGORY_CARDS, BRAND_STORY)
 * render a "managed elsewhere" notice with a link to the relevant editor.
 */
export function SectionConfigForm({
  type,
  initial,
  onSubmit,
  onCancel,
}: SectionConfigFormProps) {
  const meta = SECTION_TYPE_META[type];
  const editable = HAS_CONFIG_FIELDS.has(type);

  const [title, setTitle] = useState(
    typeof initial.title === 'string' ? initial.title : '',
  );
  const [limit, setLimit] = useState(
    typeof initial.limit === 'number' ? String(initial.limit) : '',
  );
  const [slotGroupKey, setSlotGroupKey] = useState(
    typeof initial.slotGroupKey === 'string' ? initial.slotGroupKey : '',
  );
  const [collectionSlug, setCollectionSlug] = useState(
    typeof initial.collectionSlug === 'string' ? initial.collectionSlug : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const config: Record<string, unknown> = {};
      if (type === 'NEW_ARRIVALS' || type === 'BUNDLE_DEALS' || type === 'TRENDING') {
        if (title.trim()) config.title = title.trim();
        const limitNum = Number(limit);
        if (Number.isFinite(limitNum) && limitNum > 0) config.limit = Math.floor(limitNum);
      } else if (type === 'EDITORIAL_BANNER') {
        if (slotGroupKey.trim()) config.slotGroupKey = slotGroupKey.trim();
      } else if (type === 'BESTSELLERS') {
        if (title.trim()) config.title = title.trim();
        if (collectionSlug.trim()) config.collectionSlug = collectionSlug.trim();
      }
      await onSubmit(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  if (!editable) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-on-surface">{meta.description}</p>
        <p className="text-xs text-secondary">
          This section&apos;s content (images, headings, CTAs) is managed
          {meta.contentEditor ? (
            <>
              {' '}via{' '}
              <a
                href={meta.contentEditor}
                className="underline hover:text-on-surface"
              >
                {meta.contentEditor.replace('/cms/', 'CMS → ')}
              </a>
              .
            </>
          ) : (
            <>{' '}elsewhere in the admin.</>
          )}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-on-surface">{meta.description}</p>

      {(type === 'NEW_ARRIVALS' ||
        type === 'BUNDLE_DEALS' ||
        type === 'TRENDING' ||
        type === 'BESTSELLERS') && (
        <Field label="Section title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={String(meta.defaultConfig.title ?? '')}
            className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
          />
        </Field>
      )}

      {(type === 'NEW_ARRIVALS' ||
        type === 'BUNDLE_DEALS' ||
        type === 'TRENDING') && (
        <Field label="Limit" hint="Max number of items shown.">
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder={String(meta.defaultConfig.limit ?? '')}
            className="w-32 rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
          />
        </Field>
      )}

      {type === 'EDITORIAL_BANNER' && (
        <Field
          label="Slot group key"
          hint='Which slot group the carousel reads from. Defaults to "home.editorial". Use a different key for a second EditorialBanner instance.'
        >
          <input
            type="text"
            value={slotGroupKey}
            onChange={(e) => setSlotGroupKey(e.target.value)}
            placeholder="home.editorial"
            className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
          />
        </Field>
      )}

      {type === 'BESTSELLERS' && (
        <Field
          label="Collection slug (optional)"
          hint="Override the bestseller source collection."
        >
          <input
            type="text"
            value={collectionSlug}
            onChange={(e) => setCollectionSlug(e.target.value)}
            placeholder="bestsellers"
            className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
          />
        </Field>
      )}

      {error && <div className="text-xs text-[#c62828]">{error}</div>}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-inverse-surface text-inverse-on-surface text-[10px] font-bold uppercase tracking-[0.2em] hover:scale-[1.02] disabled:opacity-50 transition-transform"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-secondary">{hint}</span>}
    </label>
  );
}
