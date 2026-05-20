'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Loader2, Package, ShieldCheck } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface TrackedOrderItem {
  id: string;
  productName: string | null;
  quantity: number;
  total: string | number;
  variant?: {
    size?: string | null;
    color?: string | null;
    product?: { name?: string | null } | null;
  } | null;
  snapshot?: unknown;
}

interface TrackedOrder {
  id: string;
  // Customer-facing identifier (DEN-NNNNNN). Surface to the customer
  // instead of the raw CUID tail. May be missing on very-old snapshots
  // pre-dating the column.
  orderNumber?: string;
  status: string;
  subtotal: string | number;
  discount: string | number;
  shippingCost: string | number;
  total: string | number;
  shippingAddress: unknown;
  createdAt: string;
  items: TrackedOrderItem[];
}

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; order: TrackedOrder }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending — awaiting confirmation',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  RETURNED: 'Returned',
  PAYMENT_FAILED: 'Payment failed',
};

function displayOrderRef(order: TrackedOrder): string {
  return order.orderNumber ?? order.id.slice(-8).toUpperCase();
}

function itemLabel(item: TrackedOrderItem): string {
  if (item.variant?.product?.name) {
    const parts = [item.variant.color, item.variant.size].filter(
      (p): p is string => Boolean(p),
    );
    const suffix = parts.length ? ` (${parts.join('/')})` : '';
    return `${item.variant.product.name}${suffix}`;
  }
  if (item.productName) return item.productName;
  return 'Item';
}

function readAddressLines(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const pick = (k: string): string | null => {
    const v = obj[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const phone = pick('phone');
  return [
    pick('name'),
    pick('line1') ?? pick('street'),
    pick('line2'),
    [pick('city'), pick('state')].filter(Boolean).join(', ') || null,
    pick('zip') ?? pick('postalCode'),
    phone ? `Phone: ${phone}` : null,
  ].filter((s): s is string => Boolean(s));
}

function TrackOrderForm() {
  const searchParams = useSearchParams();
  const prefilledId = searchParams.get('order') ?? '';

  const [orderId, setOrderId] = useState(prefilledId);
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  useEffect(() => {
    if (prefilledId && !orderId) {
      setOrderId(prefilledId);
    }
  }, [prefilledId, orderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lookup.status === 'loading') return;

    const trimmedId = orderId.trim();
    const trimmedEmail = email.trim();
    if (!trimmedId || !trimmedEmail) return;

    setLookup({ status: 'loading' });

    try {
      const params = new URLSearchParams({
        id: trimmedId,
        email: trimmedEmail,
      });
      const res = await fetch(`/api/orders/lookup?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          data?: TrackedOrder;
        };
        if (data.success && data.data) {
          setLookup({ status: 'success', order: data.data });
          return;
        }
        setLookup({ status: 'not-found' });
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

  if (lookup.status === 'success') {
    const order = lookup.order;
    const addressLines = readAddressLines(order.shippingAddress);
    return (
      <section className="mx-auto max-w-lg space-y-6 rounded-[12px] border border-[var(--color-outline-variant)] bg-paper p-8 shadow-sm md:p-10">
        <header className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-secondary)]">
            Order
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            {displayOrderRef(order)}
          </h2>
          <p className="text-sm text-[var(--color-secondary)]">
            {STATUS_LABEL[order.status] ?? order.status}
          </p>
        </header>

        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
            Items
          </p>
          <ul className="space-y-2 text-sm">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 border-b border-[var(--color-outline-variant)] pb-2 last:border-b-0 last:pb-0"
              >
                <span className="text-ink">
                  {itemLabel(item)}{' '}
                  <span className="text-[var(--color-secondary)]">
                    × {item.quantity}
                  </span>
                </span>
                <span className="text-ink">
                  {formatPrice(Number(item.total))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1 border-t border-[var(--color-outline-variant)] pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-secondary)]">Subtotal</span>
            <span className="text-ink">{formatPrice(Number(order.subtotal))}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between">
              <span className="text-[var(--color-secondary)]">Discount</span>
              <span className="text-ink">
                -{formatPrice(Number(order.discount))}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--color-secondary)]">Shipping</span>
            <span className="text-ink">
              {formatPrice(Number(order.shippingCost))}
            </span>
          </div>
          <div className="flex justify-between pt-2 text-base font-semibold">
            <span className="text-ink">Total</span>
            <span className="text-ink">{formatPrice(Number(order.total))}</span>
          </div>
        </div>

        {addressLines.length > 0 && (
          <div className="text-sm">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
              Delivery to
            </p>
            <div className="leading-relaxed text-[var(--color-secondary)]">
              {addressLines.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setLookup({ status: 'idle' })}
          className="text-[11px] font-bold uppercase tracking-[0.25em] text-ink underline-offset-4 hover:underline"
        >
          Look up another order
        </button>
      </section>
    );
  }

  return (
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
          placeholder="e.g. DEN-000142"
          className="w-full border border-ink/20 bg-transparent px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-ink"
        />
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--color-secondary)]">
          Found at the top of your order confirmation email
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
            <Link
              href="/contact"
              className="text-ink underline-offset-4 hover:underline"
            >
              Contact us
            </Link>
            .
          </p>
        </div>
      )}

      {lookup.status === 'error' && (
        <p
          role="alert"
          className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-center text-xs text-red-800"
        >
          {lookup.message}
        </p>
      )}
    </form>
  );
}

export default function TrackOrderPage() {
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
          Enter your order number and the email used at checkout. We&apos;ll
          pull up the current status — from dispatch through delivery.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="mx-auto max-w-lg rounded-[12px] border border-[var(--color-outline-variant)] bg-paper p-8 text-center text-sm text-[var(--color-secondary)] md:p-10">
            Loading…
          </div>
        }
      >
        <TrackOrderForm />
      </Suspense>

      <div className="mx-auto mt-16 grid max-w-3xl gap-6 sm:grid-cols-3">
        <div className="flex flex-col items-center gap-3 border-t border-[var(--color-outline-variant)] pt-6 text-center">
          <Package size={20} strokeWidth={1.5} className="text-ink" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
            Dispatch in 1–2 days
          </h3>
          <p className="text-[11px] leading-relaxed text-[var(--color-secondary)]">
            Orders ship from our Dhaka studio within 48 hours of
            confirmation.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-[var(--color-outline-variant)] pt-6 text-center">
          <ShieldCheck size={20} strokeWidth={1.5} className="text-ink" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
            Secure lookup
          </h3>
          <p className="text-[11px] leading-relaxed text-[var(--color-secondary)]">
            Email verification prevents third parties from tracking orders
            that aren&apos;t theirs.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-[var(--color-outline-variant)] pt-6 text-center">
          <ArrowRight size={20} strokeWidth={1.5} className="text-ink" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-ink">
            Have an account?
          </h3>
          <p className="text-[11px] leading-relaxed text-[var(--color-secondary)]">
            <Link
              href="/account/orders"
              className="text-ink underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{' '}
            to see your full order history.
          </p>
        </div>
      </div>
    </div>
  );
}
