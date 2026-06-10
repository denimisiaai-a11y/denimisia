'use client';

import { useState } from 'react';
import {
  DENIM_WOMEN,
  DENIM_MEN,
  TSHIRT,
  SWEATER,
  OUTERWEAR,
  cmToIn,
  type DenimRow,
  type TopRow,
} from '@/lib/size-charts';

type Unit = 'cm' | 'in';

/**
 * Universal size chart — single source of truth (lib/size-charts), the same
 * data the product-page size guide uses. Replaces the per-page tables that had
 * drifted out of sync. Shown on /size-guide and reusable anywhere a full chart
 * is needed.
 */
const TH =
  'whitespace-nowrap py-3 pr-6 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink';
const TD_KEY = 'whitespace-nowrap py-3 pr-6 font-medium text-ink';
const TD = 'whitespace-nowrap py-3 pr-6 text-muted';

function DenimTable({
  title,
  rows,
  fmt,
}: {
  title: string;
  rows: DenimRow[];
  fmt: (v: number) => string;
}) {
  return (
    <div>
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink">
              {['Size', 'Waist', 'Hip', 'Rise', 'Inseam', 'Leg Opening'].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.size} className="border-b border-border">
                <td className={TD_KEY}>{r.size}</td>
                <td className={TD}>{fmt(r.waist)}</td>
                <td className={TD}>{fmt(r.hip)}</td>
                <td className={TD}>{fmt(r.rise)}</td>
                <td className={TD}>{fmt(r.inseam)}</td>
                <td className={TD}>{fmt(r.leg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopTable({
  title,
  rows,
  fmt,
  withJacket,
}: {
  title: string;
  rows: TopRow[];
  fmt: (v: number) => string;
  withJacket?: boolean;
}) {
  const headers = ['Size', 'Length', 'Chest', 'Shoulder', 'Sleeve'];
  if (withJacket) headers.push('Jacket Length');
  return (
    <div>
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink">
              {headers.map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.size} className="border-b border-border">
                <td className={TD_KEY}>{r.size}</td>
                <td className={TD}>{fmt(r.fullLength)}</td>
                <td className={TD}>{fmt(r.chest)}</td>
                <td className={TD}>{fmt(r.shoulder)}</td>
                <td className={TD}>{fmt(r.sleeve)}</td>
                {withJacket && (
                  <td className={TD}>
                    {r.jacketLength !== undefined ? fmt(r.jacketLength) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UniversalSizeChart() {
  const [unit, setUnit] = useState<Unit>('cm');
  const fmt = (v: number) => (unit === 'cm' ? String(v) : cmToIn(v).toFixed(1));

  return (
    <div className="space-y-12">
      {/* Unit toggle */}
      <div className="flex items-center justify-end gap-1">
        {(['cm', 'in'] as Unit[]).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            aria-pressed={unit === u}
            className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
              unit === u ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
            }`}
          >
            {u}
          </button>
        ))}
      </div>

      <section className="space-y-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Denim & Bottoms
        </h2>
        <DenimTable title="Women" rows={DENIM_WOMEN} fmt={fmt} />
        <DenimTable title="Men" rows={DENIM_MEN} fmt={fmt} />
      </section>

      <section className="space-y-10">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Tops & Outerwear
        </h2>
        <TopTable title="T-Shirts" rows={TSHIRT} fmt={fmt} />
        <TopTable title="Sweaters & Knitwear" rows={SWEATER} fmt={fmt} />
        <TopTable title="Jackets & Outerwear" rows={OUTERWEAR} fmt={fmt} withJacket />
      </section>
    </div>
  );
}
