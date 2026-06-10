'use client';

import {
  TYPE_ATTRIBUTES,
  UNIVERSAL_ATTRIBUTES,
  type ProductType,
} from '@/lib/product-taxonomy';

export interface TagPair {
  dimension: string;
  value: string;
}

interface AttributeSpec {
  required: boolean;
  multi: boolean;
  options: readonly string[];
}

interface Props {
  type: ProductType | null;
  selected: TagPair[];
  onChange: (next: TagPair[]) => void;
}

/**
 * Renders the dimension chip-pickers for the universal attributes (season,
 * occasion, material, pattern) plus the type-specific dimensions (e.g.
 * silhouette, rise, sleeve). Selection is stored canonically as lowercase
 * (`dimension`, `value`) pairs so the API can match them against synonyms.
 */
export function TypeAttributeFields({ type, selected, onChange }: Props) {
  if (!type) {
    return (
      <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
        Select a type to configure attributes.
      </p>
    );
  }

  const allDims: Record<string, AttributeSpec> = {
    ...(UNIVERSAL_ATTRIBUTES as unknown as Record<string, AttributeSpec>),
    ...TYPE_ATTRIBUTES[type],
  };

  const isSelected = (dimension: string, value: string) =>
    selected.some((s) => s.dimension === dimension && s.value === value);

  const toggle = (dimension: string, value: string, multi: boolean) => {
    if (multi) {
      const has = isSelected(dimension, value);
      const next = has
        ? selected.filter(
            (s) => !(s.dimension === dimension && s.value === value),
          )
        : [...selected, { dimension, value }];
      onChange(next);
      return;
    }
    const cleared = selected.filter((s) => s.dimension !== dimension);
    onChange([...cleared, { dimension, value }]);
  };

  return (
    <div className="space-y-6">
      {Object.entries(allDims).map(([dimension, spec]) => (
        <div key={dimension}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            {dimension}
            {spec.required ? <span className="text-primary"> *</span> : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {spec.options.map((opt) => {
              const value = opt.toLowerCase();
              const active = isSelected(dimension, value);
              return (
                <button
                  type="button"
                  key={opt}
                  onClick={() => toggle(dimension, value, spec.multi)}
                  className={
                    active
                      ? 'rounded-full border border-primary bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-on-primary'
                      : 'rounded-full border border-outline-variant/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-secondary hover:border-on-surface hover:text-on-surface transition-colors duration-200'
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
