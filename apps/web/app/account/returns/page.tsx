'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import {
  getMyReturns,
  SessionExpiredError,
  type ReturnRecord,
  type ReturnReason,
  type ReturnStatus,
} from '@/lib/api';
import { formatPrice } from '@/lib/utils';

const REASON_LABEL: Record<ReturnReason, string> = {
  DEFECTIVE: 'Defective product',
  DAMAGED_IN_TRANSIT: 'Damaged in transit',
  NOT_AS_DESCRIBED: 'Not as described',
  WRONG_ITEM_SENT: 'Wrong item sent',
  WRONG_SIZE: 'Wrong size',
  CHANGED_MIND: 'Changed mind',
};

const STATUS_LABEL: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IN_TRANSIT: 'In transit',
  RECEIVED: 'Received',
  INSPECTING: 'Inspecting',
  INSPECTED_PASS: 'Inspection passed',
  INSPECTED_FAIL: 'Inspection failed',
  RETURNED_TO_CUSTOMER: 'Returned to you',
  REFUNDED: 'Refunded',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const STATUS_BADGE: Record<ReturnStatus, string> = {
  REQUESTED: 'bg-warning/10 text-warning',
  UNDER_REVIEW: 'bg-warning/10 text-warning',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-error/10 text-error',
  IN_TRANSIT: 'bg-ink/10 text-ink',
  RECEIVED: 'bg-ink/10 text-ink',
  INSPECTING: 'bg-ink/10 text-ink',
  INSPECTED_PASS: 'bg-success/10 text-success',
  INSPECTED_FAIL: 'bg-error/10 text-error',
  RETURNED_TO_CUSTOMER: 'bg-muted-bg text-muted',
  REFUNDED: 'bg-success/10 text-success',
  CLOSED: 'bg-muted-bg text-muted',
  CANCELLED: 'bg-error/10 text-error',
};

export default function AccountReturnsPage() {
  // Note: the parent `/account` layout already auth-gates server-side
  // (redirects to /login). This client component just consumes the
  // session that NextAuth's SessionProvider exposes.
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [returns, setReturns] = useState<ReturnRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getMyReturns(accessToken);
        if (!cancelled) setReturns(list);
      } catch (err: unknown) {
        if (cancelled) return;
        // Stale API JWT — clear the session and re-login instead of showing
        // a raw "Unauthorized" error with no recovery path.
        if (err instanceof SessionExpiredError) {
          window.location.href = '/api/auth/expire';
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't load your returns right now. Please refresh or try again shortly.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, accessToken]);

  if (status === 'loading' || (returns === null && !error)) {
    return (
      <div>
        <h2 className="mb-6 text-lg font-medium uppercase tracking-[0.1em] text-ink">
          Returns
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your returns...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-6 text-lg font-medium uppercase tracking-[0.1em] text-ink">
          Returns
        </h2>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (!returns || returns.length === 0) {
    return (
      <div>
        <h2 className="mb-6 text-lg font-medium uppercase tracking-[0.1em] text-ink">
          Returns
        </h2>
        <div className="rounded-sm border border-border p-8 text-center">
          <p className="text-sm text-muted">
            You haven&apos;t requested any returns yet.
          </p>
          <Link
            href="/returns/new"
            className="mt-4 inline-flex items-center justify-center rounded-sm border border-ink bg-ink px-5 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-paper transition hover:opacity-90"
          >
            Start a return
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium uppercase tracking-[0.1em] text-ink">
          Returns
        </h2>
        <Link
          href="/returns/new"
          className="text-xs font-semibold uppercase tracking-[0.1em] text-ink underline underline-offset-4 hover:opacity-70"
        >
          New return
        </Link>
      </div>

      <div className="space-y-4">
        {returns.map((r) => {
          const itemCount = r.items.reduce((sum, i) => sum + i.quantity, 0);
          return (
            <Link
              key={r.id}
              href={`/returns/${r.rtnNumber}`}
              className="block border border-border p-5 transition-colors hover:border-ink"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{r.rtnNumber}</p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(r.requestedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    • {REASON_LABEL[r.reason]}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] ${
                      STATUS_BADGE[r.status]
                    }`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                  {r.refundAmount && (
                    <span className="text-sm font-medium text-ink">
                      {formatPrice(Number(r.refundAmount))}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
