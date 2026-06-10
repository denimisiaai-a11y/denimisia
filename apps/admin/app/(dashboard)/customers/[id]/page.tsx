'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';
import { EditProfileModal } from '@/components/customers/edit-profile-modal';
import { AddressModal } from '@/components/customers/address-modal';

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number | string;
  createdAt: string;
  _count: { items: number };
}

interface CustomerAddress {
  id: string;
  firstName?: string;
  lastName?: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault?: boolean;
  label?: string | null;
}

interface CustomerDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phones?: string[];
  role: string;
  isVerified: boolean;
  claimedAt?: string | null;
  createdAt: string;
  addresses?: CustomerAddress[];
  orders?: CustomerOrder[];
  _count?: { orders: number; reviews: number };
  totalSpent?: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatBdt(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `BDT ${n.toLocaleString()}`;
}

function orderStatusClasses(status: string): string {
  switch (status) {
    case 'DELIVERED':
      return 'bg-surface-container text-on-surface';
    case 'CANCELLED':
    case 'REFUNDED':
    case 'PAYMENT_FAILED':
      return 'bg-error/10 text-error';
    case 'SHIPPED':
      return 'bg-inverse-surface text-inverse-on-surface';
    case 'PROCESSING':
    case 'CONFIRMED':
      return 'bg-primary/10 text-primary';
    default:
      return 'bg-surface-container-highest text-on-surface';
  }
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressBeingEdited, setAddressBeingEdited] = useState<CustomerAddress | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<CustomerDetail>(`/users/${id}`, token);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer');
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteAddress = async (addressId: string) => {
    if (!token || !customer) return;
    if (!confirm('Delete this address? This cannot be undone.')) return;
    setDeletingAddressId(addressId);
    try {
      await adminFetch(`/users/${customer.id}/addresses/${addressId}`, token, {
        method: 'DELETE',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete address');
    } finally {
      setDeletingAddressId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-secondary">Loading customer…</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8">
        <Banner tone="error" message={error || 'Customer not found'} />
        <Link href="/customers" className="mt-4 inline-block text-sm text-primary underline">
          ← Back to customers
        </Link>
      </div>
    );
  }

  const fullName = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || customer.email;
  const isShadow = customer.claimedAt === null || customer.claimedAt === undefined;
  const totalOrders = customer._count?.orders ?? 0;
  const recentOrders = customer.orders ?? [];

  return (
    <div className="p-8">
      <Link href="/customers" className="mb-6 inline-block text-xs uppercase tracking-widest text-secondary hover:text-on-surface">
        ← All customers
      </Link>

      <header className="mb-8 flex items-start justify-between border-b border-outline-variant/20 pb-6">
        <div>
          <h1 className="font-headline text-3xl font-semibold">{fullName}</h1>
          <p className="mt-1 text-sm text-secondary">{customer.email}</p>
          <div className="mt-3 flex gap-2 text-[10px] uppercase tracking-[0.15em]">
            <span className="rounded bg-surface-container px-2 py-1 text-secondary">{customer.role}</span>
            {isShadow ? (
              <span className="rounded bg-surface-container-highest px-2 py-1 text-secondary" title="Customer hasn't signed up yet">
                Shadow
              </span>
            ) : (
              <span className="rounded bg-primary/10 px-2 py-1 text-primary">Claimed</span>
            )}
            {customer.isVerified && (
              <span className="rounded bg-surface-container px-2 py-1 text-secondary">Verified</span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-6">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Total Contribution</p>
            <p className="mt-1 font-headline text-2xl font-semibold">{formatBdt(customer.totalSpent ?? 0)}</p>
            <p className="mt-1 text-xs text-secondary">{totalOrders} {totalOrders === 1 ? 'order' : 'orders'}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditProfileOpen(true)}
            className="border border-outline-variant/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-on-surface hover:bg-surface-container"
          >
            Edit Profile
          </button>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="atelier-shadow bg-surface-container-lowest p-6">
          <h2 className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Profile</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-secondary">Joined</dt>
              <dd>{formatDate(customer.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Claimed</dt>
              <dd>{customer.claimedAt ? formatDate(customer.claimedAt) : '— (shadow)'}</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Phone</dt>
              <dd>{customer.phones?.[0] ?? '—'}</dd>
            </div>
            {(customer.phones?.length ?? 0) > 1 && (
              <div>
                <dt className="text-xs text-secondary">Previous phones</dt>
                <dd className="font-mono text-xs">
                  {customer.phones?.slice(1).join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="atelier-shadow bg-surface-container-lowest p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Addresses</h2>
            <button
              type="button"
              onClick={() => {
                setAddressBeingEdited(null);
                setAddressModalOpen(true);
              }}
              className="text-[10px] font-semibold uppercase tracking-widest text-on-surface hover:text-primary"
            >
              + Add
            </button>
          </div>
          {(customer.addresses?.length ?? 0) === 0 ? (
            <p className="text-sm text-secondary">No saved addresses.</p>
          ) : (
            <ul className="space-y-4 text-sm">
              {customer.addresses!.map((a) => (
                <li key={a.id} className="border-l-2 border-outline-variant/20 pl-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {a.label && (
                        <p className="text-xs font-semibold uppercase text-secondary">
                          {a.label} {a.isDefault && '(default)'}
                        </p>
                      )}
                      <p>{a.line1}</p>
                      {a.line2 && <p>{a.line2}</p>}
                      <p>{a.city}, {a.state} {a.postalCode}, {a.country}</p>
                      {a.phone && <p className="mt-1 text-xs text-secondary">{a.phone}</p>}
                    </div>
                    <div className="flex shrink-0 gap-3 text-[10px] font-semibold uppercase tracking-widest">
                      <button
                        type="button"
                        onClick={() => {
                          setAddressBeingEdited(a);
                          setAddressModalOpen(true);
                        }}
                        className="text-secondary hover:text-on-surface"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(a.id)}
                        disabled={deletingAddressId === a.id}
                        className="text-secondary hover:text-error disabled:opacity-50"
                      >
                        {deletingAddressId === a.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-headline text-xl font-semibold">
            Order history {totalOrders > 0 && <span className="text-sm font-normal text-secondary">({totalOrders} total{recentOrders.length < totalOrders ? `, showing ${recentOrders.length} most recent` : ''})</span>}
          </h2>
        </div>
        {recentOrders.length === 0 ? (
          <div className="atelier-shadow bg-surface-container-lowest p-12 text-center">
            <p className="text-sm text-secondary">No orders yet.</p>
          </div>
        ) : (
          <div className="atelier-shadow bg-surface-container-lowest">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/10 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  <th className="px-6 py-3">Order #</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Items</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-outline-variant/5 hover:bg-surface-container-low">
                    <td className="px-6 py-4">
                      <Link href={`/orders/${o.id}`} className="font-mono text-sm font-semibold text-on-surface hover:text-primary">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary">{formatDate(o.createdAt)}</td>
                    <td className="px-6 py-4 text-sm">{o._count.items}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${orderStatusClasses(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm">{formatBdt(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {token && (
        <EditProfileModal
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          token={token}
          customer={customer}
          onSaved={load}
        />
      )}

      {token && (
        <AddressModal
          open={addressModalOpen}
          onClose={() => {
            setAddressModalOpen(false);
            setAddressBeingEdited(null);
          }}
          token={token}
          customerId={customer.id}
          customer={{ firstName: customer.firstName, lastName: customer.lastName }}
          initial={addressBeingEdited ?? undefined}
          onSaved={load}
        />
      )}
    </div>
  );
}
