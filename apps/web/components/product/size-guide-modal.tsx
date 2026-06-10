'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  DENIM_WOMEN,
  DENIM_MEN,
  TSHIRT,
  SWEATER,
  OUTERWEAR,
  cmToIn,
  type Category,
  type Rise,
  type DenimRow,
  type TopRow,
} from '@/lib/size-charts';
import { DenimDiagram } from './size-diagrams/denim';
import { TshirtDiagram } from './size-diagrams/tshirt';
import { SweaterDiagram } from './size-diagrams/sweater';
import { OuterwearDiagram } from './size-diagrams/outerwear';
import { cn } from '@/lib/utils';

interface SizeGuideModalProps {
  open: boolean;
  onClose: () => void;
  category: Category;
  rise?: Rise | null;
  gender?: 'women' | 'men' | null;
}

export function SizeGuideModal({ open, onClose, category, rise, gender }: SizeGuideModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 300);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const format = (cm: number) => (unit === 'cm' ? cm.toFixed(1) : cmToIn(cm).toFixed(1));

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close size guide"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-ink/60 backdrop-blur-sm transition-opacity duration-200 ease-out',
          visible ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-guide-title"
        className={cn(
          'relative flex w-full max-w-3xl flex-col bg-paper shadow-2xl transition-all duration-300 ease-out',
          'max-h-[92vh] overflow-hidden sm:max-h-[88vh]',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-30'
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 z-10 rounded-full p-1.5 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex-1 overflow-y-auto px-6 pb-8 pt-10 sm:px-10 sm:pt-12">
          <h2
            id="size-guide-title"
            className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-muted"
          >
            Size Guide
          </h2>

          {/* Diagram */}
          <div className="mt-6 flex justify-center">
            {category === 'denim' && <DenimDiagram rise={rise} />}
            {category === 'tshirt' && <TshirtDiagram />}
            {category === 'sweater' && <SweaterDiagram />}
            {category === 'outerwear' && <OuterwearDiagram />}
          </div>

          {/* Unit toggle */}
          <div className="mt-6 flex items-center justify-end gap-3 text-xs font-medium uppercase tracking-[0.15em]">
            <span className={cn(unit === 'cm' ? 'text-ink' : 'text-muted')}>cm</span>
            <button
              type="button"
              role="switch"
              aria-checked={unit === 'in'}
              onClick={() => setUnit((u) => (u === 'cm' ? 'in' : 'cm'))}
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                unit === 'in' ? 'bg-ink' : 'bg-ink/80'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-transform',
                  unit === 'in' ? 'translate-x-[22px]' : 'translate-x-0.5'
                )}
              />
            </button>
            <span className={cn(unit === 'in' ? 'text-ink' : 'text-muted')}>in</span>
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            {category === 'denim' ? (
              <DenimTable
                rows={gender === 'men' ? DENIM_MEN : DENIM_WOMEN}
                format={format}
              />
            ) : category === 'outerwear' ? (
              <OuterwearTable rows={OUTERWEAR} format={format} />
            ) : (
              <TopTable
                rows={category === 'sweater' ? SWEATER : TSHIRT}
                format={format}
              />
            )}
          </div>

          {gender === null && category === 'denim' && (
            <p className="mt-3 text-center text-[11px] text-muted">
              Showing Women sizing — men&apos;s denim sizes vary. See{' '}
              <a href="/size-guide" className="underline hover:text-ink">
                full size guide
              </a>
              .
            </p>
          )}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
            Between sizes? We recommend sizing up for a relaxed fit. Measurements are of
            the garment, taken flat. Allow ±1cm tolerance.
          </p>
        </div>
      </div>
    </div>
  );
}

function DenimTable({ rows, format }: { rows: DenimRow[]; format: (v: number) => string }) {
  return (
    <table className="w-full min-w-[520px] border border-border text-sm">
      <thead>
        <tr className="border-b border-border bg-muted-bg/50">
          <Th>Size</Th>
          <Th>Waist</Th>
          <Th>Hip</Th>
          <Th>Rise</Th>
          <Th>Inseam</Th>
          <Th>Leg Opening</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.size} className={cn(i !== rows.length - 1 && 'border-b border-border/60')}>
            <Td bold>{r.size}</Td>
            <Td>{format(r.waist)}</Td>
            <Td>{format(r.hip)}</Td>
            <Td>{format(r.rise)}</Td>
            <Td>{format(r.inseam)}</Td>
            <Td>{format(r.leg)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopTable({ rows, format }: { rows: TopRow[]; format: (v: number) => string }) {
  return (
    <table className="w-full min-w-[480px] border border-border text-sm">
      <thead>
        <tr className="border-b border-border bg-muted-bg/50">
          <Th>Size</Th>
          <Th>Full Length</Th>
          <Th>Chest (1/2)</Th>
          <Th>Shoulder</Th>
          <Th>Sleeve</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.size} className={cn(i !== rows.length - 1 && 'border-b border-border/60')}>
            <Td bold>{r.size}</Td>
            <Td>{format(r.fullLength)}</Td>
            <Td>{format(r.chest)}</Td>
            <Td>{format(r.shoulder)}</Td>
            <Td>{format(r.sleeve)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OuterwearTable({ rows, format }: { rows: TopRow[]; format: (v: number) => string }) {
  return (
    <table className="w-full min-w-[560px] border border-border text-sm">
      <thead>
        <tr className="border-b border-border bg-muted-bg/50">
          <Th>Size</Th>
          <Th>Full Length</Th>
          <Th>Chest (1/2)</Th>
          <Th>Shoulder</Th>
          <Th>Sleeve</Th>
          <Th>Jacket Length</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.size} className={cn(i !== rows.length - 1 && 'border-b border-border/60')}>
            <Td bold>{r.size}</Td>
            <Td>{format(r.fullLength)}</Td>
            <Td>{format(r.chest)}</Td>
            <Td>{format(r.shoulder)}</Td>
            <Td>{format(r.sleeve)}</Td>
            <Td>{format(r.jacketLength ?? r.fullLength)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
      {children}
    </th>
  );
}

function Td({ children, bold = false }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td className={cn('px-3 py-3 text-center text-sm', bold ? 'font-semibold text-ink' : 'text-muted')}>
      {children}
    </td>
  );
}
