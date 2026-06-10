'use client';

import { useState } from 'react';
import {
  type HomepageSectionType,
  SECTION_TYPE_META,
} from './section-types';

interface InsertSectionModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onPick: (type: HomepageSectionType) => Promise<void>;
}

const TYPES: HomepageSectionType[] = [
  'HERO',
  'CATEGORY_CARDS',
  'NEW_ARRIVALS',
  'EDITORIAL_BANNER',
  'BUNDLE_DEALS',
  'TRENDING',
  'BESTSELLERS',
  'BRAND_STORY',
];

export function InsertSectionModal({
  open,
  onClose,
  onPick,
}: InsertSectionModalProps) {
  const [creating, setCreating] = useState<HomepageSectionType | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const pick = async (type: HomepageSectionType) => {
    setCreating(type);
    setError('');
    try {
      await onPick(type);
      setCreating(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Insert failed');
      setCreating(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
      onClick={onClose}
    >
      <div
        className="atelier-shadow w-full max-w-3xl bg-surface-container-lowest"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
            Insert section
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-secondary hover:text-on-surface"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 p-6">
          {TYPES.map((type) => {
            const meta = SECTION_TYPE_META[type];
            const busy = creating === type;
            const disabled = creating !== null;
            return (
              <button
                key={type}
                type="button"
                onClick={() => pick(type)}
                disabled={disabled}
                className="flex items-start gap-3 rounded border border-outline-variant/30 bg-surface-container-low p-4 text-left transition-colors hover:border-on-surface hover:bg-surface-container disabled:opacity-50"
              >
                <span
                  className="material-symbols-outlined text-on-surface"
                  aria-hidden
                >
                  {meta.icon}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold uppercase tracking-[0.15em] text-on-surface">
                    {meta.label}
                  </div>
                  <div className="mt-1 text-xs text-secondary">
                    {meta.description}
                  </div>
                </div>
                {busy && (
                  <span className="text-[10px] uppercase tracking-[0.2em] text-secondary">
                    Adding…
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="border-t border-outline-variant/15 px-6 py-3 text-xs text-[#c62828]">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
