'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  EmptyState,
  IconButton,
  PrimaryButton,
  SkeletonList,
  StatusChip,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';
import { Modal, ConfirmModal } from '@/components/modal';
import { Field, Select } from '@/components/form';
import { InviteAdminModal } from '@/components/staff/invite-admin-modal';

type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN' | 'STAFF';

const ASSIGNABLE_ROLES: readonly UserRole[] = ['STAFF', 'ADMIN', 'SUPER_ADMIN'];

interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly isVerified: boolean;
  readonly createdAt: string;
  readonly _count?: { readonly orders: number };
}

interface UsersResponse {
  readonly users: readonly AdminUser[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

const STAFF_ROLES: readonly UserRole[] = ['ADMIN', 'SUPER_ADMIN', 'STAFF'];
const PAGE_SIZE = 25;

function roleTone(role: UserRole): 'danger' | 'warning' | 'info' | 'neutral' {
  if (role === 'SUPER_ADMIN') return 'danger';
  if (role === 'ADMIN') return 'warning';
  if (role === 'STAFF') return 'info';
  return 'neutral';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const currentRole = session?.user?.role;
  const currentEmail = session?.user?.email;
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const [users, setUsers] = useState<readonly AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AdminUser | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<UsersResponse>(
        `/users?page=${page}&limit=${PAGE_SIZE}`,
        token,
      );
      const staff = data.users.filter((u) => STAFF_ROLES.includes(u.role));
      setUsers(staff);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    // Defense-in-depth: only SUPER_ADMIN may manage admin accounts. Skip fetch otherwise.
    if (!isSuperAdmin) return;
    void load();
  }, [load, isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <PageShell
        title="Admin Users"
        description="Staff with elevated access."
        breadcrumbs={[{ label: 'System' }, { label: 'Admin Users' }]}
      >
        <Banner
          tone="error"
          message="Only Super Admins can manage admin accounts."
        />
      </PageShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Defence-in-depth: a regular ADMIN cannot modify SUPER_ADMIN accounts.
  const canModify = (target: AdminUser): boolean => {
    if (target.role === 'SUPER_ADMIN' && !isSuperAdmin) return false;
    return true;
  };

  const confirmDeactivate = async () => {
    if (!token || !deactivateTarget) return;
    setDeactivating(true);
    try {
      await adminFetch(`/users/${deactivateTarget.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      setDeactivateTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deactivate failed');
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <PageShell
      title="Admin Users"
      description="Staff with elevated access — admins, super admins, and operational staff."
      breadcrumbs={[{ label: 'System' }, { label: 'Admin Users' }]}
      actions={
        isSuperAdmin ? (
          <PrimaryButton icon="person_add" onClick={() => setInviteOpen(true)}>
            Invite Admin
          </PrimaryButton>
        ) : null
      }
    >
      {error && <Banner tone="error" message={error} />}

      <SurfaceCard>
        <SurfaceHeader>
          {loading
            ? 'Loading…'
            : `${users.length} staff accounts · page ${page} of ${totalPages}`}
        </SurfaceHeader>

        {loading ? (
          <SkeletonList rowHeight={72} />
        ) : users.length === 0 ? (
          <EmptyState
            icon="admin_panel_settings"
            label="No staff users"
            description="Invite an admin to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/15 bg-surface-container-low/50">
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const locked = !canModify(u);
                  const lockTitle = locked ? 'Only SUPER_ADMIN can modify' : undefined;
                  const isSelf = Boolean(currentEmail) && u.email === currentEmail;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-outline-variant/10 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center bg-surface-container font-headline text-[10px] font-bold uppercase text-on-surface">
                            {(u.firstName[0] ?? '') + (u.lastName[0] ?? '')}
                          </div>
                          <span className="font-body text-sm font-semibold text-on-surface">
                            {u.firstName} {u.lastName}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-secondary">{u.email}</span>
                      </Td>
                      <Td>
                        <StatusChip label={u.role.replaceAll('_', ' ')} tone={roleTone(u.role)} />
                      </Td>
                      <Td>
                        <StatusChip
                          label={u.isVerified ? 'Verified' : 'Pending'}
                          tone={u.isVerified ? 'success' : 'warning'}
                        />
                      </Td>
                      <Td>
                        <span className="font-body text-xs text-secondary">
                          {formatDate(u.createdAt)}
                        </span>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1" title={lockTitle}>
                          <IconButton
                            icon="edit"
                            label={locked ? 'Edit role (locked — only SUPER_ADMIN)' : 'Edit role'}
                            onClick={locked ? undefined : () => setEditTarget(u)}
                          />
                          {!isSelf && (
                            <IconButton
                              icon="block"
                              label={
                                locked
                                  ? 'Deactivate (locked — only SUPER_ADMIN)'
                                  : 'Deactivate'
                              }
                              tone="danger"
                              onClick={locked ? undefined : () => setDeactivateTarget(u)}
                            />
                          )}
                          {isSelf && (
                            <span
                              title="Cannot deactivate your own account"
                              aria-label="Cannot deactivate your own account"
                              className="flex h-8 w-8 items-center justify-center text-outline-variant/50"
                            >
                              <span className="material-symbols-outlined text-base" aria-hidden>
                                block
                              </span>
                            </span>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-outline-variant/15 px-6 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
              {total.toLocaleString()} total · page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border border-outline-variant/30 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 ease-editorial hover:border-on-surface hover:text-on-surface disabled:opacity-40 disabled:hover:border-outline-variant/30 disabled:hover:text-secondary"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border border-outline-variant/30 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 ease-editorial hover:border-on-surface hover:text-on-surface disabled:opacity-40 disabled:hover:border-outline-variant/30 disabled:hover:text-secondary"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SurfaceCard>

      <EditRoleModal
        user={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          void load();
        }}
      />

      <ConfirmModal
        open={deactivateTarget !== null}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate account?"
        message={
          deactivateTarget
            ? `${deactivateTarget.firstName} ${deactivateTarget.lastName} will lose admin access immediately.`
            : ''
        }
        confirmLabel="Deactivate"
        tone="danger"
        busy={deactivating}
      />

      {token && isSuperAdmin && (
        <InviteAdminModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          token={token}
          onCreated={() => load()}
        />
      )}
    </PageShell>
  );
}

interface EditRoleModalProps {
  readonly user: AdminUser | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

function EditRoleModal({ user, onClose, onSaved }: EditRoleModalProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';

  const [role, setRole] = useState<UserRole>('STAFF');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmEscalation, setConfirmEscalation] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setFormError('');
      setConfirmEscalation(false);
    }
  }, [user]);

  const persist = async () => {
    if (!token || !user) return;
    setSubmitting(true);
    setFormError('');
    try {
      await adminFetch(`/users/${user.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setConfirmEscalation(false);
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    // Escalating a user to SUPER_ADMIN deserves an explicit confirmation step.
    if (role === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN') {
      setConfirmEscalation(true);
      return;
    }
    await persist();
  };

  // Only SUPER_ADMINs can assign the SUPER_ADMIN role.
  const availableRoles = isSuperAdmin
    ? ASSIGNABLE_ROLES
    : ASSIGNABLE_ROLES.filter((r) => r !== 'SUPER_ADMIN');

  return (
    <>
      <Modal
        open={user !== null}
        onClose={onClose}
        title="Edit Role"
        description={user ? `${user.firstName} ${user.lastName} · ${user.email}` : ''}
        width="sm"
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
            >
              Cancel
            </button>
            <PrimaryButton icon="check" onClick={submit} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Banner tone="error" message={formError} />}
          <Field label="Role" name="role" required>
            <Select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
      <ConfirmModal
        open={confirmEscalation}
        onCancel={() => setConfirmEscalation(false)}
        onConfirm={persist}
        title="Grant SUPER_ADMIN access?"
        message={
          user
            ? `${user.firstName} ${user.lastName} will gain full control over admin accounts and system settings. This is a privileged action.`
            : ''
        }
        confirmLabel="Grant SUPER_ADMIN"
        tone="danger"
        busy={submitting}
      />
    </>
  );
}

function Th({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return (
    <th
      className={
        'px-6 py-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-secondary ' +
        (className ?? '')
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return <td className={'px-6 py-3.5 ' + (className ?? '')}>{children}</td>;
}
