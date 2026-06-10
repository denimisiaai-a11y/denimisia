'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCart } from '@/stores/cart';
// Checkout uses the ৳ glyph (see lib/utils); aliased so call sites stay tidy.
import { formatTaka as formatPrice } from '@/lib/utils';

interface CheckoutProfile {
  id: string;
  firstName: string;
  lastName: string;
  phones: string[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export default function CheckoutPage() {
  const { data: session, status } = useSession();
  const { items, total, count, clearCart } = useCart();

  const [profile, setProfile] = useState<CheckoutProfile | null>(null);

  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  // Phone is pre-filled from profile.phones[0] for signed-in users once
  // the profile fetch completes. A separate useEffect syncs it when the
  // profile arrives.
  const [phone, setPhone] = useState('');
  // Guest checkout state. Only used when the customer is not logged in.
  // The API's CreateOrderDto requires guestEmail + guestName + guestPhone
  // as a tuple; guestPhone reuses the shipping phone field below.
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState<string | null>(null);

  const isGuest = status === 'unauthenticated';
  const isSignedIn = status === 'authenticated';

  // Fetch profile for signed-in users so we can pre-fill phones[0].
  useEffect(() => {
    if (!isSignedIn) return;
    const accessToken = (session as { accessToken?: string } | null)?.accessToken;
    if (!accessToken) return;

    fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { success?: boolean; data?: { id?: string; firstName?: string; lastName?: string; phones?: string[] } } | null) => {
        if (json?.success && json.data) {
          const raw = json.data;
          setProfile({
            id: raw.id ?? '',
            firstName: raw.firstName ?? '',
            lastName: raw.lastName ?? '',
            phones: Array.isArray(raw.phones) ? raw.phones : [],
          });
        }
      })
      .catch(() => {
        // Best-effort — checkout still works without the profile.
      });
  }, [isSignedIn, session]);

  // Pre-fill phone from phones[0] when the profile loads (signed-in only).
  // Only sets once: if the user has already typed something, respect that.
  useEffect(() => {
    const first = profile?.phones[0];
    if (first && phone === '') {
      setPhone(first);
    }
  }, [profile, phone]);

  // Client-side phone validation: 10–11 digits (BD mobile format).
  const phoneDigitsOnly = phone.replace(/\D/g, '');
  const isPhoneValid = /^\d{10,11}$/.test(phoneDigitsOnly);

  // Shipping calculation
  const subtotal = total();
  const isDhaka = city.toLowerCase().includes('dhaka');
  const shippingCost = subtotal >= 1500 ? 0 : isDhaka ? 80 : 120;
  const grandTotal = subtotal + shippingCost;

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  if (count() === 0 && !orderPlaced) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 pt-24">
        <p className="text-sm text-muted">Your cart is empty.</p>
        <Link href="/" className="btn-pill btn-pill-outline !border-ink !text-ink">
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (orderPlaced) {
    // Logged-in customers land on /account/orders; guests get the
    // email-gated /track-order page since they have no account yet.
    const followUpHref = isGuest
      ? `/track-order?order=${orderPlaced}`
      : '/account/orders';
    const followUpLabel = isGuest ? 'Track Order' : 'View Orders';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 pt-24 text-center">
        <h1 className="text-2xl font-medium uppercase tracking-[0.2em] text-ink">
          Order Placed
        </h1>
        <p className="text-sm text-muted">
          Thank you! Your order #{orderPlaced.slice(-8).toUpperCase()} has
          been placed.
        </p>
        <p className="text-sm text-muted">
          Payment method: Cash on Delivery (COD)
        </p>
        {isGuest && (
          <p className="max-w-md text-xs text-muted">
            We&apos;ve sent a confirmation to {guestEmail}. Keep your order
            number — you&apos;ll need it (with your email) to check status.
          </p>
        )}
        <Link
          href={followUpHref}
          className="btn-pill btn-pill-outline !border-ink !text-ink mt-4"
        >
          {followUpLabel}
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const accessToken = (session as { accessToken?: string } | null)?.accessToken;

      // Validate BD phone format (10–11 digits) before hitting the API.
      if (!isPhoneValid) {
        setError('Phone number must be 10–11 digits (BD mobile format).');
        setLoading(false);
        return;
      }

      // Validate guest tuple up front. The API also enforces this and the
      // DB has a CHECK constraint, but failing fast in the form is friendlier.
      if (isGuest) {
        if (!guestEmail.trim() || !guestName.trim() || !phone.trim()) {
          setError(
            'Guest checkout needs your email, name, and phone so we can reach you about delivery.',
          );
          setLoading(false);
          return;
        }
      } else if (!accessToken) {
        setError('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }

      // If signed in and the phone differs from the stored phones[0], patch
      // the profile first so the server dedup-prepends it into phones[].
      // This is best-effort — a failure does NOT block the order.
      if (isSignedIn && accessToken && profile) {
        const storedDigits = (profile.phones[0] ?? '').replace(/\D/g, '');
        if (phoneDigitsOnly !== storedDigits) {
          try {
            await fetch(`${API}/users/me`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: phoneDigitsOnly,
              }),
            });
          } catch {
            // Intentionally silent — profile update failure must not block checkout.
          }
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (!isGuest && accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.qty,
          })),
          shippingAddress: {
            name: isGuest
              ? guestName || undefined
              : session?.user?.name ?? undefined,
            line1: street,
            city,
            state,
            zip,
            phone,
          },
          ...(isGuest
            ? {
                guestEmail: guestEmail.trim(),
                guestName: guestName.trim(),
                guestPhone: phone.trim(),
              }
            : {}),
          ...(discountCode.trim() ? { discountCode: discountCode.trim() } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        // NestJS validation responses look like
        //   { success: false, error: 'Bad Request', message: '...', details: [...] }
        // We previously only surfaced `json.error` which is always the HTTP-
        // level label ('Bad Request', 'Conflict', etc.). Prefer the actual
        // human-readable validator message so the customer can see which
        // field was wrong.
        const fromDetails =
          Array.isArray(json.details) && json.details.length > 0
            ? String(json.details[0])
            : null;
        const fromMessage =
          typeof json.message === 'string'
            ? json.message
            : Array.isArray(json.message)
              ? String(json.message[0])
              : null;
        const fromError = Array.isArray(json.error)
          ? String(json.error[0])
          : typeof json.error === 'string'
            ? json.error
            : null;
        setError(
          fromDetails ??
            fromMessage ??
            fromError ??
            'Failed to place order',
        );
        return;
      }

      clearCart();
      setOrderPlaced(json.data.id);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-6 pb-20 pt-28 lg:px-12">
      <h1 className="mb-10 text-2xl font-medium uppercase tracking-[0.2em] text-ink">
        Checkout
      </h1>

      <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
        {/* Left: Shipping form */}
        <form onSubmit={handleSubmit} id="checkout-form" className="space-y-5">
          {error && <p className="text-sm text-error">{error}</p>}

          {isGuest && (
            <div className="space-y-5 border border-border p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                  Contact Details
                </h2>
                <Link
                  href="/login"
                  className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Have an account? Sign in
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="guest-name"
                    className="mb-1.5 block text-xs text-muted"
                  >
                    Full Name
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    autoComplete="name"
                    className="w-full border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label
                    htmlFor="guest-email"
                    className="mb-1.5 block text-xs text-muted"
                  >
                    Email
                  </label>
                  <input
                    id="guest-email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="w-full border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink"
                  />
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                We&apos;ll send order updates to this email. No password
                required — but creating an account later lets you see your
                full order history in one place.
              </p>
            </div>
          )}

          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-ink">
            Shipping Address
          </h2>

          <div>
            <label htmlFor="street" className="mb-1.5 block text-xs text-muted">Street Address</label>
            <input
              id="street"
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              required
              className="w-full border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="mb-1.5 block text-xs text-muted">City</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="w-full border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
            <div>
              <label htmlFor="state" className="mb-1.5 block text-xs text-muted">Division/State</label>
              <input
                id="state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="w-full border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="zip" className="mb-1.5 block text-xs text-muted">Postal Code</label>
              <input
                id="zip"
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
                className="w-full border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-xs text-muted">Phone</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                className={`w-full border bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink ${
                  phone && !isPhoneValid ? 'border-error' : 'border-border'
                }`}
              />
              {phone && !isPhoneValid && (
                <p className="mt-1 text-[11px] text-error">
                  Enter a valid BD phone number (10–11 digits).
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="discount" className="mb-1.5 block text-xs text-muted">Discount Code (optional)</label>
            <input
              id="discount"
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              className="w-full border border-border bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink"
              placeholder="e.g. WELCOME10"
            />
          </div>

          <div className="pt-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink">Payment Method</p>
            <div className="flex items-center gap-3 border border-ink p-4">
              <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-ink">
                <div className="h-2 w-2 rounded-full bg-ink" />
              </div>
              <span className="text-sm text-ink">Cash on Delivery (COD)</span>
            </div>
          </div>
        </form>

        {/* Right: Order summary */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-border p-6">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Order Summary
            </h2>

            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-3">
                  <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden bg-muted-bg">
                    <Image src={item.image} alt={item.productName} fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-ink">{item.productName}</p>
                    <p className="text-xs text-muted">{item.color} / {item.size} &times; {item.qty}</p>
                  </div>
                  <p className="text-sm text-ink">{formatPrice(item.price * item.qty)}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-ink">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Shipping</span>
                <span className="text-ink">
                  {shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}
                </span>
              </div>
              {shippingCost === 0 && (
                <p className="text-xs text-success">Free shipping on orders over ৳1,500</p>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-ink">Total</span>
                <span className="text-ink">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={loading || !isPhoneValid}
              className="mt-6 w-full bg-ink py-3.5 text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-ink/90 disabled:bg-muted"
            >
              {loading ? 'Placing order...' : `Place Order — ${formatPrice(grandTotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
