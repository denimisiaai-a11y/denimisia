'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface AccountErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AccountError({ error, reset }: AccountErrorProps) {
  useEffect(() => {
    // Surfacing the message and digest helps post-mortem. Vercel function
    // logs already capture the stack — this is the customer-facing copy.
    console.error('[account] render error', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h2 className="mb-3 text-lg font-medium uppercase tracking-[0.15em] text-ink">
        We couldn&apos;t load your account.
      </h2>
      <p className="mb-2 text-sm text-muted">
        Something on our side is off. Please try again in a moment.
      </p>
      {error.digest && (
        <p className="mb-6 break-all text-[10px] uppercase tracking-widest text-muted/70">
          Ref: {error.digest}
        </p>
      )}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full border border-ink px-6 py-2 text-xs uppercase tracking-[0.2em] text-ink transition hover:bg-ink hover:text-paper"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.2em] text-muted underline-offset-4 hover:underline"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
