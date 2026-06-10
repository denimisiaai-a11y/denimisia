import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: Record<string, jest.Mock>;

  beforeEach(async () => {
    usersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      getAddresses: jest.fn(),
      createAddress: jest.fn(),
      updateAddress: jest.fn(),
      deleteAddress: jest.fn(),
      getAllUsers: jest.fn(),
      getUserById: jest.fn(),
      deactivateUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
  });

  it('should get profile', async () => {
    usersService.getProfile.mockResolvedValue({ id: 'user-1' });
    const result = await controller.getProfile({ id: 'user-1' });
    expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
  });

  it('should update profile', async () => {
    usersService.updateProfile.mockResolvedValue({
      id: 'user-1',
      firstName: 'New',
    });
    const result = await controller.updateProfile({ id: 'user-1' }, {
      firstName: 'New',
    } as any);
    expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', {
      firstName: 'New',
    });
  });

  it('should get addresses', async () => {
    usersService.getAddresses.mockResolvedValue([]);
    const result = await controller.getAddresses({ id: 'user-1' });
    expect(usersService.getAddresses).toHaveBeenCalledWith('user-1');
  });

  it('should create address', async () => {
    usersService.createAddress.mockResolvedValue({ id: 'addr-1' });
    const dto = { line1: '123 Main St' } as any;
    const result = await controller.createAddress({ id: 'user-1' }, dto);
    expect(usersService.createAddress).toHaveBeenCalledWith('user-1', dto);
  });

  it('should update address', async () => {
    usersService.updateAddress.mockResolvedValue({ id: 'addr-1' });
    const result = await controller.updateAddress({ id: 'user-1' }, 'addr-1', {
      line1: '456 Oak',
    } as any);
    expect(usersService.updateAddress).toHaveBeenCalledWith(
      'user-1',
      'addr-1',
      { line1: '456 Oak' },
    );
  });

  it('should delete address', async () => {
    usersService.deleteAddress.mockResolvedValue(undefined);
    await controller.deleteAddress({ id: 'user-1' }, 'addr-1');
    expect(usersService.deleteAddress).toHaveBeenCalledWith('user-1', 'addr-1');
  });

  it('should get all users for admin', async () => {
    usersService.getAllUsers.mockResolvedValue({ users: [], total: 0 });
    const result = await controller.getAllUsers(1, 20);
    expect(usersService.getAllUsers).toHaveBeenCalledWith(1, 20);
  });

  it('should get user by id for admin', async () => {
    usersService.getUserById.mockResolvedValue({ id: 'user-1' });
    const result = await controller.getUserById('user-1');
    expect(usersService.getUserById).toHaveBeenCalledWith('user-1');
  });

  it('should deactivate user', async () => {
    usersService.deactivateUser.mockResolvedValue(undefined);
    await controller.deactivateUser('user-1');
    expect(usersService.deactivateUser).toHaveBeenCalledWith('user-1');
  });
});
