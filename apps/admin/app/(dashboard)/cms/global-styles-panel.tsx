'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/api';
import type { GlobalStorefrontStyles } from './section-types';

interface GlobalStylesPanelProps {
  readonly styles: GlobalStorefrontStyles;
  readonly token: string | undefined;
  readonly onUpdated: (next: GlobalStorefrontStyles) => void;
}

const LABELS = ['Tight', 'Default', 'Airy'] as const;
const TYPE_LABELS = ['Tight', 'Default', 'Loose'] as const;

export function GlobalStylesPanel({ styles, token, onUpdated }: GlobalStylesPanelProps) {
  const [saving, setSaving] = useState(false);

  const save = async (patch: Partial<GlobalStorefrontStyles>) => {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await adminFetch<GlobalStorefrontStyles>(
        '/cms/homepage/styles',
        token,
        { method: 'PATCH', body: JSON.stringify(patch) },
      );
      onUpdated(updated);
    } catch {
      // Surfacing here would be intrusive — main page handles error banner.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-container-low p-8 border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-6">
        <span className="material-symbols-outlined text-primary">auto_awesome</span>
        <h5 className="font-headline text-sm font-bold tracking-widest uppercase">
          Global Styles
        </h5>
      </div>
      <div className="space-y-5">
        <StepperRow
          label="Negative Space"
          value={styles.negativeSpace}
          labels={LABELS}
          disabled={saving}
          onChange={(v) => save({ negativeSpace: v })}
        />
        <StepperRow
          label="Typography Flow"
          value={styles.typographyFlow}
          labels={TYPE_LABELS}
          disabled={saving}
          onChange={(v) => save({ typographyFlow: v })}
        />
      </div>
    </div>
  );
}

interface StepperRowProps {
  readonly label: string;
  readonly value: number;
  readonly labels: readonly [string, string, string];
  readonly disabled: boolean;
  readonly onChange: (next: number) => void;
}

function StepperRow({ label, value, labels, disabled, onChange }: StepperRowProps) {
  const clamp = (n: number) => Math.max(0, Math.min(2, n));
  const current = clamp(value);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-secondary">{label}</span>
        <span className="text-[10px] font-bold uppercase px-2 py-1 bg-surface-container-high">
          {labels[current]}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || current === 0}
          onClick={() => onChange(clamp(current - 1))}
          className="flex h-7 w-7 items-center justify-center border border-outline-variant/40 text-on-surface hover:bg-surface-container disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            remove
          </span>
        </button>
        <div className="flex flex-1 items-center gap-1">
          {[0, 1, 2].map((step) => (
            <div
              key={step}
              className={`h-1 flex-1 transition-colors ${
                step <= current ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={disabled || current === 2}
          onClick={() => onChange(clamp(current + 1))}
          className="flex h-7 w-7 items-center justify-center border border-outline-variant/40 text-on-surface hover:bg-surface-container disabled:opacity-30"
          aria-label={`Increase ${label}`}
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            add
          </span>
        </button>
      </div>
    </div>
  );
}
