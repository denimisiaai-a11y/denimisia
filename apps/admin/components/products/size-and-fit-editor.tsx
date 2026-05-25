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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((body: unknown) => {
        if (cancelled) return;
        const rows = Array.isArray(body)
          ? (body as SilhouetteData[])
          : ((body as { data?: SilhouetteData[] }).data ?? []);
        setSilhouettes(rows);
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
      <section className="space-y-3 rounded border border-outline-variant/20 p-4">
        <header className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
          Size &amp; Fit
        </header>
        <p className="text-sm text-on-surface">
          Pick a product Type (Pants / Shirts / Jackets) above to unlock the
          silhouette preview, fit presets, and detailed size chart.
        </p>
      </section>
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

// ---------- Default-size-chart generator ----------
//
// Produces a sensible starter chart based on product type + the variant sizes
// the user has already entered. Values are industry-standard ballparks the
// merchandiser can tweak per design; never meant to be authoritative.
//
// PANTS expects numeric waist-size keys (24, 26, 28...). For non-numeric
// keys the row is skipped. SHIRTS/JACKETS use a letter-size lookup
// (XS..XXL); unknown keys fall through.

const SHIRT_LETTER_DEFAULTS: Record<
  string,
  Partial<Record<string, [number, number]>>
> = {
  XS:  { chest: [34, 38], shoulder: [14, 15], length: [24, 25], sleeve: [22, 23], bicep: [12, 14], 'hem opening': [36, 40], 'neck width': [14, 15],   'cuff opening': [8, 9],   'armhole depth': [8, 9] },
  S:   { chest: [36, 40], shoulder: [15, 16], length: [25, 26], sleeve: [23, 24], bicep: [13, 15], 'hem opening': [38, 42], 'neck width': [14.5, 15.5], 'cuff opening': [8, 9],   'armhole depth': [8.5, 9.5] },
  M:   { chest: [38, 42], shoulder: [16, 17], length: [26, 27], sleeve: [24, 25], bicep: [14, 16], 'hem opening': [40, 44], 'neck width': [15, 16],   'cuff opening': [9, 10],  'armhole depth': [9, 10] },
  L:   { chest: [40, 44], shoulder: [17, 18], length: [27, 28], sleeve: [25, 26], bicep: [15, 17], 'hem opening': [42, 46], 'neck width': [15.5, 16.5], 'cuff opening': [9, 10],  'armhole depth': [9.5, 10.5] },
  XL:  { chest: [42, 46], shoulder: [18, 19], length: [28, 29], sleeve: [26, 27], bicep: [16, 18], 'hem opening': [44, 48], 'neck width': [16, 17],   'cuff opening': [10, 11], 'armhole depth': [10, 11] },
  XXL: { chest: [44, 48], shoulder: [19, 20], length: [29, 30], sleeve: [27, 28], bicep: [17, 19], 'hem opening': [46, 50], 'neck width': [16.5, 17.5], 'cuff opening': [10, 11], 'armhole depth': [10.5, 11.5] },
};

const JACKET_LETTER_DEFAULTS: Record<
  string,
  Partial<Record<string, [number, number]>>
> = {
  XS:  { chest: [36, 41], shoulder: [16, 17], length: [25, 26], sleeve: [23, 24], bicep: [13, 16], 'hem opening': [38, 43], 'cuff opening': [9, 10],  'back length': [25, 26], 'armhole depth': [9, 10] },
  S:   { chest: [38, 43], shoulder: [17, 18], length: [26, 27], sleeve: [24, 25], bicep: [14, 17], 'hem opening': [40, 45], 'cuff opening': [9, 10],  'back length': [26, 27], 'armhole depth': [9.5, 10.5] },
  M:   { chest: [40, 45], shoulder: [18, 19], length: [27, 28], sleeve: [25, 26], bicep: [15, 18], 'hem opening': [42, 47], 'cuff opening': [10, 11], 'back length': [27, 28], 'armhole depth': [10, 11] },
  L:   { chest: [42, 47], shoulder: [19, 20], length: [28, 29], sleeve: [26, 27], bicep: [16, 19], 'hem opening': [44, 49], 'cuff opening': [10, 11], 'back length': [28, 29], 'armhole depth': [10.5, 11.5] },
  XL:  { chest: [44, 49], shoulder: [20, 21], length: [29, 30], sleeve: [27, 28], bicep: [17, 20], 'hem opening': [46, 51], 'cuff opening': [11, 12], 'back length': [29, 30], 'armhole depth': [11, 12] },
  XXL: { chest: [46, 51], shoulder: [21, 22], length: [30, 31], sleeve: [28, 29], bicep: [18, 21], 'hem opening': [48, 53], 'cuff opening': [11, 12], 'back length': [30, 31], 'armhole depth': [11.5, 12.5] },
};

function pantsDefaultRow(
  size: string,
  dim: string,
): [number, number] | null {
  const N = Number(size);
  if (Number.isNaN(N)) return null;
  switch (dim) {
    case 'waist':            return [N, N + 1];
    case 'hip':              return [N + 9, N + 11];
    case 'inseam':           return [32, 32];
    case 'thigh':            return [Math.floor(N / 2) + 9, Math.floor(N / 2) + 11];
    case 'front rise':       return [11, 11];
    case 'back rise':        return [14, 14];
    case 'hem opening':      return [22, 22];
    case 'waistband height': return [2, 2];
    default:                 return null;
  }
}

export function buildDefaultSizeChart(
  type: ProductType,
  variantSizes: string[],
): ChartRow[] {
  const dims = SIZE_CHART_DIMENSIONS[type];
  const rows: ChartRow[] = [];
  for (const sizeKey of variantSizes) {
    if (type === 'PANTS') {
      for (const dim of dims) {
        const pair = pantsDefaultRow(sizeKey, dim);
        if (!pair) continue;
        rows.push({ sizeKey, dimension: dim, bodyValueIn: pair[0], garmentValueIn: pair[1] });
      }
    } else {
      const table = type === 'SHIRTS' ? SHIRT_LETTER_DEFAULTS : JACKET_LETTER_DEFAULTS;
      const entry = table[sizeKey.toUpperCase()];
      if (!entry) continue;
      for (const dim of dims) {
        const pair = entry[dim];
        if (!pair) continue;
        rows.push({ sizeKey, dimension: dim, bodyValueIn: pair[0], garmentValueIn: pair[1] });
      }
    }
  }
  return rows;
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
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-secondary">
          Detailed size chart
        </p>
        <p className="text-sm text-on-surface">
          Add at least one variant size (in the Variants section above) to
          enable the size chart matrix. Each row maps a size to body +
          garment measurements per dimension.
        </p>
        <p className="text-[11px] text-secondary">
          Dimensions for {type}:{' '}
          {SIZE_CHART_DIMENSIONS[type].join(', ')}
        </p>
      </div>
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
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              const next = buildDefaultSizeChart(type, variantSizes);
              if (value.length > 0) {
                const ok = window.confirm(
                  'Replace the current size chart with auto-generated defaults?',
                );
                if (!ok) return;
              }
              onChange(next);
            }}
            className="text-[10px] uppercase tracking-widest text-secondary underline hover:text-primary"
            title={`Generate industry-standard ${type.toLowerCase()} measurements for the entered sizes`}
          >
            Auto-fill defaults
          </button>
          <button
            type="button"
            onClick={onUnitToggle}
            className="text-[10px] uppercase tracking-widest text-secondary underline"
          >
            {unit === 'in' ? 'Show in cm' : 'Show in inches'}
          </button>
        </div>
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
