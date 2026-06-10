'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '@/lib/api';
import { SectionCard } from './section-card';

interface Coverage {
  total: number;
  missingType: number;
  missingTags: number;
  missingCharts: number;
  missingFitLandmarks: number;
}

interface Props {
  token: string | undefined;
}

/**
 * Operations widget for the Atelier dashboard. Surfaces how much of the
 * active catalog is missing the data the product-finder bot needs (Type,
 * attribute tags, size charts). Each count links to a filtered products
 * list so admins can drill in and fix the gaps.
 */
export function FitDataCoverageCard({ token }: Props) {
  const [data, setData] = useState<Coverage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    adminFetch<Coverage>('/bot/admin/fit-data-coverage', token)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <SectionCard icon="rule" title="Bot Fit Data Coverage">
      {error ? (
        <p className="text-[11px] tracking-wide text-primary">{error}</p>
      ) : !data ? (
        <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
          Loading…
        </p>
      ) : (
        <dl className="space-y-3">
          <Row label="Total products" value={String(data.total)} />
          <Row
            label="Missing Type"
            value={
              <Link href="/products?missing=type" className="underline">
                {data.missingType}
              </Link>
            }
            warn={data.missingType > 0}
          />
          <Row
            label="Missing attributes"
            value={
              <Link href="/products?missing=tags" className="underline">
                {data.missingTags}
              </Link>
            }
            warn={data.missingTags > 0}
          />
          <Row
            label="Missing size charts"
            value={
              <Link href="/products?missing=charts" className="underline">
                {data.missingCharts}
              </Link>
            }
            warn={data.missingCharts > 0}
          />
          <Row
            label="Missing fit landmarks"
            value={
              <Link
                href="/products?missing=fitLandmarks"
                className="underline"
              >
                {data.missingFitLandmarks}
              </Link>
            }
            warn={data.missingFitLandmarks > 0}
          />
        </dl>
      )}
    </SectionCard>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-body text-[11px] uppercase tracking-[0.2em] text-secondary">
        {label}
      </dt>
      <dd
        className={
          warn
            ? 'font-headline text-lg font-semibold text-primary'
            : 'font-headline text-lg font-semibold text-on-surface'
        }
      >
        {value}
      </dd>
    </div>
  );
}
