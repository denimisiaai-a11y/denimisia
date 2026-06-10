'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useId, useMemo, useState } from 'react';
import { adminFetch } from '@/lib/api';
import { EmptyState } from '@/components/admin-ui';

interface AnalyticsDashboard {
  readonly orders: {
    readonly total: number;
    readonly thisMonth: number;
    readonly lastMonth: number;
    readonly growth: number;
  };
  readonly revenue: {
    readonly total: number;
    readonly thisMonth: number;
  };
  readonly customers: {
    readonly total: number;
    readonly newThisMonth: number;
  };
  readonly products: {
    readonly total: number;
    readonly lowStock: number;
  };
}

const EM_DASH = '\u2014';

function formatBdt(amount: number): string {
  return new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

function formatGrowth(growth: number): { readonly text: string; readonly up: boolean } {
  const up = growth >= 0;
  const text = `${Math.abs(growth).toFixed(1)}%`;
  return { text, up };
}

interface SparklinePoint {
  readonly label: string;
  readonly value: number;
}

function buildSparkline(data: AnalyticsDashboard | null): readonly SparklinePoint[] {
  if (!data) return [];
  // We only have a reliable current-month revenue number. Deriving last-month
  // revenue by subtracting (total - thisMonth) is wrong for any store older
  // than two months. Show the single known datapoint instead of fabricating a
  // second one. See RevenueLine single-point handling below.
  const { thisMonth: revenueThisMonth } = data.revenue;
  return [{ label: 'This Month', value: revenueThisMonth }];
}

const RANGES: readonly { readonly label: string; readonly days: number }[] = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
];

interface CategoryPerformance {
  readonly id?: string;
  readonly name: string;
  readonly revenue?: number;
  readonly percent?: number;
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const gradientId = useId();

  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [endpointMissing, setEndpointMissing] = useState(false);
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [categories, setCategories] = useState<readonly CategoryPerformance[] | null>(null);
  const [categoriesAvailable, setCategoriesAvailable] = useState<boolean>(true);

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function fetchAnalytics(authToken: string) {
      setLoading(true);
      try {
        const raw = await adminFetch<AnalyticsDashboard>(
          `/analytics/dashboard?days=${rangeDays}`,
          authToken,
        );
        if (!active) return;
        setData(raw);
        setEndpointMissing(false);
      } catch {
        if (!active) return;
        setEndpointMissing(true);
        setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAnalytics(token);
    return () => {
      active = false;
    };
  }, [token, rangeDays]);

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function fetchCategories(authToken: string) {
      try {
        const raw = await adminFetch<readonly CategoryPerformance[] | { data?: readonly CategoryPerformance[] }>(
          `/categories?limit=5&sortBy=revenue`,
          authToken,
        );
        if (!active) return;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: readonly CategoryPerformance[] }).data)
            ? (raw as { data: readonly CategoryPerformance[] }).data
            : [];
        setCategories(list);
        setCategoriesAvailable(true);
      } catch {
        if (!active) return;
        setCategories(null);
        setCategoriesAvailable(false);
      }
    }

    fetchCategories(token);
    return () => {
      active = false;
    };
  }, [token]);

  const sparkline = useMemo(() => buildSparkline(data), [data]);

  const currentRangeLabel =
    RANGES.find((r) => r.days === rangeDays)?.label ?? `Last ${rangeDays} Days`;

  const exportReport = () => {
    if (!data) return;
    const rows: readonly (readonly [string, string])[] = [
      ['Metric', 'Value'],
      ['Range (days)', String(rangeDays)],
      ['Revenue (total)', String(data.revenue.total)],
      ['Revenue (this month)', String(data.revenue.thisMonth)],
      ['Orders (total)', String(data.orders.total)],
      ['Orders (this month)', String(data.orders.thisMonth)],
      ['Orders (last month)', String(data.orders.lastMonth)],
      ['Order growth (%)', String(data.orders.growth)],
      ['Customers (total)', String(data.customers.total)],
      ['Customers (new this month)', String(data.customers.newThisMonth)],
      ['Products (total)', String(data.products.total)],
      ['Products (low stock)', String(data.products.lowStock)],
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalRevenue = data ? `\BDT ${formatBdt(data.revenue.total)}` : EM_DASH;
  const monthRevenue = data ? `\BDT ${formatBdt(data.revenue.thisMonth)}` : EM_DASH;
  const avgOrderValue =
    data && data.orders.total > 0
      ? `\BDT ${formatBdt(Math.round(data.revenue.total / data.orders.total))}`
      : EM_DASH;
  const totalOrders = data ? formatCompact(data.orders.total) : EM_DASH;
  const totalCustomers = data ? formatCompact(data.customers.total) : EM_DASH;
  const newCustomers = data ? formatCompact(data.customers.newThisMonth) : EM_DASH;
  const lowStock = data ? formatCompact(data.products.lowStock) : EM_DASH;
  const ordersGrowth = data ? formatGrowth(data.orders.growth) : null;

  return (
    <div>
      {/* Page Header */}
      <div className="mb-12 flex items-end justify-between">
        <div>
          <h2 className="mb-2 font-headline text-4xl font-semibold uppercase tracking-tight text-on-surface">
            Advanced Analytics
          </h2>
          <p className="font-body text-sm font-light text-secondary">
            Comprehensive data overview for the current fiscal period
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="relative flex items-center gap-2 rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-xs font-semibold uppercase tracking-wider text-on-surface transition-colors duration-300 ease-editorial hover:bg-surface-container">
            <span className="material-symbols-outlined text-sm" aria-hidden>
              calendar_today
            </span>
            <span className="sr-only">{currentRangeLabel}</span>
            <select
              aria-label="Analytics range"
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="cursor-pointer appearance-none bg-transparent pr-4 text-xs font-semibold uppercase tracking-wider text-on-surface focus:outline-none"
            >
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={exportReport}
            disabled={!data}
            className="flex items-center gap-2 rounded-sm bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-wider text-on-primary transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export Report
          </button>
        </div>
      </div>

      {endpointMissing && (
        <div className="mb-8 rounded-sm border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-xs uppercase tracking-widest text-secondary">
          Analytics endpoint unavailable. Showing placeholders where data is missing.
        </div>
      )}

      {/* KPI Cards */}
      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={loading ? EM_DASH : totalRevenue}
          change={EM_DASH}
          changeUp
          muted
        />
        <KpiCard
          label="Avg. Order Value"
          value={loading ? EM_DASH : avgOrderValue}
          change={EM_DASH}
          changeUp
          muted
        />
        <KpiCard
          label="Total Orders"
          value={loading ? EM_DASH : totalOrders}
          change={ordersGrowth ? ordersGrowth.text : EM_DASH}
          changeUp={ordersGrowth?.up ?? true}
          muted={!ordersGrowth}
        />
        <KpiCard
          label="Total Customers"
          value={loading ? EM_DASH : totalCustomers}
          change={EM_DASH}
          changeUp
          muted
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Revenue Performance */}
        <div className="col-span-12 rounded-sm border border-outline-variant/30 bg-surface-container-lowest p-8 lg:col-span-8">
          <div className="mb-8 flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-[0.1em] text-on-surface">
              Revenue Performance
            </h4>
            <div className="flex gap-4">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-secondary">
                <span className="h-2 w-2 rounded-full bg-primary" /> This Month
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-secondary">
                <span className="h-2 w-2 rounded-full bg-outline-variant" /> Last Month
              </span>
            </div>
          </div>

          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-secondary">
                Revenue This Month
              </p>
              <p className="font-headline text-4xl font-semibold text-on-surface">
                {loading ? EM_DASH : monthRevenue}
              </p>
            </div>
            <div className="text-right">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-secondary">
                Revenue All-Time
              </p>
              <p className="font-headline text-2xl font-semibold text-on-surface">
                {loading ? EM_DASH : totalRevenue}
              </p>
            </div>
          </div>

          {/* Simple inline SVG line built from the two points we actually have */}
          <RevenueLine points={sparkline} gradientId={gradientId} />

          <div className="mt-10 grid grid-cols-3 gap-8 border-t border-outline-variant/20 pt-6">
            <MetricCell label="Peak Sales Day" value={EM_DASH} />
            <MetricCell
              label="Growth Forecast"
              value={ordersGrowth ? `${ordersGrowth.up ? '+' : '-'}${ordersGrowth.text}` : EM_DASH}
            />
            <MetricCell label="Market Volatility" value={EM_DASH} />
          </div>
        </div>

        {/* Customer Retention (mostly stubbed — we don't have retention data) */}
        <div className="col-span-12 flex flex-col rounded-sm border border-outline-variant/30 bg-surface-container-lowest p-8 lg:col-span-4">
          <h4 className="mb-8 text-sm font-bold uppercase tracking-[0.1em] text-on-surface">
            Customer Retention
          </h4>
          <div className="relative flex flex-1 flex-col items-center justify-center">
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full border-[12px] border-surface-container">
              <div className="text-center">
                <span className="font-headline text-4xl font-bold text-on-surface">
                  {EM_DASH}
                </span>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
                  Returning
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary">New This Month</span>
              <span className="font-bold text-on-surface">
                {loading ? EM_DASH : newCustomers}
              </span>
            </div>
            <div className="h-px bg-outline-variant/20" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-secondary">Churn Rate</span>
              <span className="font-bold text-primary">{EM_DASH}</span>
            </div>
          </div>
        </div>

        {/* Sales Conversion Funnel (mostly stubbed — we don't have funnel data) */}
        <div className="col-span-12 rounded-sm border border-outline-variant/30 bg-surface-container-lowest p-8 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-[0.1em] text-on-surface">
              Sales Conversion Funnel
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              Funnel data unavailable
            </span>
          </div>
          <div className="space-y-6">
            <FunnelRow label="Visitors" value={EM_DASH} percent={0} muted />
            <FunnelRow label="Product Views" value={EM_DASH} percent={0} muted />
            <FunnelRow label="Added to Cart" value={EM_DASH} percent={0} muted />
            <FunnelRow
              label="Purchased"
              value={EM_DASH}
              percent={0}
              muted
            />
          </div>
          <div className="mt-10 rounded-sm bg-surface-container-low p-4">
            <p className="text-[11px] font-light leading-relaxed text-on-surface">
              Funnel analytics are not yet wired to the API. Conversion rates
              will populate once visitor and cart events are tracked.
            </p>
          </div>
        </div>

        {/* Category Performance */}
        <div className="col-span-12 rounded-sm border border-outline-variant/30 bg-surface-container-lowest p-8 lg:col-span-7">
          <div className="mb-10 flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-[0.1em] text-on-surface">
              Category Performance
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              By Revenue
            </span>
          </div>
          {categoriesAvailable && categories && categories.length > 0 ? (
            <div className="space-y-6">
              {categories.map((cat) => {
                const maxRev = Math.max(
                  ...categories.map((c) => c.revenue ?? 0),
                  1,
                );
                const width =
                  typeof cat.percent === 'number'
                    ? cat.percent
                    : Math.round(((cat.revenue ?? 0) / maxRev) * 100);
                const percentLabel =
                  typeof cat.percent === 'number'
                    ? `${cat.percent.toFixed(0)}%`
                    : `${width}%`;
                return (
                  <CategoryRow
                    key={cat.id ?? cat.name}
                    label={cat.name}
                    percent={percentLabel}
                    width={width}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="category"
              label="Category performance coming soon"
              description="Revenue breakdown by category will appear once the categories analytics endpoint is available."
            />
          )}
        </div>
      </div>

      {/* Predictive Insights */}
      <section className="mt-12 rounded-sm bg-surface-container-high p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">lightbulb</span>
          <h4 className="text-sm font-bold uppercase tracking-[0.1em] text-on-surface">
            Operational Insights
          </h4>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <InsightItem
            icon="inventory_2"
            title="Low Stock Alert"
            body={
              data
                ? `${lowStock} product${data.products.lowStock === 1 ? '' : 's'} currently flagged as low stock. Review restock queue.`
                : 'Inventory data unavailable.'
            }
          />
          <InsightItem
            icon="trending_up"
            title="Order Growth"
            body={
              ordersGrowth
                ? `Orders ${ordersGrowth.up ? 'up' : 'down'} ${ordersGrowth.text} month-over-month (${data?.orders.thisMonth ?? 0} this month vs ${data?.orders.lastMonth ?? 0} last month).`
                : 'Order growth data unavailable.'
            }
          />
          <InsightItem
            icon="group_add"
            title="New Customers"
            body={
              data
                ? `${newCustomers} new customers joined this month out of ${totalCustomers} total.`
                : 'Customer acquisition data unavailable.'
            }
          />
        </div>
      </section>
    </div>
  );
}

interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly change: string;
  readonly changeUp: boolean;
  readonly muted?: boolean;
}

function KpiCard({ label, value, change, changeUp, muted }: KpiCardProps) {
  const changeColor = muted
    ? 'text-secondary'
    : changeUp
      ? 'text-emerald-600'
      : 'text-primary';
  const arrow = changeUp ? 'arrow_upward' : 'arrow_downward';
  return (
    <div className="rounded-sm border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
      <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
        {label}
      </p>
      <div className="flex items-end justify-between">
        <h3 className="font-headline text-2xl font-semibold text-on-surface">
          {value}
        </h3>
        <span className={`flex items-center text-xs font-bold ${changeColor}`}>
          {!muted && (
            <span className="material-symbols-outlined mr-1 text-sm">{arrow}</span>
          )}
          {change}
        </span>
      </div>
    </div>
  );
}

interface MetricCellProps {
  readonly label: string;
  readonly value: string;
}

function MetricCell({ label, value }: MetricCellProps) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
        {label}
      </p>
      <p className="font-headline text-lg font-semibold text-on-surface">{value}</p>
    </div>
  );
}

interface FunnelRowProps {
  readonly label: string;
  readonly value: string;
  readonly percent: number;
  readonly muted: boolean;
}

function FunnelRow({ label, value, percent, muted }: FunnelRowProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
          {label}
        </span>
        <span className="text-xs font-bold text-on-surface">{value}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-sm bg-surface-container">
        <div
          className={`h-full transition-all duration-700 ease-editorial ${muted ? 'bg-surface-container-high' : 'bg-primary'}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

interface CategoryRowProps {
  readonly label: string;
  readonly percent: string;
  readonly width: number;
}

function CategoryRow({ label, percent, width }: CategoryRowProps) {
  const clamped = Math.max(0, Math.min(100, width));
  return (
    <div className="group">
      <div className="mb-1 flex justify-between">
        <span className="text-[10px] font-bold uppercase text-on-surface">
          {label}
        </span>
        <span className="text-[10px] font-bold text-on-surface">{percent}</span>
      </div>
      <div className="h-1 w-full bg-surface-container">
        <div
          className="h-full bg-primary transition-all duration-700 ease-editorial"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

interface InsightItemProps {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
}

function InsightItem({ icon, title, body }: InsightItemProps) {
  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest">
        <span className="material-symbols-outlined text-sm">{icon}</span>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase text-on-surface">{title}</p>
        <p className="text-[11px] font-light leading-relaxed text-secondary">
          {body}
        </p>
      </div>
    </div>
  );
}

interface RevenueLineProps {
  readonly points: readonly SparklinePoint[];
  readonly gradientId: string;
}

function RevenueLine({ points, gradientId }: RevenueLineProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-sm bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-secondary">
        No data
      </div>
    );
  }

  const width = 800;
  const height = 200;
  const padding = 16;
  const max = Math.max(...points.map((p) => p.value), 1);

  // Single-point guard: render one dot at center instead of a zero-length path.
  if (points.length === 1) {
    const only = points[0]!;
    const cx = width / 2;
    const cy = height - padding - (only.value / max) * (height - padding * 2);
    return (
      <div className="relative h-48 w-full">
        <svg
          className="h-full w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${width} ${height}`}
        >
          <g className="text-primary">
            <circle cx={cx} cy={cy} r={6} fill="currentColor" />
          </g>
        </svg>
        <div className="absolute -bottom-6 left-0 right-0 flex justify-center text-[10px] font-bold uppercase tracking-widest text-secondary">
          <span>{only.label}</span>
        </div>
      </div>
    );
  }

  const stepX = (width - padding * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (p.value / max) * (height - padding * 2);
    return { x, y, ...p };
  });

  const pathD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');
  const areaD =
    `${pathD} L${coords[coords.length - 1]?.x.toFixed(1) ?? 0},${height - padding} ` +
    `L${coords[0]?.x.toFixed(1) ?? 0},${height - padding} Z`;

  return (
    <div className="relative h-48 w-full">
      <svg
        className="h-full w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-primary">
          <path d={areaD} fill={`url(#${gradientId})`} />
          <path
            d={pathD}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coords.map((c) => (
            <circle
              key={c.label}
              cx={c.x}
              cy={c.y}
              r={5}
              fill="currentColor"
            />
          ))}
        </g>
      </svg>
      <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-secondary">
        {coords.map((c) => (
          <span key={c.label}>{c.label}</span>
        ))}
      </div>
    </div>
  );
}
