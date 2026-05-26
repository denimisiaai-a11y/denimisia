import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.decorator';
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
    phones: [],
    role: 'CUSTOMER',
    isVerified: true,
    claimedAt: new Date('2026-01-01'),
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
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
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
      order: {
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    redis = createRedisMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
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
          phones: true,
          role: true,
          isVerified: true,
          claimedAt: true,
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
    it('updates only allow-listed fields (no phone)', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        firstName: 'Updated',
      });

      await service.updateProfile('user-1', { firstName: 'Updated' });

      const callArgs = prisma.user.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      // phones key must be absent when dto.phone is undefined
      expect(callArgs.data.phones).toBeUndefined();
      expect(callArgs.data.firstName).toBe('Updated');
      // findUnique NOT called — we skip the phone branch entirely
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('dedup-prepends new phone to phones[]', async () => {
      prisma.user.findUnique.mockResolvedValue({ phones: ['01700000000'] });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        phones: ['01776902711', '01700000000'],
        role: 'CUSTOMER',
        isVerified: true,
      });

      await service.updateProfile('user-1', {
        firstName: 'A',
        lastName: 'B',
        phone: '01776902711',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            phones: ['01776902711', '01700000000'],
          }),
        }),
      );
    });

    it('clears phones[0] when phone is empty string', async () => {
      prisma.user.findUnique.mockResolvedValue({
        phones: ['01776902711', '01700000000'],
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        phones: ['01700000000'],
        role: 'CUSTOMER',
        isVerified: true,
      });

      await service.updateProfile('user-1', {
        firstName: 'A',
        lastName: 'B',
        phone: '',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phones: ['01700000000'] }),
        }),
      );
    });

    it('rejects invalid phone format', async () => {
      prisma.user.findUnique.mockResolvedValue({ phones: [] });

      await expect(
        service.updateProfile('user-1', {
          firstName: 'A',
          lastName: 'B',
          phone: 'not-a-phone',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('leaves phones unchanged when phone is undefined', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        phones: ['01700000000'],
        role: 'CUSTOMER',
        isVerified: true,
      });

      await service.updateProfile('user-1', {
        firstName: 'A',
        lastName: 'B',
        // no phone field
      });

      // findUnique NOT called — we skip the phone branch entirely when undefined
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'A',
            lastName: 'B',
          }),
        }),
      );
      // phones must NOT appear in the update data
      const updateArg = (prisma.user.update.mock.calls[0]?.[0] ?? {
        data: {},
      }) as { data: Record<string, unknown> };
      expect(updateArg.data.phones).toBeUndefined();
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
    it('paginates and returns user list with total + lifetime-value, excluding soft-deleted', async () => {
      const userWithCount = { ...mockUser, _count: { orders: 4 } };
      prisma.user.findMany.mockResolvedValue([userWithCount]);
      prisma.user.count.mockResolvedValue(1);
      prisma.order.groupBy.mockResolvedValue([
        { userId: mockUser.id, _sum: { total: 5499 } },
      ]);

      const result = await service.getAllUsers(1, 10);

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.users).toHaveLength(1);
      expect(result.users[0]).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        totalOrders: 4,
        totalSpent: 5499,
      });
      expect(result.users[0]).not.toHaveProperty('_count');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(prisma.order.groupBy).toHaveBeenCalledWith({
        by: ['userId'],
        where: { userId: { in: [mockUser.id] } },
        _sum: { total: true },
      });
    });

    it('defaults totalSpent to 0 when user has no orders aggregated', async () => {
      const userWithCount = { ...mockUser, _count: { orders: 0 } };
      prisma.user.findMany.mockResolvedValue([userWithCount]);
      prisma.user.count.mockResolvedValue(1);
      prisma.order.groupBy.mockResolvedValue([]);

      const result = await service.getAllUsers(1, 10);

      expect(result.users[0]).toMatchObject({
        totalOrders: 0,
        totalSpent: 0,
      });
    });
  });

  describe('getUserById', () => {
    it('returns user with addresses + orders + totalSpent via findFirst + deletedAt:null', async () => {
      const fullUser = {
        ...mockUser,
        addresses: [mockAddress],
        orders: [
          {
            id: 'ord-1',
            orderNumber: 'DEN-000001',
            status: 'DELIVERED',
            total: 1500,
            createdAt: new Date('2024-09-01'),
            _count: { items: 2 },
          },
        ],
        _count: { orders: 3, reviews: 2 },
      };
      prisma.user.findFirst.mockResolvedValue(fullUser);
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: 4500 } });

      const result = await service.getUserById('user-1');

      expect(result).toEqual({ ...fullUser, totalSpent: 4500 });
      expect(prisma.order.aggregate).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        _sum: { total: true },
      });
    });

    it('defaults totalSpent to 0 when user has no orders', async () => {
      const fullUser = {
        ...mockUser,
        addresses: [],
        orders: [],
        _count: { orders: 0, reviews: 0 },
      };
      prisma.user.findFirst.mockResolvedValue(fullUser);
      prisma.order.aggregate.mockResolvedValue({ _sum: { total: null } });

      const result = await service.getUserById('user-1');

      expect(result.totalSpent).toBe(0);
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

  describe('bulkImport', () => {
    const adminId = 'admin-1';

    it('creates new users from parsed rows + skips existing emails', async () => {
      const csv = `email,firstName,lastName,phone
new1@example.com,New,One,01776902711
existing@example.com,Existing,User,01700000000
new2@example.com,New,Two,`;
      const buffer = Buffer.from(csv, 'utf-8');

      prisma.user.findMany.mockResolvedValue([
        { email: 'existing@example.com' },
      ]);
      prisma.user.createMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkImport(buffer, adminId);

      expect(result).toEqual({
        created: 2,
        skipped_existing: 1,
        skipped_duplicate_within_upload: 0,
        errors: [],
      });
      expect(prisma.user.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              email: 'new1@example.com',
              firstName: 'New',
              phones: ['01776902711'],
              passwordHash: null,
              claimedAt: null,
              createdBy: adminId,
            }),
            expect.objectContaining({
              email: 'new2@example.com',
              firstName: 'New',
              lastName: 'Two',
              phones: [],
            }),
          ]),
        }),
      );
      const createArg = (prisma.user.createMany.mock.calls[0]?.[0] ?? {
        data: [],
      }) as { data: Array<{ email: string }> };
      expect(createArg.data.find((d) => d.email === 'existing@example.com')).toBeUndefined();
    });

    it('reports parse errors in the result', async () => {
      const csv = `email,firstName,lastName,phone
bad-email,X,Y,
ok@example.com,OK,User,01776902711`;
      const buffer = Buffer.from(csv, 'utf-8');
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.createMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkImport(buffer, adminId);

      expect(result.created).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        row: 2,
        reason: expect.stringContaining('email'),
      });
    });

    it('reports within-file duplicates separately', async () => {
      const csv = `email,firstName,lastName,phone
ada@example.com,Ada,,01776902711
ada@example.com,IGNORE,Lovelace,02000000000`;
      const buffer = Buffer.from(csv, 'utf-8');
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.createMany.mockResolvedValue({ count: 1 });

      const result = await service.bulkImport(buffer, adminId);

      expect(result.created).toBe(1);
      expect(result.skipped_duplicate_within_upload).toBe(1);
    });
  });

  describe('createCustomerAsAdmin (refactored — no password, no email)', () => {
    const adminId = 'admin-1';

    it('creates a shadow user with null passwordHash and createdBy=adminId', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-1',
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        phones: ['01776902711'],
        role: 'CUSTOMER',
        isActive: true,
        isVerified: true,
        claimedAt: null,
        createdBy: adminId,
        createdAt: new Date(),
      });

      const result = await service.createCustomerAsAdmin(
        {
          email: 'NEW@example.com',
          firstName: 'New',
          lastName: 'User',
          phone: '+880 1776-902-711',
        },
        adminId,
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@example.com',
            phones: ['01776902711'],
            passwordHash: null,
            claimedAt: null,
            createdBy: adminId,
            isVerified: true,
          }),
        }),
      );
      expect(result.id).toBe('new-1');
    });

    it('returns 409 when email matches a CLAIMED user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-1',
        email: 'taken@example.com',
        claimedAt: new Date(),
        deletedAt: null,
      });

      await expect(
        service.createCustomerAsAdmin(
          { email: 'taken@example.com', firstName: 'X' },
          adminId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('fills blanks on existing SHADOW user without overwriting non-empty fields', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'shadow-1',
        email: 'shadow@example.com',
        firstName: 'Existing',
        lastName: '',
        phones: ['01700000000'],
        claimedAt: null,
        deletedAt: null,
      });
      prisma.user.update.mockResolvedValue({
        id: 'shadow-1',
        email: 'shadow@example.com',
        firstName: 'Existing',
        lastName: 'Filled',
        phones: ['01776902711', '01700000000'],
        claimedAt: null,
        createdBy: 'old-admin',
      });

      await service.createCustomerAsAdmin(
        {
          email: 'shadow@example.com',
          firstName: 'New',
          lastName: 'Filled',
          phone: '01776902711',
        },
        adminId,
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'shadow-1' },
        data: expect.objectContaining({
          lastName: 'Filled',
          phones: ['01776902711', '01700000000'],
        }),
        select: expect.any(Object),
      });
      const updateArg = (prisma.user.update.mock.calls[0]?.[0] ?? {}) as {
        data: Record<string, unknown>;
      };
      expect(updateArg.data.firstName).toBeUndefined();
    });

    it('rejects invalid phone format', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCustomerAsAdmin(
          { email: 'a@b.com', firstName: 'A', phone: 'not-a-phone' },
          adminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
