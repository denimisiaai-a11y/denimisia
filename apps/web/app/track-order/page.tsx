'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2, Package, ShieldCheck } from 'lucide-react';

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

export default function TrackOrderPage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lookup.status === 'loading') return;

    const trimmedId = orderId.trim();
    const trimmedEmail = email.trim();
    if (!trimmedId || !trimmedEmail) return;

    setLookup({ status: 'loading' });

    try {
      const params = new URLSearchParams({ id: trimmedId, email: trimmedEmail });
      const res = await fetch(`/api/orders/lookup?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          orderId?: string;
          redirect?: string;
        };
        const target = data.redirect ?? `/account/orders/${data.orderId ?? trimmedId}`;
        router.push(target);
        return;
      }

      if (res.status === 404) {
        setLookup({ status: 'not-found' });
        return;
      }

      setLookup({
        status: 'error',
        message: 'Could not retrieve your order. Please try again shortly.',
      });
    } catch {
      setLookup({
        status: 'error',
        message: 'Network error. Please check your connection and try again.',
      });
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-28 md:px-12">
      <header className="mx-auto mb-16 max-w-2xl text-center">
        <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-secondary)]">
          Shipment Status
        </span>
        <h1 className="mb-6 text-4xl font-black uppercase leading-[0.95] tracking-tight text-ink md:text-6xl">
          Track Your Order
        </h1>
        <p className="text-sm leading-relaxed text-[var(--color-secondary)] md:text-base">
          Enter your order number and the email used at checkout. We&apos;ll pull up the current
          status — from dispatch through delivery.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mx-auto max-w-lg space-y-5 rounded-[12px] border border-[var(--color-outline-variant)] bg-paper p-8 shadow-sm md:p-10"
      >
        <div>
          <label
            htmlFor="order-id"
            className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-ink"
          >
            Order Number
          </label>
          <input
            id="order-id"
            type="text"
            required
            autoComplete="off"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g. DEN-20260413-001"
            className="w-full border border-ink/20 bg-transparent px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-ink"
          />
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--color-secondary)]">
            Found in your order confirmation email
          </p>
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-ink"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-ink/20 bg-transparent px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-ink"
          />
        </div>

        <button
          type="submit"
          disabled={lookup.status === 'loading'}
          className="inline-flex w-full items-center justify-center gap-3 bg-ink py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {lookup.status === 'loading' ? (
            <>
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              Checking…
            </>
          ) : (
            <>
              Track Order
              <ArrowRight size={14} strokeWidth={2} />
            </>
          )}
        </button>

        {lookup.status === 'not-found' && (
          <div
            role="alert"
            className="rounded-sm border border-[var(--color-outline-variant)] bg-[var(--color-surface-low)] px-4 py-4 text-center"
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-ink">
              Order not found
            </p>
            <p className="text-xs text-[var(--color-secondary)]">
              Double-check your order number and email. Still stuck?{' '}
              <Link href="/contact" className="text-ink underline-offset-4 hover:underline">
                Contact us
              </Link>
              .
            </p>
          </div>
        )}

        {lookup.status === 'error' && (
          <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-center text-xs text-red-800">
            {lookup.message}
          </p>
        )}
      </form>

      <div className="mx-auto mt-16 grid max-w-3xl gap-6 sm:grid-cols-3">
        <div className="flex flex-col items-center gap-3 border-t border-[var(--color-outline-variant)] pt-6 text-center">
          <Package size={20} strokeWidth={1.5} className="text-ink" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
            Dispatch in 1–2 days
          </h3>
          <p className="text-[11px] leading-relaxed text-[var(--color-secondary)]">
            Orders ship from our Dhaka studio within 48 hours of confirmation.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-[var(--color-outline-variant)] pt-6 text-center">
          <ShieldCheck size={20} strokeWidth={1.5} className="text-ink" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
            Secure lookup
          </h3>
          <p className="text-[11px] leading-relaxed text-[var(--color-secondary)]">
            Email verification prevents third parties from tracking orders that aren&apos;t theirs.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-[var(--color-outline-variant)] pt-6 text-center">
          <ArrowRight size={20} strokeWidth={1.5} className="text-ink" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
            Have an account?
          </h3>
          <p className="text-[11px] leading-relaxed text-[var(--color-secondary)]">
            <Link href="/account/orders" className="text-ink underline-offset-4 hover:underline">
              Sign in
            </Link>{' '}
            to see your full order history.
          </p>
        </div>
      </div>
    </div>
  );
}
