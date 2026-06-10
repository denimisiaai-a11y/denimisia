import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { formatPrice } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface Order {
  id: string;
  // Customer-facing identifier (DEN-NNNNNN). Stable, memorable. Falls
  // back to the CUID's last 8 chars for orders pre-dating the
  // orderNumber column on legacy/staging snapshots that haven't run
  // the backfill yet.
  orderNumber?: string;
  status: string;
  total: string;
  shippingCost: string;
  createdAt: string;
  items: { id: string; productName: string; quantity: number; price: string }[];
}

function displayOrderRef(order: Order): string {
  return order.orderNumber ?? order.id.slice(-8).toUpperCase();
}

type OrdersResult =
  | { ok: true; orders: Order[] }
  | { ok: false; status: number | 'network' };

async function getOrders(accessToken: string): Promise<OrdersResult> {
  try {
    const res = await fetch(`${API}/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status };
    const json = await res.json();
    // API returns { success, data: { orders, total, page, limit } } via
    // OrdersService.getMyOrders. Earlier code assumed data was already
    // the array and rendered "No orders yet." on every successful call.
    if (!json.success) return { ok: false, status: res.status };
    const payload = json.data;
    const orders: Order[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.orders)
        ? payload.orders
        : [];
    return { ok: true, orders };
  } catch {
    return { ok: false, status: 'network' };
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
  const accessToken = session?.accessToken;
  if (!accessToken) redirect('/api/auth/expire');

  const result = await getOrders(accessToken);
  // 401 = the API JWT inside the still-valid session cookie has expired.
  // Force-expire the session instead of showing a misleading "No orders yet."
  // (mirrors account/page.tsx).
  if (!result.ok && result.status === 401) redirect('/api/auth/expire');

  const orders = result.ok ? result.orders : [];
  const loadFailed = !result.ok;

  return (
    <div>
      <h2 className="mb-6 text-lg font-medium uppercase tracking-[0.1em] text-ink">Orders</h2>

      {loadFailed ? (
        <p className="text-sm text-muted">
          We couldn&apos;t load your orders right now. Please refresh or try again shortly.
        </p>
      ) : orders.length === 0 ? (
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
                    Order #{displayOrderRef(order)}
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
