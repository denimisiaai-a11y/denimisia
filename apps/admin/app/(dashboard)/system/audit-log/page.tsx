'use client';

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

interface AuditLog {
  readonly id: string;
  readonly userId: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string | null;
  readonly details: unknown;
  readonly createdAt: string;
  // Nullable: guest-checkout flows emit rows with userId = null because no
  // authenticated actor exists (see schema.prisma AuditLog comment).
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string;
  } | null;
}

interface LogsResponse {
  readonly logs: readonly AuditLog[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

function actionTone(action: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const lower = action.toLowerCase();
  if (lower.includes('delete') || lower.includes('remove')) return 'danger';
  if (lower.includes('create') || lower.includes('add')) return 'success';
  if (lower.includes('update') || lower.includes('edit')) return 'warning';
  if (lower.includes('login') || lower.includes('auth')) return 'info';
  return 'neutral';
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  // Pass undefined so the browser's default locale is used.
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [logs, setLogs] = useState<readonly AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = 30;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (entityFilter) q.set('entity', entityFilter);
      const data = await adminFetch<LogsResponse>(`/audit-log?${q}`, token);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [token, page, entityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <PageShell
      title="Audit Log"
      description="An immutable record of every privileged action across the atelier."
      breadcrumbs={[{ label: 'System' }, { label: 'Audit Log' }]}
      actions={
        <>
          <label className="sr-only" htmlFor="entity-filter">
            Entity
          </label>
          <select
            id="entity-filter"
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            className="atelier-shadow-sm border-0 bg-surface-container-lowest px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface focus:outline-none"
          >
            <option value="">All Entities</option>
            <option value="Product">Products</option>
            <option value="Order">Orders</option>
            <option value="User">Users</option>
            <option value="Category">Categories</option>
            <option value="Campaign">Campaigns</option>
            <option value="Discount">Discounts</option>
          </select>
        </>
      }
    >
      {error && <Banner tone="error" message={error} />}

      <SurfaceCard>
        <SurfaceHeader>
          {loading
            ? 'Loading…'
            : `${total.toLocaleString()} total entries · page ${page} of ${totalPages}`}
        </SurfaceHeader>

        {loading ? (
          <SkeletonList rowHeight={64} rows={8} />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="history"
            label="No audit entries"
            description="Privileged actions will be recorded here as they happen."
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-start justify-between gap-6 px-6 py-4 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
              >
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <span
                    className="material-symbols-outlined mt-0.5 text-secondary"
                    aria-hidden
                  >
                    history
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip label={log.action} tone={actionTone(log.action)} />
                      <span className="font-mono text-[11px] text-secondary">
                        {log.entity}
                        {log.entityId ? `:${log.entityId.slice(-6)}` : ''}
                      </span>
                    </div>
                    <p className="mt-1.5 font-body text-sm text-on-surface">
                      {log.user ? (
                        <>
                          <span className="font-semibold">
                            {log.user.firstName} {log.user.lastName}
                          </span>{' '}
                          <span className="text-secondary">({log.user.email})</span>
                        </>
                      ) : (
                        <span className="italic text-secondary">guest checkout</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-secondary whitespace-nowrap">
                  {formatTimestamp(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-outline-variant/15 px-6 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border border-outline-variant/30 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 ease-editorial hover:border-on-surface hover:text-on-surface disabled:opacity-40 disabled:hover:border-outline-variant/30 disabled:hover:text-secondary"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border border-outline-variant/30 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 ease-editorial hover:border-on-surface hover:text-on-surface disabled:opacity-40 disabled:hover:border-outline-variant/30 disabled:hover:text-secondary"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SurfaceCard>
    </PageShell>
  );
}
