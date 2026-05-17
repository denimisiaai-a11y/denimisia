import { SetMetadata } from '@nestjs/common';

export enum Role {
  CUSTOMER = 'CUSTOMER',
  MANAGER = 'MANAGER',
  SUPPORT_STAFF = 'SUPPORT_STAFF',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// hasRole uses ladder semantics (ADMIN passes a MANAGER gate); @Roles +
// RolesGuard use strict equality. Keep both in sync when adding roles.
export const ROLE_WEIGHTS: Readonly<Record<Role, number>> = Object.freeze({
  [Role.CUSTOMER]: 0,
  [Role.SUPPORT_STAFF]: 10,
  [Role.MANAGER]: 20,
  [Role.ADMIN]: 30,
  [Role.SUPER_ADMIN]: 40,
});

export function roleWeight(role: Role | string | undefined | null): number {
  if (typeof role === 'string' && role in ROLE_WEIGHTS) {
    return ROLE_WEIGHTS[role as Role];
  }
  return Number.NEGATIVE_INFINITY;
}

export function hasRole(
  actor: Role | string | undefined | null,
  required: Role,
): boolean {
  return roleWeight(actor) >= ROLE_WEIGHTS[required];
}
