'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  EmptyState,
  SkeletonList,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';
import { MetricCard } from '../_components/dashboard/metric-card';

interface Overview {
  readonly orders: {
    readonly total: number;
    readonly completed: number;
    readonly cancelled: number;
    readonly refunded: number;
  };
  readonly sales: { readonly total: number; readonly average: number };
}

interface DailyPoint {
  readonly date: string;
  readonly orders: number;
  readonly revenue: number;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const RANGES = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '1 Year', days: 365 },
] as const;

// Bangladesh standard VAT rate.
const BD_VAT_RATE = 0.15;

export default function AccountingPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [activeRange, setActiveRange] = useState<number>(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<readonly DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    const from = daysAgoIso(activeRange);
    const to = daysAgoIso(0);
    const q = `from=${from}&to=${to}`;
    try {
      const [ov, ser] = await Promise.all([
        adminFetch<Overview>(`/analytics/dashboard/overview?${q}`, token),
        adminFetch<DailyPoint[]>(`/analytics/sales-series?${q}`, token),
      ]);
      setOverview(ov);
      setSeries(ser);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounting data');
    } finally {
      setLoading(false);
    }
  }, [token, activeRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const gross = overview?.sales.total ?? 0;
  const estimatedTax = gross * BD_VAT_RATE;
  const netAfterTax = gross - estimatedTax;
  const refundedCount = overview?.orders.refunded ?? 0;
  const cancelledCount = overview?.orders.cancelled ?? 0;
  const reversedSeries = useMemo(() => [...series].reverse(), [series]);

  return (
    <PageShell
      title="Accounting"
      description="Revenue, tax reserve, and refund exposure — read-only for now."
      breadcrumbs={[{ label: 'Accounting' }]}
      actions={
        <div className="atelier-shadow-sm flex overflow-hidden bg-surface-container-lowest">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setActiveRange(r.days)}
              className={
                'px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-300 ease-editorial ' +
                (activeRange === r.days
                  ? 'bg-inverse-surface text-inverse-on-surface'
                  : 'text-secondary hover:text-on-surface')
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      {error && <Banner tone="error" message={error} />}

      <section className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {loading && !overview ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="h-[120px] animate-pulse bg-surface-container-low"
            />
          ))
        ) : (
          <>
            <MetricCard
              label="Gross Revenue"
              value={formatCurrency(gross)}
              valuePrefix="BDT "
              icon="payments"
            />
            <MetricCard
              label="Estimated VAT (15%)"
              value={formatCurrency(estimatedTax)}
              valuePrefix="BDT "
              icon="receipt_long"
            />
            <MetricCard
              label="Net After Tax"
              value={formatCurrency(netAfterTax)}
              valuePrefix="BDT "
              icon="account_balance"
            />
            <MetricCard
              label="Avg Order Value"
              value={formatCurrency(overview?.sales.average ?? 0)}
              valuePrefix="BDT "
              icon="calculate"
            />
          </>
        )}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <MetricCard
          label="Completed Orders"
          value={(overview?.orders.completed ?? 0).toLocaleString()}
          icon="check_circle"
        />
        <MetricCard
          label="Cancelled"
          value={cancelledCount.toLocaleString()}
          icon="cancel"
        />
        <MetricCard
          label="Refunded"
          value={refundedCount.toLocaleString()}
          icon="currency_exchange"
        />
      </section>

      <SurfaceCard>
        <SurfaceHeader>
          {loading ? 'Loading…' : `Daily Ledger · ${series.length} days`}
        </SurfaceHeader>

        {loading ? (
          <SkeletonList rowHeight={48} rows={8} />
        ) : series.length === 0 ? (
          <EmptyState
            icon="account_balance"
            label="No ledger entries"
            description="Revenue will show here once orders come in."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/15 bg-surface-container-low/40">
                  <Th>Date</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Gross BDT </Th>
                  <Th className="text-right">VAT Reserve BDT </Th>
                  <Th className="text-right">Net BDT </Th>
                </tr>
              </thead>
              <tbody>
                {reversedSeries.map((p) => {
                  const vat = p.revenue * BD_VAT_RATE;
                  return (
                    <tr
                      key={p.date}
                      className="border-b border-outline-variant/10 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
                    >
                      <Td>
                        <span className="font-mono text-xs text-on-surface">{p.date}</span>
                      </Td>
                      <Td className="text-right">
                        <span className="font-body text-xs text-on-surface">
                          {p.orders}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <span className="font-body text-xs font-semibold text-on-surface">
                          {formatCurrency(p.revenue)}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <span className="font-body text-xs text-secondary">
                          {formatCurrency(vat)}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <span className="font-body text-xs font-semibold text-on-surface">
                          {formatCurrency(p.revenue - vat)}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </PageShell>
  );
}

function Th({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return (
    <th
      className={
        'px-6 py-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-secondary ' +
        (className ?? '')
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return <td className={'px-6 py-3 ' + (className ?? '')}>{children}</td>;
}
