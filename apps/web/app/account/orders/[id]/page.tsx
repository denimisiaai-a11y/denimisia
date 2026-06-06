import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
// Order-detail invoice uses the ৳ glyph (see lib/utils); aliased for tidy calls.
import { formatTaka as formatPrice } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function getOrder(id: string, accessToken: string) {
  try {
    const res = await fetch(`${API}/orders/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.accessToken) notFound();

  const order = await getOrder(id, session.accessToken);
  if (!order) notFound();

  // Prefer the human-friendly DEN-NNNNNN. Fall back to the CUID tail
  // for orders pre-dating the backfill (legacy snapshots).
  const orderRef = order.orderNumber ?? order.id.slice(-8).toUpperCase();

  return (
    <div>
      <h2 className="mb-6 text-lg font-medium uppercase tracking-[0.1em] text-ink">
        Order #{orderRef}
      </h2>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Status</p>
          <p className="mt-1 text-sm font-medium text-ink">{order.status}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Date</p>
          <p className="mt-1 text-sm text-ink">
            {new Date(order.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Total</p>
          <p className="mt-1 text-sm font-semibold text-ink">{formatPrice(Number(order.total))}</p>
        </div>
      </div>

      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted">Items</h3>
      <div className="space-y-3">
        {(order.items ?? []).map((item: any) => (
          <div key={item.id} className="flex items-center justify-between border-b border-border/50 pb-3">
            <div>
              <p className="text-sm text-ink">{item.productName}</p>
              <p className="text-xs text-muted">
                {item.color} / {item.size} &times; {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium text-ink">
              {formatPrice(Number(item.price) * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2 border-t border-border pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="text-ink">{formatPrice(Number(order.total) - Number(order.shippingCost ?? 0))}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Shipping</span>
          <span className="text-ink">{formatPrice(Number(order.shippingCost ?? 0))}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-ink">Total</span>
          <span className="text-ink">{formatPrice(Number(order.total))}</span>
        </div>
      </div>
    </div>
  );
}
