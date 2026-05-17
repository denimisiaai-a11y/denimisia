'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { StarRating } from '@/components/ui/star-rating';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface ReviewFormProps {
  productId: string;
  onSubmitted: () => void;
}

export function ReviewForm({ productId, onSubmitted }: ReviewFormProps) {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!session) {
    return (
      <div className="border border-border px-6 py-8 text-center">
        <p className="mb-3 text-sm text-muted">Share your experience with this product.</p>
        <Link
          href="/login"
          className="text-sm text-ink underline underline-offset-4"
        >
          Sign in to leave a review
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="border border-success/30 bg-success/5 px-6 py-8 text-center">
        <p className="text-sm text-success">Your review has been submitted. Thank you!</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (body.length < 10) {
      setError('Review must be at least 10 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ productId, rating, title: title || undefined, body }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.message ?? 'Failed to submit review');
        return;
      }

      setSuccess(true);
      onSubmitted();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 border border-border p-6">
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink">
        Write a Review
      </h3>

      {error && <p className="text-sm text-error">{error}</p>}

      <div>
        <label className="mb-2 block text-xs text-muted">Rating</label>
        <StarRating rating={rating} onRate={setRating} />
      </div>

      <div>
        <label htmlFor="review-title" className="mb-1.5 block text-xs text-muted">
          Title (optional)
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-border bg-transparent px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
          placeholder="Summarize your experience"
        />
      </div>

      <div>
        <label htmlFor="review-body" className="mb-1.5 block text-xs text-muted">
          Review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={10}
          rows={4}
          className="w-full resize-none border border-border bg-transparent px-4 py-2.5 text-sm text-ink outline-none transition-colors focus:border-ink"
          placeholder="What did you like or dislike?"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-ink px-8 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-ink/90 disabled:bg-muted"
      >
        {loading ? 'Submitting...' : 'Submit Review'}
      </button>
    </form>
  );
}
