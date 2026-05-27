'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/modal';
import { Banner, PrimaryButton } from '@/components/admin-ui';
import { adminFetch } from '@/lib/api';
import { PAGE_PERMISSIONS } from '@/lib/permissions';
import { STAFF_ROLES, roleLabel, type StaffRole } from '@/lib/roles';

interface InviteAdminModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly token: string;
  readonly onCreated: () => void;
}

// Group permission entries by their `group` so the picker mirrors the
// sidebar layout. Keep the visual order stable across renders.
function groupPermissions() {
  const groups = new Map<string, typeof PAGE_PERMISSIONS[number][]>();
  for (const perm of PAGE_PERMISSIONS) {
    const bucket = groups.get(perm.group) ?? [];
    bucket.push(perm);
    groups.set(perm.group, bucket);
  }
  return Array.from(groups.entries());
}

export function InviteAdminModal({
  open,
  onClose,
  token,
  onCreated,
}: InviteAdminModalProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('MANAGER');
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [grantAll, setGrantAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const grouped = useMemo(() => groupPermissions(), []);
  const allSlugs = useMemo(
    () => PAGE_PERMISSIONS.map((p) => p.slug),
    [],
  );

  const togglePermission = (slug: string) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleGroup = (groupSlugs: string[]) => {
    const allOn = groupSlugs.every((s) => permissions.has(s));
    setPermissions((prev) => {
      const next = new Set(prev);
      if (allOn) groupSlugs.forEach((s) => next.delete(s));
      else groupSlugs.forEach((s) => next.add(s));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !firstName.trim() || !password) {
      setError('Email, first name, and password are required.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (role === 'SUPER_ADMIN' && !grantAll) {
      setError('SUPER_ADMIN always has full access — leave "Grant all pages" on.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        password,
        role,
        permissions: grantAll ? allSlugs : Array.from(permissions),
      };
      await adminFetch('/users/staff', token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated();
      onClose();
      // Reset for the next invite.
      setEmail('');
      setFirstName('');
      setLastName('');
      setPassword('');
      setRole('MANAGER');
      setPermissions(new Set());
      setGrantAll(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite Admin"
      description="Create a staff account with a starter password. They can log in immediately with these credentials."
      width="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Banner tone="error" message={error} />}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
              First name
            </label>
            <input
              type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy} required
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
              Last name (optional)
            </label>
            <input
              type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={busy}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
            Email (used to log in)
          </label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={busy} required autoComplete="off"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
            Starter password (12+ characters)
          </label>
          <input
            type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface-container px-4 py-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={busy} required autoComplete="new-password" minLength={12}
            placeholder="generate or type a strong password"
          />
          <p className="mt-1 text-[11px] text-secondary">
            Share this securely (e.g. Signal / 1Password). The new admin should change it on first login.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => {
              const r = e.target.value as StaffRole;
              setRole(r);
              if (r === 'SUPER_ADMIN') setGrantAll(true);
            }}
            className="w-full bg-surface-container px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={busy}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(r)}</option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-secondary">
            SUPER_ADMIN bypasses all page restrictions. Other roles only see the pages you tick below.
          </p>
        </div>

        <div className="border-t border-outline-variant/10 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
              Page access
            </p>
            <label className="flex items-center gap-2 text-xs text-on-surface">
              <input
                type="checkbox" checked={grantAll}
                onChange={(e) => setGrantAll(e.target.checked)}
                disabled={busy || role === 'SUPER_ADMIN'}
                className="h-4 w-4"
              />
              Grant all pages
            </label>
          </div>

          {!grantAll && (
            <div className="max-h-72 space-y-3 overflow-y-auto rounded border border-outline-variant/20 bg-surface-container-low p-3">
              {grouped.map(([groupName, items]) => {
                const groupSlugs = items.map((i) => i.slug);
                const allOn = groupSlugs.every((s) => permissions.has(s));
                const someOn = !allOn && groupSlugs.some((s) => permissions.has(s));
                return (
                  <div key={groupName}>
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-secondary">
                      <input
                        type="checkbox" checked={allOn}
                        ref={(el) => { if (el) el.indeterminate = someOn; }}
                        onChange={() => toggleGroup(groupSlugs)}
                        disabled={busy}
                        className="h-3.5 w-3.5"
                      />
                      {groupName}
                    </label>
                    <div className="mt-1 grid grid-cols-2 gap-1 pl-5">
                      {items.map((item) => (
                        <label key={item.slug} className="flex items-center gap-2 text-xs text-on-surface">
                          <input
                            type="checkbox" checked={permissions.has(item.slug)}
                            onChange={() => togglePermission(item.slug)}
                            disabled={busy}
                            className="h-3.5 w-3.5"
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button" onClick={onClose} disabled={busy}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary hover:text-on-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create Account'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
