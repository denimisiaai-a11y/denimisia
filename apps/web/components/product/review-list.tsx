'use client';

import { useEffect, useState, useCallback } from 'react';
import { StarRating } from '@/components/ui/star-rating';
import {
  fallbackReviewsForProduct,
  fallbackRatingBreakdown,
  shouldUsePlaceholderReviews,
} from '@/lib/placeholder-reviews';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  isVerified: boolean;
  helpfulCount: number;
  user: { firstName: string; lastName: string };
  createdAt: string;
}

interface ReviewListProps {
  productId: string;
  refreshKey: number;
}

export function ReviewList({ productId, refreshKey }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [ratingBreakdown, setRatingBreakdown] = useState<{ rating: number; _count: { rating: number } }[]>([]);

  const applyPlaceholderReviews = useCallback(() => {
    const placeholders = fallbackReviewsForProduct(productId);
    setReviews(placeholders);
    setTotal(placeholders.length);
    setRatingBreakdown(fallbackRatingBreakdown(placeholders));
  }, [productId]);

  const fetchReviews = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/reviews/product/${productId}?page=${p}&limit=5`);
      const json = await res.json();
      const data = json.data ?? json;
      const apiReviews = data.reviews ?? [];
      const apiTotal = data.total ?? 0;

      // Use placeholders when forced by flag or when API returns no real data.
      if (p === 1 && (shouldUsePlaceholderReviews() || apiTotal === 0)) {
        applyPlaceholderReviews();
        return;
      }

      if (p === 1) {
        setReviews(apiReviews);
      } else {
        setReviews((prev) => [...prev, ...apiReviews]);
      }
      setTotal(apiTotal);
      setRatingBreakdown(data.ratingBreakdown ?? []);
    } catch {
      // API unreachable — fall back to placeholders so the PDP still looks alive.
      if (p === 1) applyPlaceholderReviews();
    } finally {
      setLoading(false);
    }
  }, [productId, applyPlaceholderReviews]);

  useEffect(() => {
    setPage(1);
    fetchReviews(1);
  }, [fetchReviews, refreshKey]);

  const avgRating = ratingBreakdown.length > 0
    ? ratingBreakdown.reduce((sum, r) => sum + r.rating * r._count.rating, 0) / Math.max(total, 1)
    : 0;

  const getCount = (star: number) =>
    ratingBreakdown.find((r) => r.rating === star)?._count.rating ?? 0;

  const handleMarkHelpful = async (reviewId: string) => {
    await fetch(`${API}/reviews/${reviewId}/helpful`, { method: 'PATCH' });
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r
      ),
    );
  };

  if (!loading && total === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No reviews yet. Be the first to share your experience.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {/* Rating Summary */}
      {total > 0 && (
        <div className="flex items-start gap-8">
          <div className="text-center">
            <p className="text-4xl font-medium text-ink">{avgRating.toFixed(1)}</p>
            <StarRating rating={Math.round(avgRating)} size="sm" />
            <p className="mt-1 text-xs text-muted">{total} review{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = getCount(star);
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted">{star}</span>
                  <div className="h-2 flex-1 bg-muted-bg">
                    <div className="h-full bg-[#D4A853] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Items */}
      <div className="divide-y divide-border">
        {reviews.map((review) => (
          <div key={review.id} className="py-6 first:pt-0">
            <div className="mb-2 flex items-center gap-3">
              <StarRating rating={review.rating} size="sm" />
              {review.isVerified && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-success">
                  Verified Purchase
                </span>
              )}
            </div>
            {review.title && (
              <p className="mb-1 text-sm font-medium text-ink">{review.title}</p>
            )}
            <p className="mb-3 text-sm text-muted">{review.body}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                {review.user.firstName} {review.user.lastName} &middot;{' '}
                {new Date(review.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <button
                onClick={() => handleMarkHelpful(review.id)}
                className="text-xs text-muted transition-colors hover:text-ink"
              >
                Helpful ({review.helpfulCount})
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {reviews.length < total && (
        <div className="text-center">
          <button
            onClick={() => {
              const next = page + 1;
              setPage(next);
              fetchReviews(next);
            }}
            disabled={loading}
            className="border border-border px-8 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition-colors hover:border-ink disabled:text-muted"
          >
            {loading ? 'Loading...' : 'Load More Reviews'}
          </button>
        </div>
      )}
    </div>
  );
}
