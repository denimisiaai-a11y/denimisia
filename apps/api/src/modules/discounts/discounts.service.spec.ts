import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DiscountsService', () => {
  let service: DiscountsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockDiscount = {
    id: 'disc-1',
    code: 'SAVE10',
    type: 'PERCENTAGE',
    value: 10,
    isActive: true,
    minOrderAmount: null,
    maxUses: null,
    usedCount: 0,
    startDate: null,
    endDate: null,
    applicableProductIds: [],
    applicableCategoryIds: [],
  };

  beforeEach(async () => {
    prisma = {
      discount: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DiscountsService);
  });

  // ─── validate() ───────────────────────────────────────────────────────────

  describe('validate', () => {
    it('should validate a valid percentage discount code', async () => {
      prisma.discount.findUnique.mockResolvedValue(mockDiscount);

      const result = await service.validate({
        code: 'save10',
        orderAmount: 2000,
      });

      expect(prisma.discount.findUnique).toHaveBeenCalledWith({
        where: { code: 'SAVE10' },
      });
      expect(result).toEqual({
        valid: true,
        code: 'SAVE10',
        type: 'PERCENTAGE',
        value: 10,
        discountAmount: 200, // 2000 * 10/100
      });
    });

    it('should validate a fixed amount discount', async () => {
      const fixedDiscount = {
        ...mockDiscount,
        code: 'FLAT500',
        type: 'FIXED_AMOUNT',
        value: 500,
      };
      prisma.discount.findUnique.mockResolvedValue(fixedDiscount);

      const result = await service.validate({
        code: 'flat500',
        orderAmount: 2000,
      });

      expect(result).toEqual({
        valid: true,
        code: 'FLAT500',
        type: 'FIXED_AMOUNT',
        value: 500,
        discountAmount: 500,
      });
    });

    it('should return 0 discount for FREE_SHIPPING type', async () => {
      const freeShipDiscount = {
        ...mockDiscount,
        code: 'FREESHIP',
        type: 'FREE_SHIPPING',
        value: 0,
      };
      prisma.discount.findUnique.mockResolvedValue(freeShipDiscount);

      const result = await service.validate({
        code: 'freeship',
        orderAmount: 1000,
      });

      // Narrow the discriminated union before asserting success-only fields.
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.discountAmount).toBe(0);
        expect(result.type).toBe('FREE_SHIPPING');
      }
    });

    it('should cap discount at order amount', async () => {
      const bigDiscount = {
        ...mockDiscount,
        type: 'FIXED_AMOUNT',
        value: 5000,
      };
      prisma.discount.findUnique.mockResolvedValue(bigDiscount);

      const result = await service.validate({
        code: 'SAVE10',
        orderAmount: 1000,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.discountAmount).toBe(1000); // Math.min(5000, 1000)
      }
    });

    // SECURITY: all failure modes now collapse to a single opaque response
    // (`{ valid: false, reason: 'INVALID' }`) so that attackers cannot
    // enumerate valid codes by comparing error shapes. The tests below verify
    // that contract for each failure mode.

    it('should return opaque failure for inactive discount', async () => {
      prisma.discount.findUnique.mockResolvedValue({
        ...mockDiscount,
        isActive: false,
      });

      const result = await service.validate({
        code: 'SAVE10',
        orderAmount: 1000,
      });
      expect(result).toEqual({ valid: false, reason: 'INVALID' });
    });

    it('should return opaque failure for non-existent code', async () => {
      prisma.discount.findUnique.mockResolvedValue(null);

      const result = await service.validate({
        code: 'INVALID',
        orderAmount: 1000,
      });
      expect(result).toEqual({ valid: false, reason: 'INVALID' });
    });

    it('should return opaque failure when discount has not started yet', async () => {
      const futureDiscount = {
        ...mockDiscount,
        startDate: new Date('2099-01-01'),
      };
      prisma.discount.findUnique.mockResolvedValue(futureDiscount);

      const result = await service.validate({
        code: 'SAVE10',
        orderAmount: 1000,
      });
      expect(result).toEqual({ valid: false, reason: 'INVALID' });
    });

    it('should return opaque failure when discount has expired', async () => {
      const expiredDiscount = {
        ...mockDiscount,
        endDate: new Date('2020-01-01'),
      };
      prisma.discount.findUnique.mockResolvedValue(expiredDiscount);

      const result = await service.validate({
        code: 'SAVE10',
        orderAmount: 1000,
      });
      expect(result).toEqual({ valid: false, reason: 'INVALID' });
    });

    it('should return opaque failure when max uses reached', async () => {
      const maxedDiscount = {
        ...mockDiscount,
        maxUses: 100,
        usedCount: 100,
      };
      prisma.discount.findUnique.mockResolvedValue(maxedDiscount);

      const result = await service.validate({
        code: 'SAVE10',
        orderAmount: 1000,
      });
      expect(result).toEqual({ valid: false, reason: 'INVALID' });
    });

    it('should return opaque failure when order below minimum amount', async () => {
      const minOrderDiscount = {
        ...mockDiscount,
        minOrderAmount: 2000,
      };
      prisma.discount.findUnique.mockResolvedValue(minOrderDiscount);

      const result = await service.validate({
        code: 'SAVE10',
        orderAmount: 500,
      });
      expect(result).toEqual({ valid: false, reason: 'INVALID' });
    });

    it('should convert code to uppercase for lookup', async () => {
      prisma.discount.findUnique.mockResolvedValue(mockDiscount);

      await service.validate({ code: 'save10', orderAmount: 1000 });

      expect(prisma.discount.findUnique).toHaveBeenCalledWith({
        where: { code: 'SAVE10' },
      });
    });
  });

  // ─── findAll() ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated discounts with defaults', async () => {
      prisma.discount.findMany.mockResolvedValue([mockDiscount]);
      prisma.discount.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(prisma.discount.findMany).toHaveBeenCalledWith({
        orderBy: { id: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        discounts: [mockDiscount],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('should apply custom page and limit', async () => {
      prisma.discount.findMany.mockResolvedValue([]);
      prisma.discount.count.mockResolvedValue(50);

      const result = await service.findAll(3, 10);

      expect(prisma.discount.findMany).toHaveBeenCalledWith({
        orderBy: { id: 'desc' },
        skip: 20,
        take: 10,
      });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });
  });

  // ─── findOne() ────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return discount by id', async () => {
      prisma.discount.findUnique.mockResolvedValue(mockDiscount);

      const result = await service.findOne('disc-1');

      expect(prisma.discount.findUnique).toHaveBeenCalledWith({
        where: { id: 'disc-1' },
      });
      expect(result).toEqual(mockDiscount);
    });

    it('should throw NotFoundException when discount not found', async () => {
      prisma.discount.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── create() ─────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      code: 'new20',
      type: 'PERCENTAGE' as const,
      value: 20,
      minOrderAmount: 500,
      maxUses: 50,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      applicableProductIds: ['prod-1'],
      applicableCategoryIds: ['cat-1'],
    };

    it('should create discount with uppercase code', async () => {
      prisma.discount.findUnique.mockResolvedValue(null);
      const created = {
        id: 'disc-new',
        code: 'NEW20',
        type: 'PERCENTAGE',
        value: 20,
      };
      prisma.discount.create.mockResolvedValue(created);

      const result = await service.create(createDto as any);

      expect(prisma.discount.findUnique).toHaveBeenCalledWith({
        where: { code: 'NEW20' },
      });
      expect(prisma.discount.create).toHaveBeenCalledWith({
        data: {
          code: 'NEW20',
          type: 'PERCENTAGE',
          value: 20,
          minOrderAmount: 500,
          maxUses: 50,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          applicableProductIds: ['prod-1'],
          applicableCategoryIds: ['cat-1'],
        },
      });
      expect(result).toEqual(created);
    });

    it('should throw ConflictException when code already exists', async () => {
      prisma.discount.findUnique.mockResolvedValue(mockDiscount);

      await expect(
        service.create({
          code: 'SAVE10',
          type: 'PERCENTAGE',
          value: 10,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle optional fields being undefined', async () => {
      prisma.discount.findUnique.mockResolvedValue(null);
      prisma.discount.create.mockResolvedValue({
        id: 'disc-minimal',
        code: 'BASIC',
      });

      await service.create({
        code: 'basic',
        type: 'FIXED_AMOUNT',
        value: 100,
      } as any);

      expect(prisma.discount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'BASIC',
          startDate: undefined,
          endDate: undefined,
          applicableProductIds: [],
          applicableCategoryIds: [],
        }),
      });
    });
  });

  // ─── update() ─────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update discount fields', async () => {
      prisma.discount.findUnique.mockResolvedValue(mockDiscount);
      const updated = { ...mockDiscount, isActive: false };
      prisma.discount.update.mockResolvedValue(updated);

      const result = await service.update('disc-1', {
        isActive: false,
      });

      expect(prisma.discount.update).toHaveBeenCalledWith({
        where: { id: 'disc-1' },
        data: { isActive: false },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when discount not found', async () => {
      prisma.discount.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only include provided fields in update', async () => {
      prisma.discount.findUnique.mockResolvedValue(mockDiscount);
      prisma.discount.update.mockResolvedValue(mockDiscount);

      await service.update('disc-1', { value: 25 });

      expect(prisma.discount.update).toHaveBeenCalledWith({
        where: { id: 'disc-1' },
        data: { value: 25 },
      });
    });

    it('should convert endDate string to Date object', async () => {
      prisma.discount.findUnique.mockResolvedValue(mockDiscount);
      prisma.discount.update.mockResolvedValue(mockDiscount);

      await service.update('disc-1', { endDate: '2025-12-31' });

      expect(prisma.discount.update).toHaveBeenCalledWith({
        where: { id: 'disc-1' },
        data: { endDate: new Date('2025-12-31') },
      });
    });
  });

  // ─── remove() ─────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete discount', async () => {
      prisma.discount.findUnique.mockResolvedValue(mockDiscount);
      prisma.discount.delete.mockResolvedValue(mockDiscount);

      await service.remove('disc-1');

      expect(prisma.discount.delete).toHaveBeenCalledWith({
        where: { id: 'disc-1' },
      });
    });

    it('should throw NotFoundException when discount not found', async () => {
      prisma.discount.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
