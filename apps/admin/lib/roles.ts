/**
 * UI label mapping for the DB Role enum. The DB keeps the historical names
 * (MANAGER, SUPPORT_STAFF) so existing @Roles decorators don't break, but
 * the InviteAdminModal + Admin Users table show the new labels customers
 * asked for ("Moderator" / "Staff").
 */
export type StaffRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SUPPORT_STAFF';

export const STAFF_ROLES: readonly StaffRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'SUPPORT_STAFF',
];

const LABELS: Readonly<Record<StaffRole, string>> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Moderator',
  SUPPORT_STAFF: 'Staff',
};

const TONES: Readonly<Record<StaffRole, 'danger' | 'warning' | 'info' | 'neutral'>> = {
  SUPER_ADMIN: 'danger',
  ADMIN: 'warning',
  MANAGER: 'info',
  SUPPORT_STAFF: 'neutral',
};

export function roleLabel(role: string | undefined | null): string {
  if (!role) return '—';
  if (role in LABELS) return LABELS[role as StaffRole];
  return role;
}

export function roleTone(
  role: string,
): 'danger' | 'warning' | 'info' | 'neutral' {
  if (role in TONES) return TONES[role as StaffRole];
  return 'neutral';
}
