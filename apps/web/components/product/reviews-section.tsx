'use client';

import { useState } from 'react';
import { ReviewForm } from './review-form';
import { ReviewList } from './review-list';

interface ReviewsSectionProps {
  productId: string;
}

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="mx-auto max-w-[1440px] px-6 py-16 lg:px-12">
      <h2 className="mb-10 text-center text-lg font-medium uppercase tracking-[0.2em] text-ink">
        Reviews
      </h2>
      <div className="mx-auto max-w-3xl space-y-10">
        <ReviewList productId={productId} refreshKey={refreshKey} />
        <ReviewForm productId={productId} onSubmitted={() => setRefreshKey((k) => k + 1)} />
      </div>
    </section>
  );
}
