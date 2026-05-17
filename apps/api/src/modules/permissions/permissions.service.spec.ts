import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { Role } from '../../common/decorators/roles.decorator';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsService],
    }).compile();

    service = module.get(PermissionsService);
  });

  it('should return all permissions', () => {
    const result = service.getAllPermissions();
    expect(result[Role.ADMIN]).toBeDefined();
    expect(result[Role.SUPER_ADMIN]).toBeDefined();
  });

  it('should return permissions by role', () => {
    const result = service.getPermissionsByRole(Role.CUSTOMER);
    expect(result.orders).toContain('read');
    expect(result.orders).toContain('create');
  });

  it('should return empty object for unknown role', () => {
    const result = service.getPermissionsByRole('UNKNOWN');
    expect(result).toEqual({});
  });

  it('should allow ADMIN any action via wildcard', () => {
    expect(service.checkPermission(Role.ADMIN, 'orders', 'delete')).toBe(true);
    expect(service.checkPermission(Role.SUPER_ADMIN, 'users', 'manage')).toBe(
      true,
    );
  });

  it('should check specific resource permissions for CUSTOMER', () => {
    expect(service.checkPermission(Role.CUSTOMER, 'products', 'read')).toBe(
      true,
    );
    expect(service.checkPermission(Role.CUSTOMER, 'products', 'delete')).toBe(
      false,
    );
  });

  it('should return false for unknown role', () => {
    expect(service.checkPermission('UNKNOWN', 'products', 'read')).toBe(false);
  });
});
