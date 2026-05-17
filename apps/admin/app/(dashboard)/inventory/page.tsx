'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  EmptyState,
  SkeletonList,
  StatusChip,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';

interface InventorySummary {
  readonly totalVariants: number;
  readonly lowStock: number;
  readonly outOfStock: number;
}

interface LowStockVariant {
  readonly id: string;
  readonly sku: string;
  readonly size: string;
  readonly color: string;
  readonly stock: number;
  readonly images: readonly string[];
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly images: readonly string[];
  };
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [lowStock, setLowStock] = useState<readonly LowStockVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [sum, low] = await Promise.all([
        adminFetch<InventorySummary>('/inventory/summary', token),
        adminFetch<LowStockVariant[]>('/inventory/low-stock?threshold=5', token),
      ]);
      setSummary(sum);
      setLowStock(low);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell
      title="Inventory"
      description="Stock across the atelier floor — what's full, low, and gone."
      breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock' }]}
    >
      {error && <Banner tone="error" message={error} />}

      <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StockStat
          icon="inventory_2"
          label="Total Variants"
          value={summary?.totalVariants}
          loading={loading}
        />
        <StockStat
          icon="hourglass_bottom"
          label="Low Stock"
          value={summary?.lowStock}
          loading={loading}
          tone="warning"
        />
        <StockStat
          icon="error"
          label="Out of Stock"
          value={summary?.outOfStock}
          loading={loading}
          tone="danger"
        />
      </section>

      <SurfaceCard>
        <SurfaceHeader>
          {loading ? 'Loading…' : `${lowStock.length} variants below threshold`}
        </SurfaceHeader>

        {loading ? (
          <SkeletonList rowHeight={72} />
        ) : lowStock.length === 0 ? (
          <EmptyState
            icon="check_circle"
            label="All stock healthy"
            description="No variants below the threshold right now."
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {lowStock.map((v) => {
              const img = v.images[0] ?? v.product.images[0];
              return (
                <li key={v.id}>
                  <Link
                    href={`/products/${v.product.id}`}
                    className="flex items-center justify-between px-6 py-4 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden bg-surface-container">
                        {img ? (
                          <Image
                            src={img}
                            alt={v.product.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined flex h-full items-center justify-center text-secondary">
                            inventory_2
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-body text-sm font-semibold text-on-surface">
                          {v.product.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
                          {v.sku} · {v.color} · {v.size}
                        </p>
                      </div>
                    </div>
                    <StatusChip
                      label={v.stock === 0 ? 'Out of stock' : `${v.stock} left`}
                      tone={v.stock === 0 ? 'danger' : 'warning'}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SurfaceCard>
    </PageShell>
  );
}

interface StockStatProps {
  readonly icon: string;
  readonly label: string;
  readonly value?: number;
  readonly loading: boolean;
  readonly tone?: 'default' | 'warning' | 'danger';
}

function StockStat({ icon, label, value, loading, tone = 'default' }: StockStatProps) {
  const valueColor =
    tone === 'danger'
      ? 'text-[#c62828] dark:text-[#ff8a80]'
      : tone === 'warning'
        ? 'text-[#d97706]'
        : 'text-on-surface';
  return (
    <div className="atelier-shadow bg-surface-container-lowest p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            {label}
          </p>
          {loading ? (
            <div className="mt-3 h-9 w-20 animate-pulse bg-surface-container-low" />
          ) : (
            <p className={'mt-3 font-headline text-3xl font-semibold ' + valueColor}>
              {value?.toLocaleString() ?? '—'}
            </p>
          )}
        </div>
        <span className="material-symbols-outlined text-secondary" aria-hidden>
          {icon}
        </span>
      </div>
    </div>
  );
}
