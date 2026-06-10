'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { Banner } from '@/components/admin-ui';
import { adminFetch } from '@/lib/api';

interface EditProfileModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly token: string;
  readonly customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phones?: string[];
    claimedAt?: string | null;
  };
  readonly onSaved: () => void;
}

export function EditProfileModal({
  open,
  onClose,
  token,
  customer,
  onSaved,
}: EditProfileModalProps) {
  const [firstName, setFirstName] = useState(customer.firstName ?? '');
  const [lastName, setLastName] = useState(customer.lastName ?? '');
  const [email, setEmail] = useState(customer.email ?? '');
  const [phone, setPhone] = useState(customer.phones?.[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isClaimed = customer.claimedAt !== null && customer.claimedAt !== undefined;
  const emailChanged = email.trim().toLowerCase() !== customer.email.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body: Record<string, string | undefined> = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
      };
      if (emailChanged) body.email = email.trim();
      const currentPhone = customer.phones?.[0] ?? '';
      if (phone.trim() && phone.trim() !== currentPhone) {
        body.phone = phone.trim();
      }
      await adminFetch(`/users/${customer.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Profile"
      description={
        emailChanged && isClaimed
          ? 'Changing the email of a claimed account forces the customer to log in again.'
          : 'Update the customer’s name, email, or phone.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Banner tone="error" message={error} />}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
              First name
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-surface-container px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
              Last name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-surface-container px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface-container px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={busy}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
            Phone (Bangladesh)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="w-full bg-surface-container px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={busy}
          />
          {customer.phones && customer.phones.length > 1 && (
            <p className="mt-1 text-xs text-secondary">
              Saving a new phone prepends to history; previous numbers are kept.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-on-surface px-5 py-2 text-xs font-semibold uppercase tracking-widest text-surface hover:bg-on-surface/90 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
