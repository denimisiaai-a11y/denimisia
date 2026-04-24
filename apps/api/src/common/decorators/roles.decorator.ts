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
