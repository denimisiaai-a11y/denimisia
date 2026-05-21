'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SilhouetteCanvas,
  type FitLandmarks,
  type GarmentOffsets,
  type PantsFit,
  type ShirtFit,
  type JacketFit,
  type SilhouetteData,
} from '@repo/fit-engine';
import { SIZE_CHART_DIMENSIONS, type ProductType } from '@/lib/product-taxonomy';

export interface ChartRow {
  sizeKey: string;
  dimension: string;
  bodyValueIn: number;
  garmentValueIn: number;
}

interface SizeAndFitEditorProps {
  type: ProductType | null;
  variantSizes: string[];
  chartValue: ChartRow[];
  onChartChange: (next: ChartRow[]) => void;
  fitLandmarks: FitLandmarks | null;
  onFitChange: (next: FitLandmarks | null) => void;
}

function emptyFitForType(type: ProductType): FitLandmarks {
  if (type === 'PANTS') {
    return {
      kind: 'PANTS',
      rise: 'mid',
      hem: 'ankle',
      legShape: 'straight',
      silhouetteGender: 'FEMALE',
    };
  }
  if (type === 'SHIRTS') {
    return {
      kind: 'SHIRTS',
      hem: 'hip',
      sleeve: 'short',
      neckline: 'crew',
      bodyFit: 'regular',
      silhouetteGender: 'FEMALE',
    };
  }
  return {
    kind: 'JACKETS',
    hem: 'hip',
    sleeve: 'long',
    closure: 'zip',
    bodyFit: 'regular',
    silhouetteGender: 'FEMALE',
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function SizeAndFitEditor({
  type,
  variantSizes,
  chartValue,
  onChartChange,
  fitLandmarks,
  onFitChange,
}: SizeAndFitEditorProps) {
  const [silhouettes, setSilhouettes] = useState<SilhouetteData[] | null>(null);
  const [editingOverlay, setEditingOverlay] = useState(false);
  const [unit, setUnit] = useState<'in' | 'cm'>('in');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/silhouettes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SilhouetteData[]) => {
        if (!cancelled) setSilhouettes(data);
      })
      .catch(() => {
        if (!cancelled) setSilhouettes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveFit: FitLandmarks | null = useMemo(() => {
    if (fitLandmarks) return fitLandmarks;
    if (!type) return null;
    return emptyFitForType(type);
  }, [fitLandmarks, type]);

  const silhouetteGender =
    effectiveFit?.silhouetteGender === 'MALE' ? 'MALE' : 'FEMALE';
  const silhouette = silhouettes?.find((s) => s.gender === silhouetteGender);

  if (!type) {
    return (
      <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
        Select a type first.
      </p>
    );
  }

  return (
    <section className="space-y-6">
      <header className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
        Size &amp; Fit
      </header>

      <div className="grid grid-cols-[340px_1fr] gap-6 rounded border border-outline-variant/20 p-4">
        <div className="flex flex-col items-center gap-3 bg-surface-container-low/30 p-3 rounded">
          <span className="text-[10px] uppercase tracking-widest text-secondary">
            Live preview
          </span>
          {silhouette ? (
            <SilhouetteCanvas
              silhouette={silhouette}
              fit={effectiveFit}
              editable={editingOverlay}
              onOffsetsChange={(offsets: GarmentOffsets) => {
                if (!effectiveFit) return;
                onFitChange({ ...effectiveFit, offsets });
              }}
            />
          ) : (
            <p className="text-xs text-secondary">Loading silhouettes…</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="fit-edit-overlay"
              className="px-3 py-1.5 bg-on-surface text-surface text-[10px] tracking-widest rounded"
              onClick={() => setEditingOverlay((e) => !e)}
            >
              {editingOverlay ? 'Done editing' : 'Edit overlay'}
            </button>
            <button
              type="button"
              data-testid="fit-reset"
              className="px-3 py-1.5 border border-outline-variant text-[10px] tracking-widest rounded"
              onClick={() => {
                if (!effectiveFit) return;
                onFitChange({ ...effectiveFit, offsets: undefined });
              }}
            >
              Reset tweaks
            </button>
          </div>
        </div>

        <PresetsBlock
          type={type}
          fit={effectiveFit}
          onChange={onFitChange}
        />
      </div>

      <div className="rounded border border-outline-variant/20 p-4">
        <SizeChartBlock
          type={type}
          variantSizes={variantSizes}
          value={chartValue}
          unit={unit}
          onUnitToggle={() => setUnit(unit === 'in' ? 'cm' : 'in')}
          onChange={onChartChange}
        />
      </div>
    </section>
  );
}

// ---------- PresetsBlock ----------

interface PresetsBlockProps {
  type: ProductType;
  fit: FitLandmarks | null;
  onChange: (next: FitLandmarks) => void;
}

function PresetsBlock({ type, fit, onChange }: PresetsBlockProps) {
  if (!fit) return null;

  return (
    <div data-testid="fit-presets-block" className="space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-secondary">
        Fit presets
      </p>

      {type === 'PANTS' && fit.kind === 'PANTS' && (
        <PantsPresets fit={fit} onChange={onChange} />
      )}
      {type === 'SHIRTS' && fit.kind === 'SHIRTS' && (
        <ShirtPresets fit={fit} onChange={onChange} />
      )}
      {type === 'JACKETS' && fit.kind === 'JACKETS' && (
        <JacketPresets fit={fit} onChange={onChange} />
      )}

      <p className="mt-2 text-[10px] text-secondary bg-warning-container/30 border-l-2 border-warning p-2">
        Categorical picks are the source of truth. Drag tweaks (red handles in
        preview) are visual polish on top.
      </p>
    </div>
  );
}

function PantsPresets({
  fit,
  onChange,
}: {
  fit: PantsFit;
  onChange: (next: FitLandmarks) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <Select
        label="Rise"
        testId="fit-rise"
        value={fit.rise}
        options={[
          { value: 'high', label: 'High' },
          { value: 'mid', label: 'Mid' },
          { value: 'low', label: 'Low' },
        ]}
        onChange={(v) => onChange({ ...fit, rise: v as PantsFit['rise'] })}
      />
      <Select
        label="Hem"
        testId="fit-hem"
        value={fit.hem}
        options={[
          { value: 'above-knee', label: 'Above knee' },
          { value: 'mid-calf', label: 'Mid-calf' },
          { value: 'ankle', label: 'Ankle' },
          { value: 'floor', label: 'Floor' },
        ]}
        onChange={(v) => onChange({ ...fit, hem: v as PantsFit['hem'] })}
      />
      <Select
        label="Leg shape"
        testId="fit-leg-shape"
        value={fit.legShape}
        options={[
          { value: 'skinny', label: 'Skinny' },
          { value: 'slim', label: 'Slim' },
          { value: 'straight', label: 'Straight' },
          { value: 'wide', label: 'Wide' },
          { value: 'flared', label: 'Flared' },
          { value: 'bootcut', label: 'Bootcut' },
        ]}
        onChange={(v) =>
          onChange({ ...fit, legShape: v as PantsFit['legShape'] })
        }
      />
      <GenderSelect fit={fit} onChange={onChange} />
    </div>
  );
}

function ShirtPresets({
  fit,
  onChange,
}: {
  fit: ShirtFit;
  onChange: (next: FitLandmarks) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <Select
        label="Hem"
        value={fit.hem}
        options={[
          { value: 'cropped', label: 'Cropped' },
          { value: 'waist', label: 'Waist' },
          { value: 'hip', label: 'Hip' },
          { value: 'tunic', label: 'Tunic' },
        ]}
        onChange={(v) => onChange({ ...fit, hem: v as ShirtFit['hem'] })}
      />
      <Select
        label="Sleeve"
        value={fit.sleeve}
        options={[
          { value: 'sleeveless', label: 'Sleeveless' },
          { value: 'short', label: 'Short' },
          { value: 'three-quarter', label: '3/4' },
          { value: 'long', label: 'Long' },
        ]}
        onChange={(v) => onChange({ ...fit, sleeve: v as ShirtFit['sleeve'] })}
      />
      <Select
        label="Neckline"
        value={fit.neckline}
        options={[
          { value: 'crew', label: 'Crew' },
          { value: 'v-neck', label: 'V-neck' },
          { value: 'polo', label: 'Polo' },
          { value: 'henley', label: 'Henley' },
          { value: 'mock-neck', label: 'Mock-neck' },
          { value: 'button-up', label: 'Button-up' },
        ]}
        onChange={(v) =>
          onChange({ ...fit, neckline: v as ShirtFit['neckline'] })
        }
      />
      <Select
        label="Body fit"
        value={fit.bodyFit}
        options={[
          { value: 'slim', label: 'Slim' },
          { value: 'fitted', label: 'Fitted' },
          { value: 'regular', label: 'Regular' },
          { value: 'relaxed', label: 'Relaxed' },
          { value: 'oversized', label: 'Oversized' },
        ]}
        onChange={(v) =>
          onChange({ ...fit, bodyFit: v as ShirtFit['bodyFit'] })
        }
      />
      <div className="col-span-2">
        <GenderSelect fit={fit} onChange={onChange} />
      </div>
    </div>
  );
}

function JacketPresets({
  fit,
  onChange,
}: {
  fit: JacketFit;
  onChange: (next: FitLandmarks) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <Select
        label="Hem"
        value={fit.hem}
        options={[
          { value: 'cropped', label: 'Cropped' },
          { value: 'hip', label: 'Hip' },
          { value: 'mid', label: 'Mid' },
          { value: 'long', label: 'Long' },
        ]}
        onChange={(v) => onChange({ ...fit, hem: v as JacketFit['hem'] })}
      />
      <Select
        label="Sleeve"
        value={fit.sleeve}
        options={[
          { value: 'short', label: 'Short' },
          { value: 'three-quarter', label: '3/4' },
          { value: 'long', label: 'Long' },
        ]}
        onChange={(v) =>
          onChange({ ...fit, sleeve: v as JacketFit['sleeve'] })
        }
      />
      <Select
        label="Closure"
        value={fit.closure}
        options={[
          { value: 'zip', label: 'Zip' },
          { value: 'button', label: 'Button' },
          { value: 'snap', label: 'Snap' },
          { value: 'drape', label: 'Drape' },
        ]}
        onChange={(v) =>
          onChange({ ...fit, closure: v as JacketFit['closure'] })
        }
      />
      <Select
        label="Body fit"
        value={fit.bodyFit}
        options={[
          { value: 'fitted', label: 'Fitted' },
          { value: 'regular', label: 'Regular' },
          { value: 'oversized', label: 'Oversized' },
        ]}
        onChange={(v) =>
          onChange({ ...fit, bodyFit: v as JacketFit['bodyFit'] })
        }
      />
      <div className="col-span-2">
        <GenderSelect fit={fit} onChange={onChange} />
      </div>
    </div>
  );
}

function GenderSelect<F extends FitLandmarks>({
  fit,
  onChange,
}: {
  fit: F;
  onChange: (next: FitLandmarks) => void;
}) {
  return (
    <Select
      label="Silhouette gender"
      value={fit.silhouetteGender}
      options={[
        { value: 'FEMALE', label: 'Women' },
        { value: 'MALE', label: 'Men' },
        { value: 'BOTH', label: 'Show toggle to customer' },
      ]}
      onChange={(v) =>
        onChange({
          ...fit,
          silhouetteGender: v as F['silhouetteGender'],
        } as FitLandmarks)
      }
    />
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
  testId?: string;
}) {
  return (
    <label>
      <div className="text-[10px] uppercase text-secondary mb-1">{label}</div>
      <select
        data-testid={testId}
        className="w-full border border-outline-variant rounded px-2 py-1.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------- SizeChartBlock ----------

interface SizeChartBlockProps {
  type: ProductType;
  variantSizes: string[];
  value: ChartRow[];
  unit: 'in' | 'cm';
  onUnitToggle: () => void;
  onChange: (next: ChartRow[]) => void;
}

function SizeChartBlock({
  type,
  variantSizes,
  value,
  unit,
  onUnitToggle,
  onChange,
}: SizeChartBlockProps) {
  if (variantSizes.length === 0) {
    return (
      <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
        Add at least one variant size first.
      </p>
    );
  }
  const dims = SIZE_CHART_DIMENSIONS[type];

  const getValue = (
    sizeKey: string,
    dim: string,
    key: 'bodyValueIn' | 'garmentValueIn',
  ): string => {
    const found = value.find(
      (r) => r.sizeKey === sizeKey && r.dimension === dim,
    );
    if (!found) return '';
    const v = found[key];
    if (v === 0) return '';
    return unit === 'cm' ? (v * 2.54).toFixed(1) : String(v);
  };

  const setValueAt = (
    sizeKey: string,
    dim: string,
    key: 'bodyValueIn' | 'garmentValueIn',
    raw: string,
  ) => {
    if (raw.trim() === '') {
      const existing = value.find(
        (r) => r.sizeKey === sizeKey && r.dimension === dim,
      );
      if (!existing) return;
      const without = value.filter(
        (r) => !(r.sizeKey === sizeKey && r.dimension === dim),
      );
      const other =
        key === 'bodyValueIn' ? existing.garmentValueIn : existing.bodyValueIn;
      if (other === 0) {
        onChange(without);
        return;
      }
      onChange([
        ...without,
        {
          sizeKey,
          dimension: dim,
          bodyValueIn: key === 'bodyValueIn' ? 0 : existing.bodyValueIn,
          garmentValueIn:
            key === 'garmentValueIn' ? 0 : existing.garmentValueIn,
        },
      ]);
      return;
    }
    let inches = Number(raw);
    if (Number.isNaN(inches)) return;
    if (unit === 'cm') inches = inches / 2.54;
    inches = Math.round(inches * 2) / 2;
    const existing = value.find(
      (r) => r.sizeKey === sizeKey && r.dimension === dim,
    );
    const without = value.filter(
      (r) => !(r.sizeKey === sizeKey && r.dimension === dim),
    );
    const next: ChartRow = {
      sizeKey,
      dimension: dim,
      bodyValueIn: existing?.bodyValueIn ?? 0,
      garmentValueIn: existing?.garmentValueIn ?? 0,
    };
    next[key] = inches;
    onChange([...without, next]);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-secondary">
          Detailed size chart
        </p>
        <button
          type="button"
          onClick={onUnitToggle}
          className="text-[10px] uppercase tracking-widest text-secondary underline"
        >
          {unit === 'in' ? 'Show in cm' : 'Show in inches'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-outline-variant/20">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="border-b border-outline-variant/20 px-3 py-2 text-left text-[10px] uppercase tracking-[0.2em] text-secondary">
                Size
              </th>
              {dims.map((d) => (
                <th
                  key={d}
                  colSpan={2}
                  className="border-b border-outline-variant/20 px-3 py-2 text-center text-[10px] uppercase tracking-[0.2em] text-secondary"
                >
                  {d}
                </th>
              ))}
            </tr>
            <tr className="bg-surface-container-low/30">
              <th className="px-3 py-1" aria-hidden />
              {dims.flatMap((d) => [
                <th
                  key={`${d}-body`}
                  className="px-2 py-1 text-center text-[9px] uppercase text-secondary"
                >
                  Body
                </th>,
                <th
                  key={`${d}-garment`}
                  className="px-2 py-1 text-center text-[9px] uppercase text-secondary"
                >
                  Garment
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {variantSizes.map((s) => (
              <tr key={s} className="border-t border-outline-variant/10">
                <td className="px-3 py-2 font-mono text-sm">{s}</td>
                {dims.flatMap((d) => [
                  <td key={`${s}-${d}-body`} className="px-2 py-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={getValue(s, d, 'bodyValueIn')}
                      onChange={(e) =>
                        setValueAt(s, d, 'bodyValueIn', e.target.value)
                      }
                      placeholder="—"
                      aria-label={`${d} body for size ${s}`}
                      className="w-16 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-center text-sm focus:border-primary focus:outline-none focus:ring-0"
                    />
                  </td>,
                  <td key={`${s}-${d}-garment`} className="px-2 py-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={getValue(s, d, 'garmentValueIn')}
                      onChange={(e) =>
                        setValueAt(s, d, 'garmentValueIn', e.target.value)
                      }
                      placeholder="—"
                      aria-label={`${d} garment for size ${s}`}
                      className="w-16 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-center text-sm focus:border-primary focus:outline-none focus:ring-0"
                    />
                  </td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] tracking-wide text-secondary">
        Values stored in inches. Leave a cell blank to omit. New dimensions
        (front rise, hem opening, etc.) are part of the chart now.
      </p>
    </>
  );
}
