'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  getReturnsMetrics,
  type ReturnReason,
  type ReturnsMetrics,
} from '@/lib/api-returns';
import { Banner } from '@/components/admin-ui';

// ---------------------------------------------------------------------------
// Range options + label helpers
// ---------------------------------------------------------------------------

const RANGE_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '365 days' },
];

const REASON_LABELS: Record<ReturnReason, string> = {
  DEFECTIVE: 'Defective',
  DAMAGED_IN_TRANSIT: 'Damaged in transit',
  NOT_AS_DESCRIBED: 'Not as described',
  WRONG_ITEM_SENT: 'Wrong item sent',
  WRONG_SIZE: 'Wrong size',
  CHANGED_MIND: 'Changed mind',
};

const BDT_FORMATTER = new Intl.NumberFormat('en-BD', {
  maximumFractionDigits: 0,
});

function formatBDT(value: number): string {
  if (!Number.isFinite(value)) return 'BDT 0';
  return `BDT ${BDT_FORMATTER.format(value)}`;
}

// ---------------------------------------------------------------------------
// Stat card — kept inline so the file stays self-contained. The home page
// shares similar styling; if a third place needs it we'll lift it into
// admin-ui.tsx.
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  subtitle: string;
  loading: boolean;
}

function StatCard({ label, value, subtitle, loading }: StatCardProps) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-sm border border-outline-variant/5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
        {label}
      </p>
      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-7 w-24 animate-pulse rounded-sm bg-surface-container-high" />
          <div className="h-3 w-40 animate-pulse rounded-sm bg-surface-container-high" />
        </div>
      ) : (
        <>
          <h3 className="font-headline text-3xl font-semibold mt-2 text-on-surface">
            {value}
          </h3>
          <p className="mt-2 text-[11px] text-secondary tracking-wide">{subtitle}</p>
        </>
      )}
    </div>
  );
}

export default function ReturnsMetricsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [rangeDays, setRangeDays] = useState(30);
  const [metrics, setMetrics] = useState<ReturnsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getReturnsMetrics(token, rangeDays);
      setMetrics(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [token, rangeDays]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Derived display values — pre-computed so the JSX stays readable.
  const returnRatePct = metrics
    ? `${(metrics.returnRate * 100).toFixed(1)}%`
    : '—';
  const returnRateSubtitle = metrics
    ? `${metrics.returnsCount} returns over ${metrics.ordersCount} delivered orders`
    : '—';
  const totalReturns = metrics ? metrics.returnsCount.toLocaleString() : '—';
  const avgResolution =
    metrics && metrics.averageResolutionHours !== null
      ? `${metrics.averageResolutionHours.toFixed(1)}h`
      : 'N/A';
  const pendingValue = metrics ? formatBDT(metrics.pendingRefundValue) : '—';

  // Top reasons: sorted descending by count, max width relative to top reason.
  const topReasons = metrics?.topReasons ?? [];
  const maxReasonCount = topReasons.reduce(
    (max, r) => (r.count > max ? r.count : max),
    0,
  );

  const showEmpty =
    !loading && !error && metrics !== null && metrics.returnsCount === 0;

  return (
    <>
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
            <Link href="/returns" className="hover:text-on-surface">
              Returns
            </Link>
            <span className="mx-2 text-outline-variant">/</span>
            <span className="text-on-surface">Metrics</span>
          </p>
          <h2 className="mt-2 font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Metrics
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            How often we get returns, why they come back, and what it costs us.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((opt) => {
            const active = rangeDays === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRangeDays(opt.value)}
                className={`px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 ease-editorial ${
                  active
                    ? 'bg-inverse-surface text-inverse-on-surface'
                    : 'bg-surface-container-high text-secondary hover:text-on-surface'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <Banner tone="error" message={error} />}

      {/* Stat grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Return rate"
          value={returnRatePct}
          subtitle={returnRateSubtitle}
          loading={loading}
        />
        <StatCard
          label="Total returns"
          value={totalReturns}
          subtitle={`in last ${rangeDays} days`}
          loading={loading}
        />
        <StatCard
          label="Avg resolution"
          value={avgResolution}
          subtitle="from request to closure"
          loading={loading}
        />
        <StatCard
          label="Pending refund value"
          value={pendingValue}
          subtitle="across active returns"
          loading={loading}
        />
      </div>

      {/* Top reasons */}
      <section className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
              Top reasons
            </p>
            <h3 className="font-headline mt-1 text-xl font-semibold uppercase tracking-[0.1em] text-on-surface">
              Why customers send things back
            </h3>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3"
              >
                <div className="w-40 h-3 animate-pulse rounded-sm bg-surface-container-high" />
                <div className="flex-1 h-5 animate-pulse rounded-sm bg-surface-container-high" />
                <div className="w-8 h-3 animate-pulse rounded-sm bg-surface-container-high" />
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <div className="mt-10 mb-6 flex flex-col items-center justify-center text-center">
            <p className="font-headline text-lg font-semibold uppercase tracking-[0.15em] text-on-surface">
              No returns yet in this range
            </p>
            <p className="mt-2 text-xs text-secondary tracking-wide">
              Once customers start filing returns, reason breakdowns will show up here.
            </p>
          </div>
        ) : topReasons.length === 0 ? (
          <p className="mt-6 text-xs text-secondary">
            No reason data available for this range.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {topReasons.map((r) => {
              const widthPct =
                maxReasonCount > 0
                  ? Math.max(2, Math.round((r.count / maxReasonCount) * 100))
                  : 0;
              return (
                <li
                  key={r.reason}
                  className="grid grid-cols-[160px_1fr_48px] items-center gap-3"
                >
                  <span className="text-xs font-medium text-on-surface tracking-wide">
                    {REASON_LABELS[r.reason] ?? r.reason}
                  </span>
                  <div
                    className="h-5 rounded-sm bg-surface-container-high overflow-hidden"
                    aria-hidden
                  >
                    <div
                      className="h-full bg-teal-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-on-surface text-right tabular-nums">
                    {r.count.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
