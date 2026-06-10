'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { AUTH_EDITORIAL } from '@/lib/placeholder-images';
import { useSlotImage } from '@/lib/use-slot-image';

export default function LoginPage() {
  const { src: editorialSrc, altText: editorialAlt } = useSlotImage(
    'auth',
    'auth_editorial_panel',
    AUTH_EDITORIAL,
  );
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-[var(--color-surface)] text-[var(--color-on-surface)] antialiased md:flex-row">
      {/* Left: cinematic editorial image */}
      <section
        data-slot="auth.auth_editorial_panel"
        className="relative hidden h-full overflow-hidden bg-[#3c3b38] md:block md:w-1/2 lg:w-3/5"
      >
        <Image
          data-slot-field="media"
          src={editorialSrc}
          alt={editorialAlt ?? 'Editorial denim photography'}
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 50vw"
          className="absolute inset-0 object-cover opacity-90 grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute bottom-16 left-16 z-10">
          <h2 className="mb-2 text-4xl font-light leading-tight tracking-[0.4em] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            DENIMISIA
          </h2>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/80 [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
            Archival Quality. Modern Silhouette.
          </p>
        </div>
      </section>

      {/* Right: login form */}
      <section className="relative flex h-full w-full items-center justify-center bg-white p-8 md:w-1/2 md:p-16 lg:w-2/5 lg:p-24">
        {/* Mobile branding */}
        <div className="absolute left-1/2 top-12 -translate-x-1/2 md:hidden">
          <Link href="/" className="text-2xl font-light tracking-[0.3em] text-ink">
            DENIMISIA
          </Link>
        </div>

        <div className="w-full max-w-md space-y-12">
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-semibold uppercase leading-tight tracking-[0.25em] text-ink">
              Sign In
            </h2>
            <p className="text-sm font-light leading-relaxed text-[var(--color-on-surface-variant)]">
              Welcome back to the gallery. Please enter your details to access your curated collection.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {error && (
              <p className="text-xs tracking-[0.1em] text-error">{error}</p>
            )}

            <div className="space-y-8">
              {/* Email */}
              <div className="group relative">
                <label
                  htmlFor="email"
                  className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-on-surface-variant)] transition-colors group-focus-within:text-ink"
                >
                  Email or Phone Number
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="e.g. name@curator.com"
                  className="w-full border-0 border-b border-[var(--color-outline-variant)] bg-transparent px-0 py-3 font-light text-ink placeholder:text-[var(--color-outline)]/40 transition-all duration-300 focus:border-ink focus:outline-none focus:ring-0"
                />
              </div>

              {/* Password */}
              <div className="group relative">
                <div className="mb-1 flex items-end justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-on-surface-variant)] transition-colors group-focus-within:text-ink"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[0.6rem] tracking-[0.1em] text-[var(--color-outline)] transition-colors hover:text-ink"
                  >
                    FORGOT?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border-0 border-b border-[var(--color-outline-variant)] bg-transparent px-0 py-3 font-light text-ink placeholder:text-[var(--color-outline)]/40 transition-all duration-300 focus:border-ink focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            {/* CTA section */}
            <div className="space-y-8 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-ink py-5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm transition-all duration-500 hover:bg-ink/90 disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="flex items-center justify-center space-x-4">
                <div className="h-px w-8 bg-[var(--color-outline-variant)]/30" />
                <span className="text-[0.65rem] font-medium tracking-[0.2em] text-[var(--color-on-surface-variant)]">
                  OR CONTINUE WITH
                </span>
                <div className="h-px w-8 bg-[var(--color-outline-variant)]/30" />
              </div>

              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/' })}
                className="flex w-full items-center justify-center rounded-full border border-[var(--color-outline-variant)]/30 py-4 transition-all duration-300 hover:border-ink/40"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09 0-.73.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-[0.65rem] font-semibold tracking-[0.1em]">GOOGLE</span>
              </button>
            </div>
          </form>

          <div className="text-center">
            <p className="text-xs font-light tracking-[0.05em] text-[var(--color-on-surface-variant)]">
              DON&apos;T HAVE AN ACCOUNT?
              <Link
                href="/register"
                className="ml-1 font-semibold text-ink underline underline-offset-4 transition-colors hover:text-ink/70"
              >
                CREATE ONE
              </Link>
            </p>
          </div>
        </div>

        {/* Subtle background flourish */}
        <div className="pointer-events-none absolute bottom-8 right-8 select-none opacity-5">
          <span className="text-[10rem] font-bold leading-none tracking-tighter">D</span>
        </div>
      </section>
    </main>
  );
}
