'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Dev-only console output. In production, error.digest still flows
    // to the runtime logs via Next.js; when a monitoring provider is
    // added, send it here instead of console.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[denimisia:error-boundary]', error);
    }
  }, [error]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-ink px-6 py-24 text-paper">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_80%)]" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="mb-6 text-[10px] font-bold uppercase tracking-[0.4em] text-paper/50">
          Unexpected Stitch
        </span>
        <h1 className="mb-4 text-[clamp(5rem,14vw,9rem)] font-black leading-[0.85] tracking-tighter">
          500
        </h1>
        <p className="mb-3 text-lg font-bold uppercase tracking-[0.2em] text-paper md:text-xl">
          Something came loose.
        </p>
        <p className="mb-12 max-w-md text-sm leading-relaxed text-paper/70 md:text-base">
          An unexpected error interrupted this request. The team has been notified. You can try
          again or head back to the homepage.
        </p>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-3 bg-paper px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-ink transition-opacity hover:opacity-85"
          >
            <RefreshCw size={14} strokeWidth={2} />
            Try Again
          </button>
          <Link
            href="/"
            className="border border-paper/40 px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-paper transition-colors hover:bg-paper/10"
          >
            Back to Homepage
          </Link>
        </div>

        {error.digest && (
          <p className="mt-10 text-[9px] uppercase tracking-[0.25em] text-paper/30">
            Ref · {error.digest}
          </p>
        )}

        <Link
          href="/contact"
          className="mt-12 text-[10px] uppercase tracking-[0.3em] text-paper/50 underline-offset-4 transition-colors hover:text-paper hover:underline"
        >
          Report the issue →
        </Link>
      </div>

      <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.35em] text-paper/25">
        Denimisia · Made in Bangladesh
      </span>
    </div>
  );
}
