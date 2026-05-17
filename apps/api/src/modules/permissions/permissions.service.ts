import { Injectable } from '@nestjs/common';
import { Role } from '../../common/decorators/roles.decorator';

export interface PermissionSet {
  [resource: string]: string[];
}

const ROLE_PERMISSIONS: Record<string, PermissionSet> = {
  [Role.CUSTOMER]: {
    products: ['read'],
    categories: ['read'],
    collections: ['read'],
    reviews: ['read', 'create', 'update', 'delete'],
    wishlist: ['read', 'create', 'delete'],
    cart: ['read', 'create', 'update', 'delete'],
    orders: ['read', 'create'],
    addresses: ['read', 'create', 'update', 'delete'],
  },
  [Role.SUPPORT_STAFF]: {
    products: ['read'],
    categories: ['read'],
    collections: ['read'],
    orders: ['read', 'update'],
    reviews: ['read', 'update', 'delete'],
    users: ['read'],
    analytics: ['read'],
  },
  [Role.MANAGER]: {
    products: ['read', 'create', 'update', 'delete'],
    categories: ['read', 'create', 'update', 'delete'],
    collections: ['read', 'create', 'update', 'delete'],
    orders: ['read', 'update'],
    reviews: ['read', 'delete'],
    discounts: ['read', 'create', 'update', 'delete'],
    campaigns: ['read', 'create', 'update', 'delete'],
    bundles: ['read', 'create', 'update', 'delete'],
    inventory: ['read', 'update'],
    analytics: ['read'],
    cms: ['read', 'create', 'update', 'delete'],
  },
  [Role.ADMIN]: {
    '*': ['read', 'create', 'update', 'delete'],
  },
  [Role.SUPER_ADMIN]: {
    '*': ['read', 'create', 'update', 'delete', 'manage'],
  },
};

@Injectable()
export class PermissionsService {
  getAllPermissions() {
    return ROLE_PERMISSIONS;
  }

  getPermissionsByRole(role: string): PermissionSet {
    return ROLE_PERMISSIONS[role] ?? {};
  }

  checkPermission(role: string, resource: string, action: string): boolean {
    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) return false;

    // Wildcard role (ADMIN, SUPER_ADMIN)
    if (permissions['*']?.includes(action)) return true;

    // Specific resource check
    return permissions[resource]?.includes(action) ?? false;
  }
}
