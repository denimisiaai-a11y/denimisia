'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { MetricCard } from './_components/dashboard/metric-card';
import { SalesChart } from './_components/dashboard/sales-chart';
import { DateRangePicker } from './_components/dashboard/date-range-picker';
import { SectionCard } from './_components/dashboard/section-card';
import { TopCategoriesList } from './_components/dashboard/top-categories';
import { TopProductsList } from './_components/dashboard/top-products';
import { TopCustomersList } from './_components/dashboard/top-customers';
import { LatestOrdersTable } from './_components/dashboard/latest-orders';
import { StockThresholdList } from './_components/dashboard/stock-threshold';
import { FitDataCoverageCard } from './_components/dashboard/fit-data-coverage-card';

interface DashboardOverview {
  readonly range: { readonly from: string; readonly to: string };
  readonly orders: {
    readonly total: number;
    readonly completed: number;
    readonly processing: number;
    readonly cancelled: number;
    readonly refunded: number;
    readonly other: number;
  };
  readonly sales: { readonly total: number; readonly average: number };
  readonly customers: { readonly total: number; readonly online: number };
}

interface SalesPoint {
  readonly date: string;
  readonly orders: number;
  readonly customers: number;
  readonly revenue: number;
}

interface TopCategory {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly productCount: number;
  readonly totalSales: number;
  readonly totalRevenue: number;
}

interface TopProduct {
  readonly product:
    | {
        readonly id: string;
        readonly name: string;
        readonly slug: string;
        readonly images: readonly string[];
      }
    | undefined;
  readonly totalSold: number;
  readonly totalRevenue: number;
}

interface TopCustomer {
  readonly user:
    | { readonly id: string; readonly name: string; readonly email: string }
    | null;
  readonly orderCount: number;
  readonly totalRevenue: number;
}

interface LatestOrder {
  readonly id: string;
  readonly status: string;
  readonly total: number;
  readonly createdAt: string;
  readonly customer: string;
  readonly email: string;
}

interface StockItem {
  readonly variantId: string;
  readonly sku: string;
  readonly size: string;
  readonly color: string;
  readonly stock: number;
  readonly image: string | null;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly images: readonly string[];
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [from, setFrom] = useState(() => daysAgoIso(29));
  const [to, setTo] = useState(() => todayIso());

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [series, setSeries] = useState<readonly SalesPoint[]>([]);
  const [topCategories, setTopCategories] = useState<readonly TopCategory[]>([]);
  const [topProducts, setTopProducts] = useState<readonly TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<readonly TopCustomer[]>([]);
  const [latestOrders, setLatestOrders] = useState<readonly LatestOrder[]>([]);
  const [stock, setStock] = useState<readonly StockItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const q = `from=${from}&to=${to}`;
    try {
      const [ov, ser, cats, prods, custs, latest, low] = await Promise.all([
        adminFetch<DashboardOverview>(`/analytics/dashboard/overview?${q}`, token),
        adminFetch<SalesPoint[]>(`/analytics/sales-series?${q}`, token),
        adminFetch<TopCategory[]>(`/analytics/top-categories?limit=5&${q}`, token),
        adminFetch<TopProduct[]>(`/analytics/top-products?limit=5&${q}`, token),
        adminFetch<TopCustomer[]>(`/analytics/top-customers?limit=5&${q}`, token),
        adminFetch<LatestOrder[]>(`/analytics/latest-orders?limit=5`, token),
        adminFetch<StockItem[]>(`/analytics/low-stock?limit=5`, token),
      ]);
      setOverview(ov);
      setSeries(ser);
      setTopCategories(cats);
      setTopProducts(prods);
      setTopCustomers(custs);
      setLatestOrders(latest);
      setStock(low);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const metrics = useMemo(() => {
    const o = overview?.orders;
    const s = overview?.sales;
    const c = overview?.customers;
    return [
      {
        label: 'Total Orders',
        value: o ? formatNumber(o.total) : '—',
        icon: 'shopping_cart',
      },
      {
        label: 'Total Completed Orders',
        value: o ? formatNumber(o.completed) : '—',
        icon: 'check_circle',
      },
      {
        label: 'Total Processing Orders',
        value: o ? formatNumber(o.processing) : '—',
        icon: 'hourglass_empty',
      },
      {
        label: 'Total Other Orders',
        value: o ? formatNumber(o.other + o.cancelled + o.refunded) : '—',
        icon: 'more_horiz',
      },
      {
        label: 'Total Sales',
        value: s ? formatCurrency(s.total) : '—',
        icon: 'payments',
        valuePrefix: 'BDT ',
      },
      {
        label: 'Average Order Sales',
        value: s ? formatCurrency(s.average) : '—',
        icon: 'receipt_long',
        valuePrefix: 'BDT ',
      },
      {
        label: 'Total Customers',
        value: c ? formatNumber(c.total) : '—',
        icon: 'groups',
      },
      {
        label: 'People Online',
        value: c ? String(c.online) : '—',
        icon: 'wifi_tethering',
      },
    ];
  }, [overview]);

  const rangeLabel = useMemo(() => {
    const fromMs = new Date(from + 'T00:00:00').getTime();
    const toMs = new Date(to + 'T00:00:00').getTime();
    const days = Math.max(1, Math.round((toMs - fromMs) / 86_400_000) + 1);
    if (days <= 7) return 'Weekly';
    if (days <= 31) return 'Monthly';
    if (days <= 92) return 'Quarterly';
    if (days <= 366) return 'Yearly';
    return 'Range';
  }, [from, to]);

  return (
    <div>
      <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Dashboard
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Atelier overview — performance, inventory, and intent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            from={from}
            to={to}
            onApply={(f, t) => {
              setFrom(f);
              setTo(t);
            }}
          />
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            aria-label="Refresh dashboard"
            className="atelier-shadow-sm flex h-10 w-10 items-center justify-center bg-inverse-surface text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.04] disabled:opacity-50"
          >
            <span
              className={
                'material-symbols-outlined text-base ' + (loading ? 'animate-spin' : '')
              }
              aria-hidden
            >
              refresh
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-8 border border-primary/30 bg-surface-container-low px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary" aria-hidden>
              error
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Analytics Error
              </p>
              <p className="mt-1 font-body text-sm text-on-surface">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 8 metric cards */}
      <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {loading && !overview
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-[120px] animate-pulse bg-surface-container-low"
              />
            ))
          : metrics.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value}
                icon={m.icon}
                valuePrefix={m.valuePrefix}
              />
            ))}
      </section>

      {/* Sales chart + top categories */}
      <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          icon="bar_chart"
          title="Sales Analytics"
          action={
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-secondary">
              {new Date(from + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}{' '}
              —{' '}
              {new Date(to + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          }
        >
          <SalesChart data={series} rangeLabel={rangeLabel} />
        </SectionCard>

        <SectionCard icon="format_list_numbered" title="Top Performing Categories">
          <TopCategoriesList rows={topCategories} />
        </SectionCard>
      </section>

      {/* Top products + top customers */}
      <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard icon="shopping_bag" title="Top Selling Products">
          <TopProductsList rows={topProducts} />
        </SectionCard>

        <SectionCard icon="workspace_premium" title="Customers with Most Sales">
          <TopCustomersList rows={topCustomers} />
        </SectionCard>
      </section>

      {/* Latest orders + stock threshold */}
      <section className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          icon="receipt_long"
          title="Latest Orders"
        >
          <LatestOrdersTable rows={latestOrders} />
        </SectionCard>

        <SectionCard icon="warning" title="Stock Threshold">
          <StockThresholdList rows={stock} />
        </SectionCard>
      </section>

      {/* Bot fit-data coverage — flags products that the product-finder can't
          serve because Type / attribute tags / size charts are missing. */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FitDataCoverageCard token={token} />
      </section>
    </div>
  );
}
