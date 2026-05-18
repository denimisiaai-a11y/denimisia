import { NextResponse } from 'next/server';

const API =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// Guest order lookup by (orderId + email). Both must match for the API
// to return any order details — this stops attackers from enumerating
// orders by ID alone. This route proxies to the backend so the API stays
// the single source of validation.
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = (searchParams.get('id') ?? '').trim();
  const email = (searchParams.get('email') ?? '').trim();

  if (!orderId || !email) {
    return NextResponse.json(
      { success: false, error: 'Order number and email are required.' },
      { status: 400 },
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { success: false, error: 'Invalid email.' },
      { status: 400 },
    );
  }

  try {
    const params = new URLSearchParams({ id: orderId, email });
    const res = await fetch(`${API}/orders/lookup?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Collapse 404 / 400 / etc. into a single "not found" surface so
      // the page does not have to branch on backend error codes.
      const status = res.status >= 500 ? 502 : 404;
      return NextResponse.json(
        { success: false, error: 'Order not found.' },
        { status },
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Could not reach the order service.' },
      { status: 502 },
    );
  }
}
