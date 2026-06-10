'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    fetch(`${API}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage('Your email has been verified successfully.');
        } else {
          setStatus('error');
          setMessage(json.message ?? 'Verification failed. The link may have expired.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Something went wrong. Please try again.');
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-24">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' && (
          <>
            <h1 className="mb-4 text-2xl font-medium uppercase tracking-[0.2em] text-ink">
              Verifying...
            </h1>
            <p className="text-sm text-muted">Please wait while we verify your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="mb-4 text-2xl font-medium uppercase tracking-[0.2em] text-success">
              Verified
            </h1>
            <p className="mb-8 text-sm text-muted">{message}</p>
            <Link
              href="/"
              className="inline-block bg-ink px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-ink/90"
            >
              Continue Shopping
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="mb-4 text-2xl font-medium uppercase tracking-[0.2em] text-error">
              Verification Failed
            </h1>
            <p className="mb-8 text-sm text-muted">{message}</p>
            <Link
              href="/login"
              className="text-sm text-ink underline underline-offset-4"
            >
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
