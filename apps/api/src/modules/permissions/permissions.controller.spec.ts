import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let permissionsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    permissionsService = {
      getAllPermissions: jest.fn(),
      getPermissionsByRole: jest.fn(),
      checkPermission: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        { provide: PermissionsService, useValue: permissionsService },
      ],
    }).compile();

    controller = module.get(PermissionsController);
  });

  it('should get all permissions', async () => {
    permissionsService.getAllPermissions.mockReturnValue({});
    const result = await controller.getAllPermissions();
    expect(permissionsService.getAllPermissions).toHaveBeenCalled();
  });

  it('should get permissions by role', async () => {
    permissionsService.getPermissionsByRole.mockReturnValue({});
    const result = await controller.getPermissionsByRole('ADMIN');
    expect(permissionsService.getPermissionsByRole).toHaveBeenCalledWith(
      'ADMIN',
    );
  });

  it('should check permission', async () => {
    permissionsService.checkPermission.mockReturnValue(true);
    const result = await controller.checkPermission({ role: 'ADMIN' }, {
      resource: 'orders',
      action: 'delete',
    } as any);
    expect(permissionsService.checkPermission).toHaveBeenCalledWith(
      'ADMIN',
      'orders',
      'delete',
    );
    expect(result).toEqual({
      allowed: true,
      role: 'ADMIN',
      resource: 'orders',
      action: 'delete',
    });
  });
});
