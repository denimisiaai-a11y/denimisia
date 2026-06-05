'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface Address {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
}

interface AddressFormData {
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressFormData = {
  label: 'HOME',
  firstName: '',
  lastName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'Bangladesh',
  phone: '',
  isDefault: false,
};

const LABEL_OPTIONS = ['HOME', 'WORK', 'OTHER'] as const;

export default function AddressesPage() {
  const { data: session } = useSession();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const userId = session?.user?.id;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddressFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchAddresses = useCallback(async () => {
    if (!accessToken || !userId) return;
    try {
      const res = await fetch(`${API}/users/me/addresses`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      // Stale API JWT — force re-login instead of silently showing no addresses.
      if (res.status === 401) {
        window.location.href = '/api/auth/expire';
        return;
      }
      const json = await res.json();
      if (json.success) {
        setAddresses(json.data ?? []);
      }
    } catch {
      // silently fail — addresses remain empty
    } finally {
      setLoading(false);
    }
  }, [accessToken, userId]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const updateField = useCallback(
    <K extends keyof AddressFormData>(field: K, value: AddressFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
    setFeedback(null);
  };

  const handleOpenEdit = (addr: Address) => {
    setEditingId(addr.id);
    setFormData({
      label: addr.label,
      firstName: addr.firstName,
      lastName: addr.lastName,
      line1: addr.line1,
      line2: addr.line2 ?? '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone ?? '',
      isDefault: addr.isDefault,
    });
    setShowForm(true);
    setFeedback(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!accessToken || !userId) return;

    // Basic validation
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.line1.trim() || !formData.city.trim() || !formData.state.trim() || !formData.postalCode.trim()) {
      setFeedback({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const payload = {
      label: formData.label,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      line1: formData.line1.trim(),
      line2: formData.line2.trim() || undefined,
      city: formData.city.trim(),
      state: formData.state.trim(),
      postalCode: formData.postalCode.trim(),
      country: formData.country.trim(),
      phone: formData.phone.trim() || undefined,
      isDefault: formData.isDefault,
    };

    try {
      const isEdit = editingId !== null;
      const url = isEdit
        ? `${API}/users/me/addresses/${editingId}`
        : `${API}/users/me/addresses`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setFeedback({ type: 'error', message: json.message ?? 'Failed to save address.' });
        setSaving(false);
        return;
      }

      setFeedback({ type: 'success', message: isEdit ? 'Address updated.' : 'Address added.' });
      setShowForm(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
      await fetchAddresses();
    } catch {
      setFeedback({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!accessToken || !userId) return;
    setDeletingId(addressId);
    setFeedback(null);

    try {
      const res = await fetch(`${API}/users/me/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setFeedback({ type: 'error', message: (json as any).message ?? 'Failed to delete address.' });
        setDeletingId(null);
        return;
      }

      setFeedback({ type: 'success', message: 'Address deleted.' });
      await fetchAddresses();
    } catch {
      setFeedback({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass =
    'w-full border border-border bg-transparent px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none transition-colors';
  const labelClass = 'block text-xs font-semibold uppercase tracking-[0.1em] text-muted mb-1';

  if (loading) {
    return (
      <div>
        <h2 className="mb-6 text-lg font-medium uppercase tracking-[0.1em] text-ink">Addresses</h2>
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium uppercase tracking-[0.1em] text-ink">Addresses</h2>
        {!showForm && (
          <button
            onClick={handleOpenAdd}
            className="text-xs font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-ink"
          >
            + Add Address
          </button>
        )}
      </div>

      {/* Feedback */}
      {feedback?.type === 'success' && (
        <div className="mb-4 border border-ink/20 bg-muted-bg px-4 py-3 text-sm text-ink">
          {feedback.message}
        </div>
      )}
      {feedback?.type === 'error' && (
        <div className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {feedback.message}
        </div>
      )}

      {/* Inline Add/Edit form */}
      {showForm && (
        <div className="mb-8 border border-border p-6">
          <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.1em] text-ink">
            {editingId ? 'Edit Address' : 'New Address'}
          </h3>

          <div className="space-y-4">
            {/* Label select */}
            <div>
              <label className={labelClass}>Label</label>
              <select
                value={formData.label}
                onChange={(e) => updateField('label', e.target.value)}
                className={inputClass}
              >
                {LABEL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* First / Last name */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  className={inputClass}
                  placeholder="First name"
                />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  className={inputClass}
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Line 1 */}
            <div>
              <label className={labelClass}>Address Line 1 *</label>
              <input
                type="text"
                value={formData.line1}
                onChange={(e) => updateField('line1', e.target.value)}
                className={inputClass}
                placeholder="Street address"
              />
            </div>

            {/* Line 2 */}
            <div>
              <label className={labelClass}>Address Line 2</label>
              <input
                type="text"
                value={formData.line2}
                onChange={(e) => updateField('line2', e.target.value)}
                className={inputClass}
                placeholder="Apartment, suite, etc. (optional)"
              />
            </div>

            {/* City / State */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  className={inputClass}
                  placeholder="City"
                />
              </div>
              <div>
                <label className={labelClass}>State / Division *</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => updateField('state', e.target.value)}
                  className={inputClass}
                  placeholder="State or division"
                />
              </div>
            </div>

            {/* Postal Code / Country */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Postal Code *</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  className={inputClass}
                  placeholder="Postal code"
                />
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  className={inputClass}
                  placeholder="Country"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className={inputClass}
                placeholder="Phone number (optional)"
              />
            </div>

            {/* Default checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => updateField('isDefault', e.target.checked)}
                className="h-4 w-4 accent-ink"
              />
              <span className="text-sm text-ink">Set as default address</span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'bg-ink px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-ink/90',
                  saving && 'cursor-wait opacity-70',
                )}
              >
                {saving ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 && !showForm ? (
        <p className="text-sm text-muted">No saved addresses.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <div key={addr.id} className="border border-border p-5">
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {addr.isDefault && (
                    <span className="inline-block bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-paper">
                      Default
                    </span>
                  )}
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    {addr.label}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleOpenEdit(addr)}
                    className="text-xs font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-ink"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    disabled={deletingId === addr.id}
                    className={cn(
                      'text-xs font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-red-600',
                      deletingId === addr.id && 'cursor-wait opacity-50',
                    )}
                  >
                    {deletingId === addr.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-ink">
                {addr.firstName} {addr.lastName}
              </p>
              <p className="mt-1 text-sm text-muted">{addr.line1}</p>
              {addr.line2 && <p className="text-sm text-muted">{addr.line2}</p>}
              <p className="text-sm text-muted">
                {addr.city}, {addr.state} {addr.postalCode}
              </p>
              <p className="text-sm text-muted">{addr.country}</p>
              {addr.phone && <p className="mt-1 text-xs text-muted">{addr.phone}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
