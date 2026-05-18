import Link from 'next/link';
import { auth } from '@/lib/auth';
import { formatPrice } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface Order {
  id: string;
  status: string;
  total: string;
  shippingCost: string;
  createdAt: string;
  items: { id: string; productName: string; quantity: number; price: string }[];
}

async function getOrders(accessToken: string): Promise<Order[]> {
  try {
    const res = await fetch(`${API}/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const json = await res.json();
    // API returns { success, data: { orders, total, page, limit } } via
    // OrdersService.getMyOrders. Earlier code assumed data was already
    // the array and rendered "No orders yet." on every successful call.
    if (!json.success) return [];
    const payload = json.data;
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.orders) ? payload.orders : [];
  } catch {
    return [];
  }
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning',
  CONFIRMED: 'bg-success/10 text-success',
  PROCESSING: 'bg-ink/10 text-ink',
  SHIPPED: 'bg-ink/10 text-ink',
  DELIVERED: 'bg-success/10 text-success',
  CANCELLED: 'bg-error/10 text-error',
  REFUNDED: 'bg-muted/10 text-muted',
};

export default async function OrdersPage() {
  const session = await auth();
  const orders = session?.accessToken ? await getOrders(session.accessToken) : [];

  return (
    <div>
      <h2 className="mb-6 text-lg font-medium uppercase tracking-[0.1em] text-ink">Orders</h2>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="block border border-border p-5 transition-colors hover:border-ink"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">
                    Order #{order.id.slice(-8).toUpperCase()}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(order.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] ${STATUS_COLORS[order.status] ?? 'bg-muted-bg text-muted'}`}>
                    {order.status}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {formatPrice(Number(order.total))}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {order.items.length} item{order.items.length !== 1 ? 's' : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
