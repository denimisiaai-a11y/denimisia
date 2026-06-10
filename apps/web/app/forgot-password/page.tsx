'use client';

import { useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 pt-24">
        <div className="w-full max-w-sm text-center">
          <h1 className="mb-4 text-2xl font-medium uppercase tracking-[0.2em] text-ink">
            Check Your Email
          </h1>
          <p className="mb-8 text-sm text-muted">
            If an account exists for {email}, we&apos;ve sent a password reset link.
          </p>
          <Link
            href="/login"
            className="text-sm text-ink underline underline-offset-4"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-24">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-medium uppercase tracking-[0.2em] text-ink">
          Reset Password
        </h1>
        <p className="mb-8 text-center text-sm text-muted">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-center text-sm text-error">{error}</p>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-ink"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink py-3.5 text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-ink/90 disabled:bg-muted"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-muted">
          Remember your password?{' '}
          <Link href="/login" className="text-ink underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
