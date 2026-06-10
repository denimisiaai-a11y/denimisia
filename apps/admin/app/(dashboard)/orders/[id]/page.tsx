'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';
import { Modal, ConfirmModal } from '@/components/modal';

type RefundReason = 'DUPLICATE' | 'REQUESTED_BY_CUSTOMER' | 'FRAUDULENT' | 'OTHER';

const REFUND_REASON_OPTIONS: { value: RefundReason; label: string }[] = [
  { value: 'REQUESTED_BY_CUSTOMER', label: 'Requested by customer' },
  { value: 'DUPLICATE', label: 'Duplicate charge' },
  { value: 'FRAUDULENT', label: 'Fraudulent' },
  { value: 'OTHER', label: 'Other' },
];

const BDT_FORMATTER = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REFUNDED'
  | 'PAYMENT_FAILED';

interface StatusBadge {
  label: string;
  classes: string;
}

const STATUS_CONFIG: Record<OrderStatus, StatusBadge> = {
  PENDING: {
    label: 'Pending',
    classes: 'bg-surface-container-highest text-on-surface',
  },
  CONFIRMED: {
    label: 'Confirmed',
    classes: 'bg-surface-container text-on-surface',
  },
  PROCESSING: {
    label: 'Processing',
    classes: 'bg-primary/10 text-primary',
  },
  SHIPPED: {
    label: 'Shipped',
    classes: 'bg-inverse-surface text-inverse-on-surface',
  },
  DELIVERED: {
    label: 'Delivered',
    classes: 'bg-surface-container text-on-surface',
  },
  CANCELLED: {
    label: 'Cancelled',
    classes: 'bg-error/10 text-error',
  },
  RETURNED: {
    label: 'Returned',
    classes: 'bg-warning/10 text-warning',
  },
  REFUNDED: {
    label: 'Refunded',
    classes: 'bg-secondary/10 text-secondary',
  },
  PAYMENT_FAILED: {
    label: 'Payment Failed',
    classes: 'bg-error/10 text-error',
  },
};

// Linear happy-path used to render the progress timeline in the sidebar.
// Branches (CANCELLED / RETURNED / REFUNDED / PAYMENT_FAILED) are
// reachable through TRANSITIONS below but do not appear on the timeline.
const STATUS_FLOW: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
];

// Mirrors OrdersService.VALID_TRANSITIONS in apps/api/src/modules/orders.
// Keep these two lists in sync — the API rejects any transition not
// listed here, so the admin select must not offer one either.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
  PAYMENT_FAILED: ['PENDING', 'CANCELLED'],
};

function computeAllowedNext(current: OrderStatus): OrderStatus[] {
  return [...(TRANSITIONS[current] ?? [])];
}

interface ItemSnapshot {
  name?: string;
  size?: string;
  color?: string;
  image?: string | null;
  bundleName?: string;
  bundleSize?: string;
  bundleImage?: string | null;
}

interface OrderItem {
  id: string;
  product?: { name: string; slug?: string; images?: string[] };
  productName?: string;
  variant?: { size?: string; color?: string };
  variantLabel?: string;
  quantity: number;
  unitPrice?: number | string | null;
  price?: number | string | null;
  total?: number | string | null;
  snapshot?: ItemSnapshot;
}

interface ShippingAddress {
  name?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  division?: string;
  postalCode?: string;
  zipCode?: string;
  phone?: string;
}

interface Order {
  id: string;
  orderNumber?: string;
  user?: {
    id?: string;
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phones?: string[];
  };
  customer?: { name?: string; email?: string; phones?: string[] };
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  items: OrderItem[];
  total: number | string;
  subtotal?: number | string | null;
  shippingCost?: number | string | null;
  status: OrderStatus;
  shippingAddress?: ShippingAddress;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// Prisma `Decimal` columns (total, subtotal, shippingCost, unitPrice) come
// across the wire as JSON strings, not numbers. Coerce safely before any math
// or formatting so the UI never silently renders BDT 0.00 for a real value.
function toMoney(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function Currency({
  amount,
  tone = 'default',
}: {
  amount: number | string | null | undefined;
  tone?: 'default' | 'inverse';
}) {
  const formatted = BDT_FORMATTER.format(toMoney(amount));
  return (
    <span className={tone === 'inverse' ? 'text-inverse-on-surface' : 'text-on-surface'}>
      {formatted}
    </span>
  );
}

// API returns firstName/lastName for registered patrons and guestName for
// guest checkouts. The admin payload no longer carries a flat `name`, so
// resolve the display name from whichever shape is present.
function getCustomerName(order: Order): string {
  const full = [order.user?.firstName, order.user?.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();
  return (
    full ||
    order.user?.name ||
    order.guestName ||
    order.customer?.name ||
    order.shippingAddress?.name ||
    ''
  );
}

function getCustomerEmail(order: Order): string {
  return order.user?.email || order.guestEmail || order.customer?.email || '';
}

function getCustomerPhone(order: Order): string {
  return (
    order.guestPhone ||
    order.shippingAddress?.phone ||
    order.user?.phones?.[0] ||
    order.customer?.phones?.[0] ||
    ''
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [actionBanner, setActionBanner] = useState<
    { tone: 'success' | 'error'; message: string } | null
  >(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<RefundReason>('REQUESTED_BY_CUSTOMER');
  const [refundNote, setRefundNote] = useState<string>('');
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Order>(`/orders/${orderId}`, token);
      setOrder(data);
      setSelectedStatus(data.status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const performStatusUpdate = async (next: OrderStatus) => {
    if (!token) return;
    setUpdatingStatus(true);
    setActionBanner(null);
    try {
      await adminFetch(`/orders/admin/${orderId}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      await fetchOrder();
      setActionBanner({ tone: 'success', message: 'Status updated.' });
    } catch (err: unknown) {
      setActionBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to update status',
      });
    } finally {
      setUpdatingStatus(false);
      setStatusConfirmOpen(false);
      setPendingStatus(null);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus || !order || selectedStatus === order.status) return;
    const allowed = computeAllowedNext(order.status);
    if (!allowed.includes(selectedStatus)) {
      setActionBanner({
        tone: 'error',
        message: `Cannot transition from ${order.status} to ${selectedStatus}.`,
      });
      return;
    }
    if (selectedStatus === 'CANCELLED') {
      setPendingStatus(selectedStatus);
      setStatusConfirmOpen(true);
      return;
    }
    await performStatusUpdate(selectedStatus);
  };

  const openRefundDialog = () => {
    if (!order) return;
    setRefundAmount(toMoney(order.total).toFixed(2));
    setRefundReason('REQUESTED_BY_CUSTOMER');
    setRefundNote('');
    setRefundOpen(true);
  };

  const handleRefundSubmit = () => {
    const parsed = Number.parseFloat(refundAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setActionBanner({ tone: 'error', message: 'Enter a valid refund amount.' });
      return;
    }
    if (order && parsed > toMoney(order.total)) {
      setActionBanner({
        tone: 'error',
        message: 'Refund cannot exceed order total.',
      });
      return;
    }
    setRefundConfirmOpen(true);
  };

  const handleRefundConfirm = async () => {
    if (!token || !order) return;
    setRefundBusy(true);
    setActionBanner(null);
    try {
      const amount = Number.parseFloat(refundAmount);
      await adminFetch(`/orders/${orderId}/refund`, token, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          reason: refundReason,
          note: refundNote,
        }),
      });
      setRefundConfirmOpen(false);
      setRefundOpen(false);
      await fetchOrder();
      setActionBanner({ tone: 'success', message: 'Refund issued successfully.' });
    } catch (err: unknown) {
      setActionBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to issue refund',
      });
    } finally {
      setRefundBusy(false);
    }
  };

  const escapeHtml = (s: string): string =>
    s.replace(/[&<>"']/g, (c) => {
      switch (c) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return c;
      }
    });

  const handleDownloadInvoice = () => {
    if (!order) return;
    try {
      const win = window.open('', '_blank', 'width=800,height=900');
      if (!win) {
        setActionBanner({
          tone: 'error',
          message: 'Could not open invoice window. Check pop-up settings.',
        });
        return;
      }
      const displayId = escapeHtml(order.orderNumber ?? order.id.slice(0, 8).toUpperCase());
      const addr = order.shippingAddress;
      const customerName = escapeHtml(getCustomerName(order));
      const customerEmail = escapeHtml(getCustomerEmail(order));
      const addrLine1 = addr ? escapeHtml(addr.address ?? addr.street ?? '') : '';
      const addrLine2 = addr
        ? escapeHtml(
            [addr.city, addr.state ?? addr.division, addr.postalCode ?? addr.zipCode]
              .filter(Boolean)
              .join(', '),
          )
        : '';
      const itemsHtml = order.items
        .map((it) => {
          const name = escapeHtml(it.product?.name ?? it.productName ?? 'Unknown Product');
          const unit = toMoney(it.unitPrice ?? it.price);
          const totalRaw = it.total != null ? toMoney(it.total) : 0;
          const total = totalRaw > 0 ? totalRaw : unit * it.quantity;
          return `<tr><td style="padding:8px;border-bottom:1px solid #eee">${name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(BDT_FORMATTER.format(unit))}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(BDT_FORMATTER.format(total))}</td></tr>`;
        })
        .join('');
      const subtotalLine = escapeHtml(
        BDT_FORMATTER.format(toMoney(order.subtotal ?? order.total)),
      );
      const shippingLine =
        order.shippingCost != null
          ? `<p>Shipping: ${escapeHtml(BDT_FORMATTER.format(toMoney(order.shippingCost)))}</p>`
          : '';
      const totalLine = escapeHtml(BDT_FORMATTER.format(toMoney(order.total)));
      const placed = escapeHtml(new Date(order.createdAt).toLocaleDateString());
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${displayId}</title><style>body{font-family:system-ui,sans-serif;padding:32px;color:#1b1c1c}h1{margin:0 0 4px;font-size:22px;letter-spacing:.1em;text-transform:uppercase}.muted{color:#666;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:24px}th{text-align:left;padding:8px;border-bottom:2px solid #111;font-size:11px;letter-spacing:.1em;text-transform:uppercase}.total{font-weight:700;font-size:16px}</style></head><body><h1>Denimisia</h1><p class="muted">Invoice</p><div style="margin-top:16px"><strong>Order #${displayId}</strong><br><span class="muted">Placed ${placed}</span></div><div style="margin-top:16px"><strong>Bill To</strong><br>${customerName}<br>${customerEmail}${addr ? `<br>${addrLine1}<br>${addrLine2}` : ''}</div><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table><div style="margin-top:24px;text-align:right"><p>Subtotal: ${subtotalLine}</p>${shippingLine}<p class="total">Total: ${totalLine}</p></div><script>window.onload=function(){window.print()}</script></body></html>`;
      const doc = win.document;
      doc.open();
      doc.writeln(html);
      doc.close();
    } catch (err: unknown) {
      setActionBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate invoice',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDisplayId = (o: Order): string => {
    return o.orderNumber ?? o.id.slice(0, 8).toUpperCase();
  };

  const getItemName = (item: OrderItem): string => {
    // Prefer the snapshot taken at order time so refunds / re-prints stay
    // accurate even if the product or bundle has been renamed since.
    return (
      item.snapshot?.bundleName ??
      item.snapshot?.name ??
      item.product?.name ??
      item.productName ??
      'Unknown Product'
    );
  };

  const getItemVariant = (item: OrderItem): string => {
    if (item.variantLabel) return item.variantLabel;
    const parts: string[] = [];
    const snapSize = item.snapshot?.bundleSize ?? item.snapshot?.size;
    const snapColor = item.snapshot?.color;
    if (item.variant?.size ?? snapSize) {
      parts.push((item.variant?.size ?? snapSize) as string);
    }
    if (item.variant?.color ?? snapColor) {
      parts.push((item.variant?.color ?? snapColor) as string);
    }
    return parts.length > 0 ? parts.join(' / ') : '—';
  };

  const getItemUnitPrice = (item: OrderItem): number => {
    return toMoney(item.unitPrice ?? item.price);
  };

  const getItemTotal = (item: OrderItem): number => {
    const explicit = item.total != null ? toMoney(item.total) : 0;
    return explicit > 0 ? explicit : getItemUnitPrice(item) * item.quantity;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
          Loading order...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6 px-4 py-3 bg-error/10 text-error text-xs font-semibold uppercase tracking-widest rounded-sm">
          {error || 'Order not found'}
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Orders
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING;
  const customerName = getCustomerName(order) || 'Unknown';
  const customerEmail = getCustomerEmail(order);
  const customerPhone = getCustomerPhone(order);
  const addr = order.shippingAddress;
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextTransitions = computeAllowedNext(order.status);
  const allowedStatuses: OrderStatus[] = [order.status, ...nextTransitions];
  // Refunds are gated off for the COD-only launch — there is no API
  // endpoint behind /orders/admin/:id/refund yet and cash returns are
  // handled by the courier physically. Flip this back to the real
  // status check once the backend refund flow ships.
  const REFUND_ENABLED = false;
  const canRefund =
    REFUND_ENABLED &&
    (order.status === 'DELIVERED' ||
      order.status === 'CANCELLED' ||
      order.status === 'SHIPPED');

  return (
    <>
      {/* Back link */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial mb-6"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to Orders
      </Link>

      {/* Header Section */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Order #{getDisplayId(order)}
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Placed {formatDate(order.createdAt)}
          </p>
          {/* Internal CUID kept visible on the admin detail page so ops
              can match it against logs / DB queries. The customer never
              sees this. */}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary/70">
            ID: {order.id}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest ${cfg.classes}`}
          >
            {cfg.label}
          </span>
          <button
            type="button"
            onClick={handlePrint}
            className="px-6 py-2 bg-surface-container-highest text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
          >
            Print
          </button>
        </div>
      </div>

      {actionBanner && (
        <Banner tone={actionBanner.tone} message={actionBanner.message} />
      )}

      {/* Status Timeline */}
      <div className="bg-surface-container-lowest rounded-sm shadow-[0_20px_40px_rgba(27,28,28,0.03)] border border-outline-variant/5 p-6 md:p-8 mb-10">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Lifecycle
          </p>
          <div className="flex items-center gap-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
              className="px-4 py-2 bg-surface-container text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary transition-colors duration-300 ease-editorial"
            >
              {allowedStatuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleStatusUpdate}
              disabled={updatingStatus || selectedStatus === order.status}
              className="px-6 py-2 bg-primary text-on-primary text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity duration-300 ease-editorial disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {updatingStatus ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {STATUS_FLOW.map((status, i) => {
            const isCompleted = i < currentIdx;
            const isCurrent = i === currentIdx;
            const stepClasses = isCurrent
              ? 'bg-inverse-surface text-inverse-on-surface'
              : isCompleted
                ? 'bg-surface-container text-on-surface'
                : 'bg-surface-container-high text-secondary';
            return (
              <div key={status} className="flex items-center flex-shrink-0">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-300 ease-editorial ${stepClasses}`}
                >
                  {isCompleted && (
                    <span className="material-symbols-outlined text-sm">check</span>
                  )}
                  {STATUS_CONFIG[status].label}
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div
                    className={`w-8 h-px mx-1 ${
                      i < currentIdx ? 'bg-on-surface/30' : 'bg-outline-variant/30'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main layout: items (left) + summary (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Items */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface-container-lowest rounded-sm shadow-[0_20px_40px_rgba(27,28,28,0.03)] overflow-hidden border border-outline-variant/5">
            <div className="px-6 py-5 flex items-center justify-between bg-surface-container-low/50 border-b border-outline-variant/10">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Items
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                {order.items.length}{' '}
                {order.items.length === 1 ? 'piece' : 'pieces'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                      Product
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                      Variant
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-center">
                      Qty
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-right">
                      Unit
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {order.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-container-low/50 transition-colors duration-300 ease-editorial"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-surface-container-high rounded-sm flex items-center justify-center flex-shrink-0 text-secondary">
                            <span className="material-symbols-outlined text-lg">
                              apparel
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-on-surface">
                            {getItemName(item)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-xs text-secondary font-medium tracking-wide">
                        {getItemVariant(item)}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-block px-3 py-1 bg-surface-container-high text-on-surface text-xs font-bold uppercase tracking-widest rounded-sm">
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-on-surface text-right">
                        <Currency amount={getItemUnitPrice(item)} />
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-on-surface text-right">
                        <Currency amount={getItemTotal(item)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-6 py-6 bg-surface-container-low/30 border-t border-outline-variant/10">
              <div className="ml-auto max-w-xs space-y-2">
                {order.subtotal != null && (
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest">
                    <span className="text-secondary">Subtotal</span>
                    <span className="text-on-surface">
                      <Currency amount={order.subtotal} />
                    </span>
                  </div>
                )}
                {order.shippingCost != null && (
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest">
                    <span className="text-secondary">Shipping</span>
                    <span className="text-on-surface">
                      <Currency amount={order.shippingCost} />
                    </span>
                  </div>
                )}
                <div className="pt-3 border-t border-outline-variant/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                      Total
                    </span>
                    <span className="font-headline text-xl font-semibold text-on-surface">
                      <Currency amount={order.total} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-3">
                Notes
              </p>
              <p className="text-sm text-on-surface leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Summary */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Customer */}
          <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-4">
              Patron
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">
                  Name
                </p>
                <p className="text-sm font-semibold text-on-surface">{customerName}</p>
              </div>
              {customerEmail && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">
                    Email
                  </p>
                  <p className="text-sm text-on-surface break-all">{customerEmail}</p>
                </div>
              )}
              {customerPhone && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">
                    Phone
                  </p>
                  <p className="text-sm text-on-surface">{customerPhone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-4">
              Dispatch Address
            </p>
            {addr ? (
              <div className="text-sm text-on-surface space-y-1 leading-relaxed">
                {addr.name && (
                  <p className="font-semibold">{addr.name}</p>
                )}
                {(addr.address ?? addr.street) && (
                  <p className="text-secondary">{addr.address ?? addr.street}</p>
                )}
                <p className="text-secondary">
                  {[
                    addr.city,
                    addr.state ?? addr.division,
                    addr.postalCode ?? addr.zipCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {addr.phone && (
                  <p className="text-secondary mt-2">
                    <span className="material-symbols-outlined text-sm align-middle mr-1">
                      call
                    </span>
                    {addr.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                No address provided
              </p>
            )}
          </div>

          {/* Payment */}
          {order.paymentMethod && (
            <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-3">
                Payment
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-surface-container-high rounded-sm flex items-center justify-center flex-shrink-0 text-secondary">
                  <span className="material-symbols-outlined text-lg">payments</span>
                </div>
                <p className="text-sm font-semibold text-on-surface">
                  {order.paymentMethod}
                </p>
              </div>
            </div>
          )}

          {/* Critical actions */}
          <div className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-1">
              Actions
            </p>
            {REFUND_ENABLED && (
              <button
                type="button"
                onClick={openRefundDialog}
                disabled={!canRefund}
                className="w-full px-6 py-2 bg-primary text-on-primary text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity duration-300 ease-editorial disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Issue Refund
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadInvoice}
              className="w-full px-6 py-2 bg-surface-container-highest text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
            >
              Download Invoice
            </button>
          </div>
        </aside>
      </div>

      <Modal
        open={refundOpen}
        onClose={() => (refundBusy ? undefined : setRefundOpen(false))}
        title="Issue Refund"
        description={`Refund for order #${getDisplayId(order)}`}
        width="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setRefundOpen(false)}
              disabled={refundBusy}
              className="px-5 py-2 bg-surface-container-highest text-on-surface text-xs font-semibold uppercase tracking-widest border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRefundSubmit}
              disabled={refundBusy}
              className="px-5 py-2 bg-primary text-on-primary text-xs font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity duration-300 ease-editorial disabled:opacity-40"
            >
              Review & Confirm
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="refund-amount"
              className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2"
            >
              Amount (BDT)
            </label>
            <input
              id="refund-amount"
              type="number"
              min="0"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              disabled={refundBusy}
              className="w-full px-4 py-2 bg-surface-container text-on-surface text-sm border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary transition-colors duration-300 ease-editorial"
            />
          </div>
          <div>
            <label
              htmlFor="refund-reason"
              className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2"
            >
              Reason
            </label>
            <select
              id="refund-reason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value as RefundReason)}
              disabled={refundBusy}
              className="w-full px-4 py-2 bg-surface-container text-on-surface text-sm border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary transition-colors duration-300 ease-editorial"
            >
              {REFUND_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="refund-note"
              className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2"
            >
              Note
            </label>
            <textarea
              id="refund-note"
              rows={3}
              value={refundNote}
              onChange={(e) => setRefundNote(e.target.value)}
              disabled={refundBusy}
              className="w-full px-4 py-2 bg-surface-container text-on-surface text-sm border border-outline-variant/15 rounded-sm focus:outline-none focus:border-primary transition-colors duration-300 ease-editorial resize-none"
              placeholder="Optional internal note"
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={refundConfirmOpen}
        onCancel={() => (refundBusy ? undefined : setRefundConfirmOpen(false))}
        onConfirm={handleRefundConfirm}
        title="Confirm Refund"
        message={`Refund ${BDT_FORMATTER.format(Number.parseFloat(refundAmount) || 0)} for order #${getDisplayId(order)}? This action cannot be undone.`}
        confirmLabel="Issue Refund"
        tone="danger"
        busy={refundBusy}
      />

      <ConfirmModal
        open={statusConfirmOpen && pendingStatus !== null}
        onCancel={() =>
          updatingStatus
            ? undefined
            : (setStatusConfirmOpen(false), setPendingStatus(null))
        }
        onConfirm={() => {
          if (pendingStatus) {
            void performStatusUpdate(pendingStatus);
          }
        }}
        title={pendingStatus === 'CANCELLED' ? 'Cancel Order' : 'Confirm Status Change'}
        message={
          pendingStatus === 'CANCELLED'
            ? `Cancel order #${getDisplayId(order)}? This cannot be undone.`
            : `Transition order #${getDisplayId(order)} to ${pendingStatus}?`
        }
        confirmLabel={pendingStatus === 'CANCELLED' ? 'Cancel Order' : 'Confirm'}
        tone="danger"
        busy={updatingStatus}
      />
    </>
  );
}
