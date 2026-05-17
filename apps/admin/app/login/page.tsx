'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function sanitizeCallbackUrl(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith('/login') || raw.startsWith('/api/auth')) return '/';
  return raw;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get('callbackUrl'));
  const loginError = searchParams.get('error');

  const [csrfToken, setCsrfToken] = useState('');

  // next-auth@5.0.0-beta.30's client-side signIn() is broken under Next.js 16
  // and fetch()-based POSTs trip auth.js's JSON-response mode (no Set-Cookie).
  // We native-submit a real HTML <form> whose action is the credentials
  // endpoint — auth.js returns 302 + Set-Cookie, browser follows to
  // callbackUrl with the session cookie now set.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/csrf', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { csrfToken?: string }) => {
        if (!cancelled && j.csrfToken) setCsrfToken(j.csrfToken);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <form
      method="POST"
      action="/api/auth/callback/credentials"
      className="rounded-lg border border-border bg-surface p-8 shadow-sm"
    >
      <h2 className="mb-6 text-lg font-semibold text-text">Sign in to your account</h2>

      {loginError && (
        <div className="mb-4 rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
          Invalid credentials or insufficient permissions. Only admins can access this panel.
        </div>
      )}

      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="mb-4">
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="admin@denimisia.com"
        />
      </div>

      <div className="mb-6">
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Enter your password"
        />
      </div>

      <button
        type="submit"
        disabled={!csrfToken}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {csrfToken ? 'Sign in' : 'Loading...'}
      </button>

      <p className="mt-4 text-center text-xs text-text-muted">
        Access restricted to authorized administrators only.
      </p>
    </form>
  );
}

function LoginFormFallback() {
  return (
    <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold text-text">Sign in to your account</h2>
      <div className="h-64 animate-pulse rounded-md bg-surface-alt" />
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">DENIMISIA</h1>
          <p className="mt-1 text-sm text-text-muted">Admin Portal</p>
        </div>
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
