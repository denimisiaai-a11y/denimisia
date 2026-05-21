'use client';

import { useState } from 'react';
import { SIZE_CHART_DIMENSIONS, type ProductType } from '@/lib/product-taxonomy';

export interface ChartRow {
  sizeKey: string;
  dimension: string;
  bodyValueIn: number;
  garmentValueIn: number;
}

interface Props {
  type: ProductType | null;
  variantSizes: string[];
  value: ChartRow[];
  onChange: (next: ChartRow[]) => void;
}

/**
 * Per-variant size chart matrix. Rows = variant sizes (from VariantsBuilder),
 * columns = (body, garment) pairs for each chart dimension defined by the
 * product type. All values are persisted as inches; the in/cm toggle is a
 * display-only conversion. Empty cells stay out of `value` until the admin
 * types a number, so partially filled charts don't bloat the payload.
 */
export function SizeChartEditor({ type, variantSizes, value, onChange }: Props) {
  const [unit, setUnit] = useState<'in' | 'cm'>('in');

  if (!type) {
    return (
      <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
        Select a type first.
      </p>
    );
  }

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

  const setValue = (
    sizeKey: string,
    dim: string,
    key: 'bodyValueIn' | 'garmentValueIn',
    raw: string,
  ) => {
    if (raw.trim() === '') {
      // Treat blank as "clear this cell": drop the row entirely if both
      // body and garment end up at 0, otherwise zero just that side.
      const existing = value.find(
        (r) => r.sizeKey === sizeKey && r.dimension === dim,
      );
      if (!existing) return;
      const without = value.filter(
        (r) => !(r.sizeKey === sizeKey && r.dimension === dim),
      );
      const other = key === 'bodyValueIn' ? existing.garmentValueIn : existing.bodyValueIn;
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
          garmentValueIn: key === 'garmentValueIn' ? 0 : existing.garmentValueIn,
        },
      ]);
      return;
    }

    let inches = Number(raw);
    if (Number.isNaN(inches)) return;
    if (unit === 'cm') inches = inches / 2.54;
    // Snap to nearest half-inch — keeps charts tidy and matches typical
    // garment-spec rounding.
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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
          Size chart
        </p>
        <button
          type="button"
          onClick={() => setUnit(unit === 'in' ? 'cm' : 'in')}
          className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-on-surface transition-colors"
        >
          {unit === 'in' ? 'Show in cm' : 'Show in inches'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-outline-variant/20">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="border-b border-outline-variant/20 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Size
              </th>
              {dims.map((d) => (
                <th
                  key={d}
                  colSpan={2}
                  className="border-b border-outline-variant/20 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
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
                  className="px-2 py-1 text-center text-[9px] font-semibold uppercase tracking-widest text-secondary"
                >
                  Body
                </th>,
                <th
                  key={`${d}-garment`}
                  className="px-2 py-1 text-center text-[9px] font-semibold uppercase tracking-widest text-secondary"
                >
                  Garment
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {variantSizes.map((s) => (
              <tr key={s} className="border-t border-outline-variant/10">
                <td className="px-3 py-2 font-mono text-sm text-on-surface">{s}</td>
                {dims.flatMap((d) => [
                  <td key={`${s}-${d}-body`} className="px-2 py-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={getValue(s, d, 'bodyValueIn')}
                      onChange={(e) =>
                        setValue(s, d, 'bodyValueIn', e.target.value)
                      }
                      placeholder="—"
                      aria-label={`${d} body for size ${s}`}
                      className="w-16 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-center text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                    />
                  </td>,
                  <td key={`${s}-${d}-garment`} className="px-2 py-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={getValue(s, d, 'garmentValueIn')}
                      onChange={(e) =>
                        setValue(s, d, 'garmentValueIn', e.target.value)
                      }
                      placeholder="—"
                      aria-label={`${d} garment for size ${s}`}
                      className="w-16 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-center text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                    />
                  </td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] tracking-wide text-secondary">
        Values stored in inches. Toggle the header to enter in cm — conversion is
        automatic. Leave a cell blank to omit that measurement.
      </p>
    </div>
  );
}
