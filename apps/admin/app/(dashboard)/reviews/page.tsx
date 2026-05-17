'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner, EmptyState } from '@/components/admin-ui';

function buildPageWindow(current: number, total: number, windowSize = 5): number[] {
  if (total <= 0) return [];
  if (total <= windowSize) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = Math.floor(windowSize / 2);
  let start = current - half;
  let end = current + half;
  if (start < 1) {
    start = 1;
    end = windowSize;
  }
  if (end > total) {
    end = total;
    start = total - windowSize + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

interface ReviewUser {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

interface ReviewProduct {
  name?: string | null;
  slug?: string | null;
}

interface Review {
  id: string;
  rating: number;
  title?: string | null;
  body: string;
  images?: string[];
  isVerified: boolean;
  helpfulCount: number;
  createdAt: string;
  user?: ReviewUser | null;
  product?: ReviewProduct | null;
  productId?: string;
  userId?: string;
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
}

type RatingFilter = 'ALL' | '5' | '4' | '3';
type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED';

interface ReviewsStats {
  readonly sentimentIndex?: number;
  readonly averageRating?: number;
  readonly pending?: number;
  readonly pendingCount?: number;
  readonly total?: number;
}

const PAGE_LIMIT = 10;

function getCustomerName(user?: ReviewUser | null): string {
  if (!user) return 'Anonymous';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || 'Anonymous';
}

function getProductName(product?: ReviewProduct | null): string {
  return product?.name ?? 'Unknown Product';
}

function getProductInitials(product?: ReviewProduct | null): string {
  const name = product?.name ?? '';
  if (!name) return 'IMG';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d
      .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      .toUpperCase();
  } catch {
    return '—';
  }
}

interface StarsProps {
  rating: number;
}

function Stars({ rating }: StarsProps) {
  return (
    <div className="flex text-primary">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="material-symbols-outlined text-sm"
          style={i <= rating ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          star
        </span>
      ))}
    </div>
  );
}

interface StatusPillProps {
  verified: boolean;
}

function StatusPill({ verified }: StatusPillProps) {
  if (verified) {
    return (
      <span className="inline-block px-2 py-1 bg-surface-container-high text-secondary text-[10px] font-bold uppercase tracking-wider">
        Approved
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-1 bg-surface-container text-on-surface text-[10px] font-bold uppercase tracking-wider">
      Pending
    </span>
  );
}

export default function ReviewsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [stats, setStats] = useState<ReviewsStats | null>(null);
  const [statsAvailable, setStatsAvailable] = useState<boolean>(true);

  const fetchReviews = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      });
      if (ratingFilter !== 'ALL') {
        qs.set('rating', ratingFilter);
      }
      if (statusFilter !== 'ALL') {
        qs.set('status', statusFilter);
      }
      const data = await adminFetch<ReviewsResponse>(
        `/reviews/admin/all?${qs.toString()}`,
        token,
      );
      setReviews(data.reviews ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
      setReviews([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, page, ratingFilter, statusFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function fetchStats(authToken: string) {
      try {
        const raw = await adminFetch<ReviewsStats>(`/reviews/stats`, authToken);
        if (!active) return;
        setStats(raw);
        setStatsAvailable(true);
      } catch {
        if (!active) return;
        setStats(null);
        setStatsAvailable(false);
      }
    }
    fetchStats(token);
    return () => {
      active = false;
    };
  }, [token]);

  // Reset page when filter changes so we don't query past the end of a smaller
  // result set.
  useEffect(() => {
    setPage(1);
  }, [ratingFilter, statusFilter]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!token) return;
      if (!window.confirm('Hide this review? This removes it permanently.')) return;
      setActionId(id);
      try {
        await adminFetch<void>(`/reviews/admin/${id}`, token, { method: 'DELETE' });
        await fetchReviews();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to remove review');
      } finally {
        setActionId(null);
      }
    },
    [token, fetchReviews],
  );

  // The rating filter is now server-driven, so the API returns the already
  // filtered rows. We render `reviews` directly.
  const filteredReviews = reviews;

  const pageSentiment = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / reviews.length;
  }, [reviews]);

  const pagePending = useMemo(
    () => reviews.filter((r) => !r.isVerified).length,
    [reviews],
  );

  const sentimentIndex = statsAvailable
    ? (stats?.sentimentIndex ?? stats?.averageRating ?? null)
    : pageSentiment;
  const pendingCount = statsAvailable
    ? (stats?.pendingCount ?? stats?.pending ?? pagePending)
    : pagePending;
  const sentimentLabelSuffix = statsAvailable ? 'Store average' : 'This page';

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const rangeEnd = Math.min(page * PAGE_LIMIT, total);

  const ratingChips: RatingFilter[] = ['ALL', '5', '4', '3'];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-12 flex justify-between items-end flex-wrap gap-6">
        <div>
          <h2 className="font-headline text-4xl font-semibold tracking-tight text-on-surface uppercase">
            Customer Feedback
          </h2>
          <p className="text-secondary mt-2 text-sm max-w-lg">
            Manage and curate product experiences. Every review is a thread in the Denimisia story.
          </p>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          <div className="flex items-center bg-surface-container-high px-4 py-2 rounded-sm space-x-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-secondary">
              Rating
            </span>
            <div className="flex space-x-1">
              {ratingChips.map((chip) => {
                const active = ratingFilter === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setRatingFilter(chip)}
                    className={
                      active
                        ? 'w-8 h-8 flex items-center justify-center bg-inverse-surface text-inverse-on-surface text-xs font-bold'
                        : 'w-8 h-8 flex items-center justify-center hover:bg-surface-container transition-colors text-xs text-secondary font-bold'
                    }
                  >
                    {chip === 'ALL' ? 'ALL' : `${chip}\u2605`}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStatusMenu((v) => !v)}
              aria-expanded={showStatusMenu}
              aria-haspopup="menu"
              className="flex items-center px-4 py-2 bg-surface-container-lowest border border-outline-variant/40 text-xs font-semibold uppercase tracking-widest text-secondary hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-sm mr-2">filter_list</span>
              {statusFilter === 'ALL' ? 'Filter Status' : statusFilter}
            </button>
            {showStatusMenu && (
              <div
                role="menu"
                className="absolute right-0 mt-2 z-10 min-w-[160px] rounded-sm border border-outline-variant/30 bg-surface-container-lowest shadow-lg"
              >
                {(['ALL', 'PENDING', 'APPROVED'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setStatusFilter(s);
                      setShowStatusMenu(false);
                    }}
                    className={
                      'block w-full px-4 py-2 text-left text-xs font-semibold uppercase tracking-widest transition-colors hover:bg-surface-container ' +
                      (statusFilter === s ? 'bg-surface-container text-on-surface' : 'text-secondary')
                    }
                  >
                    {s === 'ALL' ? 'All' : s === 'PENDING' ? 'Pending' : 'Approved'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <Banner tone="error" message={error} />}

      {/* Editorial Table */}
      <div id="reviews-table" className="bg-surface-container-lowest overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/30">
                <th className="py-5 px-6 font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Product
                </th>
                <th className="py-5 px-6 font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Customer
                </th>
                <th className="py-5 px-6 font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Rating
                </th>
                <th className="py-5 px-6 font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-secondary w-1/3">
                  Comment
                </th>
                <th className="py-5 px-6 font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Date
                </th>
                <th className="py-5 px-6 font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  Status
                </th>
                <th className="py-5 px-6 font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-secondary text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 px-6 text-center text-secondary text-sm font-headline uppercase tracking-widest"
                  >
                    Loading reviews…
                  </td>
                </tr>
              ) : filteredReviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-20 px-6 text-center text-secondary text-sm font-headline uppercase tracking-widest"
                  >
                    {reviews.length === 0
                      ? 'No reviews yet. The atelier awaits its first voice.'
                      : 'No reviews match the current filter.'}
                  </td>
                </tr>
              ) : (
                filteredReviews.map((review) => {
                  const isBusy = actionId === review.id;
                  return (
                    <tr
                      key={review.id}
                      className="group hover:bg-surface-container-low/50 transition-colors"
                    >
                      {/* Product */}
                      <td className="py-6 px-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-20 overflow-hidden rounded-sm bg-surface-container-high flex items-center justify-center">
                            <span className="text-[10px] font-headline font-bold uppercase tracking-widest text-secondary">
                              {getProductInitials(review.product)}
                            </span>
                          </div>
                          <span className="text-sm font-semibold tracking-wide text-on-surface uppercase">
                            {getProductName(review.product)}
                          </span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-6 px-6">
                        <span className="text-sm font-medium text-on-surface">
                          {getCustomerName(review.user)}
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="py-6 px-6">
                        <Stars rating={review.rating} />
                      </td>

                      {/* Comment */}
                      <td className="py-6 px-6">
                        {review.title && (
                          <p className="text-xs font-bold uppercase tracking-wider text-on-surface mb-1">
                            {review.title}
                          </p>
                        )}
                        <p className="text-sm text-secondary line-clamp-2 leading-relaxed">
                          {review.body}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="py-6 px-6">
                        <span className="text-xs text-secondary font-mono">
                          {formatDate(review.createdAt)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-6 px-6">
                        <StatusPill verified={review.isVerified} />
                      </td>

                      {/* Actions */}
                      <td className="py-6 px-6 text-right">
                        <div className="flex justify-end space-x-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDelete(review.id)}
                            className="p-2 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Hide (remove) review"
                          >
                            <span className="material-symbols-outlined">visibility_off</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination / Footer */}
        <div className="p-6 bg-surface-container-low flex justify-between items-center flex-wrap gap-4">
          <p className="text-[10px] font-headline font-bold text-secondary uppercase tracking-widest">
            Showing {rangeStart}-{rangeEnd} of {total} reviews
          </p>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="w-10 h-10 flex items-center justify-center border border-outline-variant/40 hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            {buildPageWindow(page, totalPages).map((n) => {
              const active = n === page;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'w-10 h-10 flex items-center justify-center bg-inverse-surface text-inverse-on-surface font-bold text-xs'
                      : 'w-10 h-10 flex items-center justify-center hover:bg-surface-container transition-colors text-xs font-bold text-on-surface'
                  }
                >
                  {n}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="w-10 h-10 flex items-center justify-center border border-outline-variant/40 hover:bg-surface-container transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Insights Bento Grid */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-8 bg-surface-container-lowest border-l-4 border-primary">
          <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4">
            Sentiment Index
          </h4>
          <div className="flex items-end space-x-4">
            <span className="text-4xl font-headline font-semibold text-on-surface">
              {sentimentIndex === null || sentimentIndex === undefined
                ? '—'
                : sentimentIndex.toFixed(1)}
            </span>
            <span className="text-xs text-secondary font-bold mb-1">
              {sentimentLabelSuffix}
            </span>
          </div>
          <div className="mt-4 h-1 w-full bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{
                width:
                  sentimentIndex === null || sentimentIndex === undefined
                    ? '0%'
                    : `${(sentimentIndex / 5) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="p-8 bg-surface-container-lowest">
          <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4">
            Pending Approval
          </h4>
          <div className="flex items-end space-x-4">
            <span className="text-4xl font-headline font-semibold text-on-surface">
              {pendingCount}
            </span>
            <span className="text-xs text-secondary font-bold mb-1">
              {pendingCount === 0 ? 'All caught up' : 'Requires attention'}
            </span>
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                setRatingFilter('ALL');
                setStatusFilter('PENDING');
                setPage(1);
                if (typeof document !== 'undefined') {
                  document
                    .getElementById('reviews-table')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline transition-all"
            >
              Review Queue Now →
            </button>
          </div>
        </div>

        <div className="p-8 bg-surface-container-lowest">
          <EmptyState
            icon="public"
            label="Global reach data coming soon"
            description="Country-level review distribution will appear once geography tracking is enabled."
          />
        </div>
      </div>
    </div>
  );
}
