import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.decorator';
import { EmailService } from '../email/email.service';
import { createRedisMock } from '../../common/testing/redis.mock';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let redis: ReturnType<typeof createRedisMock>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'CUSTOMER',
    isVerified: true,
    createdAt: new Date('2026-01-01'),
  };

  const mockAddress = {
    id: 'addr-1',
    userId: 'user-1',
    label: 'HOME',
    firstName: 'Test',
    lastName: 'User',
    line1: '123 Main St',
    city: 'Dhaka',
    state: 'Dhaka',
    postalCode: '1200',
    country: 'Bangladesh',
    isDefault: false,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      address: {
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    redis = createRedisMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
        {
          provide: EmailService,
          useValue: { send: jest.fn().mockResolvedValue({ id: 'mock' }) },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  // ─── Profile ──────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns user profile via findFirst + deletedAt:null', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('throws NotFoundException when user is missing or soft-deleted', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── findById (used by auth strategies) ──────────────────────────────────

  describe('findById', () => {
    it('returns minimal shape for active user', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        role: 'CUSTOMER',
        deletedAt: null,
      });

      const result = await service.findById('user-1');

      expect(result).not.toBeNull();
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
        select: { id: true, email: true, role: true, deletedAt: true },
      });
    });

    it('returns null when user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.findById('missing');

      expect(result).toBeNull();
    });
  });

  // ─── updateProfile ────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates only allow-listed fields', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        firstName: 'Updated',
      });

      await service.updateProfile('user-1', { firstName: 'Updated' });

      const callArgs = prisma.user.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(callArgs.data).toEqual({
        firstName: 'Updated',
        lastName: undefined,
      });
    });
  });

  // ─── Addresses ────────────────────────────────────────────────────────────

  describe('getAddresses', () => {
    it('returns addresses ordered by isDefault DESC, label ASC', async () => {
      prisma.address.findMany.mockResolvedValue([mockAddress]);

      const result = await service.getAddresses('user-1');

      expect(prisma.address.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
      });
      expect(result).toEqual([mockAddress]);
    });
  });

  describe('createAddress', () => {
    it('clears other defaults when creating an isDefault=true address', async () => {
      prisma.address.create.mockResolvedValue(mockAddress);

      await service.createAddress('user-1', {
        ...mockAddress,
        isDefault: true,
      } as never);

      expect(prisma.address.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isDefault: false },
      });
      expect(prisma.address.create).toHaveBeenCalled();
    });

    it('does not clear defaults when isDefault is false', async () => {
      prisma.address.create.mockResolvedValue(mockAddress);

      await service.createAddress('user-1', {
        ...mockAddress,
        isDefault: false,
      } as never);

      expect(prisma.address.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('updateAddress', () => {
    it('rejects when the address belongs to a different user', async () => {
      prisma.address.findUnique.mockResolvedValue({
        ...mockAddress,
        userId: 'other-user',
      });

      await expect(
        service.updateAddress('user-1', 'addr-1', {
          line1: 'New Street',
        } as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when address does not exist', async () => {
      prisma.address.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAddress('user-1', 'missing', {
          line1: 'New Street',
        } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAddress', () => {
    it('deletes after ownership check passes', async () => {
      prisma.address.findUnique.mockResolvedValue(mockAddress);
      prisma.address.delete.mockResolvedValue(mockAddress);

      await service.deleteAddress('user-1', 'addr-1');

      expect(prisma.address.delete).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
      });
    });
  });

  // ─── Admin ────────────────────────────────────────────────────────────────

  describe('getAllUsers', () => {
    it('paginates and returns user list with total, excluding soft-deleted', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getAllUsers(1, 10);

      expect(result).toEqual({
        users: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });
  });

  describe('getUserById', () => {
    it('returns user with addresses + counts via findFirst + deletedAt:null', async () => {
      const fullUser = {
        ...mockUser,
        addresses: [mockAddress],
        _count: { orders: 3, reviews: 2 },
      };
      prisma.user.findFirst.mockResolvedValue(fullUser);

      const result = await service.getUserById('user-1');

      expect(result).toEqual(fullUser);
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.getUserById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('saveFitProfile', () => {
    it('merges new type into existing fitProfile JSON', async () => {
      prisma.user.findUnique.mockResolvedValue({
        fitProfile: { shirts: { chest: 40, fitPref: 'regular' } },
      });
      prisma.user.update.mockResolvedValue({
        fitProfile: {
          shirts: { chest: 40, fitPref: 'regular' },
          pants: { waist: 32, fitPref: 'slim' },
        },
      });

      await service.saveFitProfile('user-1', {
        type: 'PANTS' as never,
        measurements: { waist: 32 },
        fitPref: 'slim',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { fitProfile: true },
      });
      const updateCall = prisma.user.update.mock.calls[0][0] as {
        data: { fitProfile: Record<string, unknown> };
      };
      // Preserved existing sub-profile…
      expect(updateCall.data.fitProfile).toEqual(
        expect.objectContaining({
          shirts: expect.any(Object),
          pants: expect.objectContaining({ waist: 32, fitPref: 'slim' }),
        }),
      );
      // …and stamped an updatedAt on the new one.
      const pants = (updateCall.data.fitProfile as Record<string, any>).pants;
      expect(pants.updatedAt).toEqual(expect.any(String));
    });

    it('initialises fitProfile when the user has none', async () => {
      prisma.user.findUnique.mockResolvedValue({ fitProfile: null });
      prisma.user.update.mockResolvedValue({
        fitProfile: { shirts: { chest: 40, fitPref: 'regular' } },
      });

      await service.saveFitProfile('user-1', {
        type: 'SHIRTS' as never,
        measurements: { chest: 40 },
        fitPref: 'regular',
      });

      const updateCall = prisma.user.update.mock.calls[0][0] as {
        data: { fitProfile: Record<string, unknown> };
      };
      expect(updateCall.data.fitProfile).toEqual(
        expect.objectContaining({
          shirts: expect.objectContaining({ chest: 40, fitPref: 'regular' }),
        }),
      );
    });
  });

  describe('deactivateUser', () => {
    it('marks isVerified=false and bumps the Redis token version', async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      await service.deactivateUser('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isVerified: false },
      });
      expect(redis.incr).toHaveBeenCalledWith('auth:tv:user-1');
      expect(redis.del).toHaveBeenCalledWith('auth:user:user-1');
    });
  });
});
