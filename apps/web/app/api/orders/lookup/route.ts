import { NextResponse } from 'next/server';

// Guest order lookup by (orderId + email). Both must match for us to reveal
// any order details — this stops attackers from enumerating orders by ID
// alone. When the backend exposes a matching endpoint, swap the placeholder
// 404 response for a real fetch against the API.

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

  // TODO: proxy to backend `GET /orders/lookup?id=...&email=...` once the
  // endpoint exists. For now return 404 so the UI surfaces the "not found"
  // state and shows the support fallback link.
  return NextResponse.json(
    { success: false, error: 'Order not found.' },
    { status: 404 },
  );
}
