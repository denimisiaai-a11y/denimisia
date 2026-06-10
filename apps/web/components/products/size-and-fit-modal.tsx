'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  SilhouetteCanvas,
  defaultPlaceholderFit,
  type FitLandmarks,
  type SilhouetteData,
} from '@repo/fit-engine';
import {
  getProductSizeChart,
  getSilhouettes,
  type SizeChartRow,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/components/chat/use-chat-store';

interface SizeAndFitModalProps {
  productId: string;
  productName: string;
  productType: 'PANTS' | 'SHIRTS' | 'JACKETS' | null;
  fitLandmarks: FitLandmarks | null;
  open: boolean;
  onClose: () => void;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SizeAndFitModal({
  productId,
  productName,
  productType,
  fitLandmarks,
  open,
  onClose,
}: SizeAndFitModalProps) {
  const [rows, setRows] = useState<SizeChartRow[]>([]);
  const [silhouettes, setSilhouettes] = useState<SilhouetteData[]>([]);
  const [chosenGender, setChosenGender] = useState<'MALE' | 'FEMALE'>(
    fitLandmarks?.silhouetteGender === 'MALE' ? 'MALE' : 'FEMALE',
  );
  const [unit, setUnit] = useState<'in' | 'cm'>('in');
  const [loading, setLoading] = useState(true);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const pushMessage = useChatStore((s) => s.pushMessage);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getProductSizeChart(productId), getSilhouettes()])
      .then(([sc, sils]) => {
        if (cancelled) return;
        setRows(sc.rows);
        setSilhouettes(sils);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setSilhouettes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

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

  const showGenderToggle = fitLandmarks?.silhouetteGender === 'BOTH';
  const silhouette = silhouettes.find((s) => s.gender === chosenGender);

  const effectiveFit: FitLandmarks | null = useMemo(() => {
    if (fitLandmarks) return fitLandmarks;
    return defaultPlaceholderFit(productType, chosenGender);
  }, [fitLandmarks, productType, chosenGender]);

  const sizes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.sizeKey))),
    [rows],
  );
  const dimensions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.dimension))),
    [rows],
  );
  const display = (v: number) =>
    unit === 'cm' ? (v * 2.54).toFixed(1) : v.toFixed(1);

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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="size-fit-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 backdrop-blur-sm p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-paper shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3
            id="size-fit-title"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-ink"
          >
            Size &amp; Fit
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
              className="rounded-full p-1 text-ink/60 hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] flex-1 overflow-hidden">
          <aside className="bg-muted-bg/30 border-r border-border p-5 flex flex-col items-center gap-3">
            {showGenderToggle && (
              <div className="inline-flex bg-paper border border-border rounded-full p-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setChosenGender('FEMALE')}
                  className={cn(
                    'px-3 py-1 rounded-full',
                    chosenGender === 'FEMALE' && 'bg-ink text-paper',
                  )}
                >
                  Women
                </button>
                <button
                  type="button"
                  onClick={() => setChosenGender('MALE')}
                  className={cn(
                    'px-3 py-1 rounded-full',
                    chosenGender === 'MALE' && 'bg-ink text-paper',
                  )}
                >
                  Men
                </button>
              </div>
            )}
            {silhouette ? (
              <SilhouetteCanvas
                silhouette={silhouette}
                fit={effectiveFit}
                editable={false}
              />
            ) : (
              <p className="text-xs text-muted">Loading silhouette…</p>
            )}
            <p className="text-[11px] text-muted text-center max-w-[200px]">
              {productName}
            </p>
          </aside>

          <section className="flex flex-col p-5 overflow-y-auto">
            <h4 className="text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
              Size chart
            </h4>
            {loading ? (
              <p className="py-6 text-center text-sm text-muted">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-sm text-muted">
                Size chart not available for this product yet.
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
                        className={cn(
                          i !== sizes.length - 1 && 'border-b border-border/60',
                        )}
                      >
                        <td className="px-3 py-2 text-left text-sm font-semibold text-ink">
                          {s}
                        </td>
                        {dimensions.flatMap((d) => {
                          const row = rows.find(
                            (r) => r.sizeKey === s && r.dimension === d,
                          );
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
              </div>
            )}

            <div className="mt-auto pt-5 border-t border-border/60">
              <button
                type="button"
                onClick={helpMePick}
                className="w-full rounded-full bg-ink px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-paper hover:opacity-90"
              >
                Help me pick →
              </button>
              <p className="text-[10px] text-muted text-center mt-2">
                Opens chat for personalised sizing
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
