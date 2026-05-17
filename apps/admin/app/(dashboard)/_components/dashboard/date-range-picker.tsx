'use client';

import { useEffect, useState } from 'react';

interface DateRangePickerProps {
  readonly from: string; // ISO yyyy-mm-dd
  readonly to: string;
  readonly onApply: (from: string, to: string) => void;
}

function formatDisplay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function DateRangePicker({ from, to, onApply }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  // Re-sync local state when parent props change (external reset).
  useEffect(() => {
    setLocalFrom(from);
    setLocalTo(to);
  }, [from, to]);

  function apply() {
    onApply(localFrom, localTo);
    setOpen(false);
  }

  function preset(days: number) {
    const toD = new Date();
    const fromD = new Date();
    fromD.setDate(toD.getDate() - days);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setLocalFrom(iso(fromD));
    setLocalTo(iso(toD));
    onApply(iso(fromD), iso(toD));
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="atelier-shadow-sm inline-flex items-center gap-3 bg-surface-container-lowest px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface transition-colors duration-300 ease-editorial hover:bg-surface-container"
      >
        <span className="material-symbols-outlined text-sm text-secondary" aria-hidden>
          calendar_month
        </span>
        <span>
          {formatDisplay(from)} — {formatDisplay(to)}
        </span>
        <span className="material-symbols-outlined text-sm text-secondary" aria-hidden>
          expand_more
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="atelier-shadow absolute right-0 top-full z-50 mt-2 w-[360px] bg-surface-container-lowest p-6">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Select Range
            </p>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
                  From
                </span>
                <input
                  type="date"
                  value={localFrom}
                  onChange={(e) => setLocalFrom(e.target.value)}
                  className="w-full border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-on-surface focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
                  To
                </span>
                <input
                  type="date"
                  value={localTo}
                  onChange={(e) => setLocalTo(e.target.value)}
                  className="w-full border border-outline-variant/40 bg-surface-container-low px-3 py-2 font-body text-sm text-on-surface focus:border-on-surface focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: '7D', days: 7 },
                { label: '30D', days: 30 },
                { label: '90D', days: 90 },
                { label: '1Y', days: 365 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => preset(p.days)}
                  className="border border-outline-variant/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-secondary transition-colors duration-300 ease-editorial hover:border-on-surface hover:text-on-surface"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 border border-outline-variant/30 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 ease-editorial hover:border-on-surface hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={apply}
                className="flex-1 bg-inverse-surface py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02]"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
