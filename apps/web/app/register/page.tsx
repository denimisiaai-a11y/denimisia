'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { AUTH_EDITORIAL } from '@/lib/placeholder-images';
import { useSlotImage } from '@/lib/use-slot-image';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default function RegisterPage() {
  const { src: editorialSrc, altText: editorialAlt } = useSlotImage(
    'auth',
    'auth_editorial_panel',
    AUTH_EDITORIAL,
  );
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          ...(phone ? { phone } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const msg = Array.isArray(json.error)
          ? json.error[0]
          : json.error ?? 'Registration failed';
        setError(msg);
        return;
      }

      const loginResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        router.push('/login');
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
    <main className="flex min-h-screen w-full flex-col overflow-hidden bg-[var(--color-surface)] text-[var(--color-on-surface)] antialiased md:flex-row">
      {/* Left: cinematic editorial image */}
      <section
        data-slot="auth.auth_editorial_panel"
        className="relative hidden h-[420px] w-full overflow-hidden bg-[#1a1a1a] md:block md:h-screen md:w-1/2"
      >
        <Image
          data-slot-field="media"
          src={editorialSrc}
          alt={editorialAlt ?? 'Architectural denim editorial photography'}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="absolute inset-0 scale-105 object-cover opacity-90 grayscale transition-all duration-1000 ease-in-out hover:grayscale-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 z-10 max-w-md">
          <span className="mb-3 block text-[10px] font-medium uppercase tracking-[0.3em] text-white/70 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            Collection 2026
          </span>
          <h2 className="text-3xl font-light uppercase leading-tight tracking-[0.15em] text-white md:text-5xl [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]">
            Architectural
            <br />
            Silhouettes
          </h2>
        </div>
      </section>

      {/* Right: registration form */}
      <section className="relative flex w-full items-center justify-center bg-white px-8 py-24 md:w-1/2 md:px-16 md:py-32 lg:px-24">
        {/* Mobile branding */}
        <div className="absolute left-1/2 top-10 -translate-x-1/2 md:hidden">
          <Link
            href="/"
            className="text-xl font-light tracking-[0.35em] text-ink"
          >
            DENIMISIA
          </Link>
        </div>

        <div className="w-full max-w-md space-y-12">
          <header className="space-y-4">
            <h1 className="text-2xl font-semibold uppercase leading-tight tracking-[0.2em] text-ink md:text-3xl">
              Join the Archive
            </h1>
            <p className="text-sm font-light leading-relaxed text-[var(--color-on-surface-variant)]">
              Access exclusive releases, archival collections, and a tailored
              shopping experience curated for the minimalist.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <p
                role="alert"
                className="text-xs tracking-[0.1em] text-error"
              >
                {error}
              </p>
            )}

            {/* Names row */}
            <div className="grid grid-cols-2 gap-6">
              <FieldUnderline
                id="firstName"
                label="First Name"
                type="text"
                value={firstName}
                onChange={setFirstName}
                placeholder="ALEXANDER"
                autoComplete="given-name"
                required
                uppercase
              />
              <FieldUnderline
                id="lastName"
                label="Last Name"
                type="text"
                value={lastName}
                onChange={setLastName}
                placeholder="VANCE"
                autoComplete="family-name"
                required
                uppercase
              />
            </div>

            <FieldUnderline
              id="email"
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="curator@denimisia.com"
              autoComplete="email"
              required
            />

            <FieldUnderline
              id="phone"
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="+1 (555) 000-0000"
              autoComplete="tel"
            />

            <FieldUnderline
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
            />

            <div className="space-y-8 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-ink py-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-black/5 transition-all duration-300 hover:bg-ink/90 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="flex flex-col items-center gap-4">
                <Link
                  href="/login"
                  className="border-b border-transparent pb-0.5 text-[10px] uppercase tracking-[0.2em] text-[var(--color-on-surface-variant)] transition-colors hover:border-ink hover:text-ink"
                >
                  Already have an account? <span className="font-semibold">Login</span>
                </Link>
              </div>
            </div>
          </form>

          <footer className="pt-6">
            <p className="text-center text-[9px] uppercase leading-loose tracking-[0.2em] text-[var(--color-outline)]">
              By creating an account, you agree to our
              <br />
              <Link
                href="/terms"
                className="underline underline-offset-4 transition-colors hover:text-ink"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-4 transition-colors hover:text-ink"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </footer>
        </div>

        {/* Subtle background flourish */}
        <div className="pointer-events-none absolute bottom-8 right-8 hidden select-none opacity-[0.04] md:block">
          <span className="text-[10rem] font-bold leading-none tracking-tighter">
            D
          </span>
        </div>
      </section>
    </main>
  );
}

interface FieldUnderlineProps {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'password';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  uppercase?: boolean;
}

function FieldUnderline({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
  uppercase,
}: FieldUnderlineProps) {
  return (
    <div className="group relative">
      <label
        htmlFor={id}
        className="mb-1 block text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--color-on-surface-variant)] transition-colors group-focus-within:text-ink"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={`w-full border-0 border-b border-[var(--color-outline-variant)] bg-transparent px-0 py-2.5 text-sm font-light tracking-wider text-ink transition-all duration-300 placeholder:text-[var(--color-outline)]/40 focus:border-ink focus:outline-none focus:ring-0 ${
          uppercase ? 'uppercase' : ''
        }`}
      />
    </div>
  );
}
