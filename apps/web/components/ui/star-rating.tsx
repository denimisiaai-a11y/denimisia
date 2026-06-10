'use client';

import { useState } from 'react';

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  size?: 'sm' | 'md';
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 1.5l2.47 5.01L18 7.26l-4 3.9.94 5.5L10 14.27l-4.94 2.6.94-5.5-4-3.9 5.53-.75L10 1.5z"
        fill={filled ? '#D4A853' : 'none'}
        stroke={filled ? '#D4A853' : '#d4d4d4'}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarRating({ rating, onRate, size = 'md' }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || rating;
  const scale = size === 'sm' ? 'scale-75' : '';

  return (
    <div
      className={`flex items-center gap-0.5 ${scale}`}
      onMouseLeave={() => onRate && setHoverRating(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onRate}
          className={onRate ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => onRate && setHoverRating(star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          <StarIcon filled={star <= displayRating} />
        </button>
      ))}
    </div>
  );
}
