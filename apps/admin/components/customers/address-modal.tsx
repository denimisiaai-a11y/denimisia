'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { Banner } from '@/components/admin-ui';
import { adminFetch } from '@/lib/api';

interface Address {
  id?: string;
  label?: string | null;
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
}

interface AddressModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly token: string;
  readonly customerId: string;
  readonly customer: { firstName: string; lastName: string };
  readonly initial?: Address;
  readonly onSaved: () => void;
}

const EMPTY: Address = {
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

export function AddressModal({
  open,
  onClose,
  token,
  customerId,
  customer,
  initial,
  onSaved,
}: AddressModalProps) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<Address>(() => ({
    ...EMPTY,
    firstName: customer.firstName,
    lastName: customer.lastName,
    ...(initial ?? {}),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === 'isDefault' ? (e.target as HTMLInputElement).checked : e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        label: form.label,
        firstName: form.firstName,
        lastName: form.lastName,
        line1: form.line1,
        line2: form.line2 || undefined,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country,
        phone: form.phone || undefined,
        isDefault: form.isDefault ?? false,
      };
      const path = isEdit
        ? `/users/${customerId}/addresses/${initial!.id}`
        : `/users/${customerId}/addresses`;
      await adminFetch(path, token, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Address' : 'Add Address'}
      description={isEdit ? 'Update saved address details.' : 'Save a new shipping address for this customer.'}
      width="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Banner tone="error" message={error} />}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">Label</label>
            <select
              value={form.label ?? 'HOME'}
              onChange={set('label')}
              className="w-full bg-surface-container px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy}
            >
              <option value="HOME">Home</option>
              <option value="WORK">Work</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">First name</label>
            <input
              type="text" value={form.firstName ?? ''} onChange={set('firstName')}
              className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy} required
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">Last name</label>
            <input
              type="text" value={form.lastName ?? ''} onChange={set('lastName')}
              className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy} required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">Address line 1</label>
          <input
            type="text" value={form.line1} onChange={set('line1')}
            className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={busy} required
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">Address line 2 (optional)</label>
          <input
            type="text" value={form.line2 ?? ''} onChange={set('line2')}
            className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={busy}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">City</label>
            <input
              type="text" value={form.city} onChange={set('city')}
              className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy} required
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">District / State</label>
            <input
              type="text" value={form.state} onChange={set('state')}
              className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy} required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">Postal code</label>
            <input
              type="text" value={form.postalCode} onChange={set('postalCode')}
              className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy} required
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">Country</label>
            <input
              type="text" value={form.country} onChange={set('country')}
              className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy} required
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">Phone (optional)</label>
          <input
            type="tel" value={form.phone ?? ''} onChange={set('phone')}
            className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={busy}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox" checked={form.isDefault ?? false} onChange={set('isDefault')}
            className="h-4 w-4" disabled={busy}
          />
          Set as default address
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button" onClick={onClose} disabled={busy}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit" disabled={busy}
            className="bg-on-surface px-5 py-2 text-xs font-semibold uppercase tracking-widest text-surface hover:bg-on-surface/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : isEdit ? 'Save' : 'Add Address'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
