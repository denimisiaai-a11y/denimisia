'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getProductSizeChart, type SizeChartRow } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/components/chat/use-chat-store';

interface SizeChartModalProps {
  productId: string;
  open: boolean;
  onClose: () => void;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SizeChartModal({ productId, open, onClose }: SizeChartModalProps) {
  const [rows, setRows] = useState<SizeChartRow[]>([]);
  const [unit, setUnit] = useState<'in' | 'cm'>('in');
  const [loading, setLoading] = useState(true);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const pushMessage = useChatStore((s) => s.pushMessage);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    getProductSizeChart(productId)
      .then((r) => {
        if (!cancelled) setRows(r.rows);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  // Close on Escape, lock body scroll while open.
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

  if (!open) return null;

  const sizes = Array.from(new Set(rows.map((r) => r.sizeKey)));
  const dimensions = Array.from(new Set(rows.map((r) => r.dimension)));
  const display = (v: number) => (unit === 'cm' ? (v * 2.54).toFixed(1) : v.toFixed(1));

  function helpMePick() {
    setChatOpen(true);
    pushMessage({
      id: genId(),
      role: 'user',
      text: 'Help me find my size',
      ts: Date.now(),
    });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-chart-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 backdrop-blur-sm p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-paper shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3
            id="size-chart-title"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-ink"
          >
            Size chart
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setUnit(unit === 'in' ? 'cm' : 'in')}
              className="text-xs font-medium uppercase tracking-[0.15em] text-muted underline-offset-2 hover:underline"
              aria-label={`Switch to ${unit === 'in' ? 'centimetres' : 'inches'}`}
            >
              {unit === 'in' ? 'Show cm' : 'Show in'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-sm text-muted">
              Size chart not available for this product yet.{' '}
              <a className="underline hover:text-ink" href="/size-guide">
                See general sizing guide
              </a>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border border-border text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted-bg/50">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
                      Size
                    </th>
                    {dimensions.flatMap((d) => [
                      <th
                        key={`${d}-body`}
                        className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-ink"
                      >
                        {d} (body)
                      </th>,
                      <th
                        key={`${d}-garment`}
                        className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-ink"
                      >
                        {d} (garment)
                      </th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((s, i) => (
                    <tr
                      key={s}
                      className={cn(i !== sizes.length - 1 && 'border-b border-border/60')}
                    >
                      <td className="px-3 py-2 text-left text-sm font-semibold text-ink">{s}</td>
                      {dimensions.flatMap((d) => {
                        const row = rows.find((r) => r.sizeKey === s && r.dimension === d);
                        return [
                          <td
                            key={`${s}-${d}-b`}
                            className="px-3 py-2 text-center text-sm text-muted"
                          >
                            {row ? display(row.bodyValueIn) : '—'}
                          </td>,
                          <td
                            key={`${s}-${d}-g`}
                            className="px-3 py-2 text-center text-sm text-muted"
                          >
                            {row ? display(row.garmentValueIn) : '—'}
                          </td>,
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-muted">
                Body = your measurement. Garment = the garment laid flat. Allow ±1{unit}{' '}
                tolerance.
              </p>
            </div>
          )}
        </div>

        <footer className="border-t border-border px-5 py-4 text-center">
          <button
            type="button"
            onClick={helpMePick}
            className="rounded-full bg-ink px-5 py-2 text-xs font-medium uppercase tracking-[0.15em] text-paper transition-opacity hover:opacity-90"
          >
            Help me pick →
          </button>
        </footer>
      </div>
    </div>
  );
}
