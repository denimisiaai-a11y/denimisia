'use client';

import { useEffect, useState } from 'react';

interface Props {
  readonly endDate: string;
}

function diffParts(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds, ended: diff === 0 };
}

export function CountdownBanner({ endDate }: Props) {
  const target = new Date(endDate).getTime();
  const [parts, setParts] = useState(() => diffParts(target, Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setParts(diffParts(target, Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (parts.ended) return null;

  const cell = (n: number, label: string) => (
    <div className="flex flex-col items-center">
      <span className="font-serif text-3xl text-ink tabular-nums md:text-4xl">
        {String(n).padStart(2, '0')}
      </span>
      <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
        {label}
      </span>
    </div>
  );

  return (
    <div className="border-y border-ink/10 bg-paper py-6">
      <div className="mx-auto flex max-w-md items-center justify-around px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
          Ends in
        </p>
        {cell(parts.days, 'days')}
        {cell(parts.hours, 'hrs')}
        {cell(parts.minutes, 'min')}
        {cell(parts.seconds, 'sec')}
      </div>
    </div>
  );
}
