import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InventoryService', () => {
  let service: InventoryService;
  // $transaction is a root-level jest.Mock, not a Record of mocks, so mix the
  // two shapes with a loose index signature.
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      productVariant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      inventoryLog: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  it('should get low stock variants, excluding soft-deleted variants and products', async () => {
    prisma.productVariant.findMany.mockResolvedValue([
      { id: 'var-1', stock: 2 },
    ]);
    await service.getLowStockVariants(5);
    expect(prisma.productVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          stock: { lte: 5 },
          deletedAt: null,
          product: { isActive: true, deletedAt: null },
        },
      }),
    );
  });

  it('should get variant logs', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({ id: 'var-1' });
    prisma.inventoryLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
    prisma.inventoryLog.count.mockResolvedValue(1);
    const result = await service.getVariantLogs('var-1', 1, 20);
    expect(result.logs).toEqual([{ id: 'log-1' }]);
  });

  it('should throw when variant not found for logs', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(null);
    await expect(service.getVariantLogs('var-999', 1, 20)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should adjust stock up via conditional updateMany', async () => {
    prisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryLog.create.mockResolvedValue({});
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'var-1',
      stock: 15,
    });

    const result = await service.adjustStock({
      variantId: 'var-1',
      quantity: 5,
      type: 'ADJUSTMENT',
    } as any);

    expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'var-1' },
      data: { stock: { increment: 5 } },
    });
    expect(result.stock).toBe(15);
  });

  it('should adjust stock down with stock guard', async () => {
    prisma.productVariant.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryLog.create.mockResolvedValue({});
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'var-1',
      stock: 7,
    });

    const result = await service.adjustStock({
      variantId: 'var-1',
      quantity: -3,
      type: 'SALE',
    } as any);

    expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'var-1', stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
    expect(result.stock).toBe(7);
  });

  it('should throw ConflictException when decrement would oversell', async () => {
    // Guarded updateMany matched no rows because stock < decrementBy.
    prisma.productVariant.updateMany.mockResolvedValue({ count: 0 });
    // Variant still exists; conflict (not missing) should be raised.
    prisma.productVariant.findUnique.mockResolvedValue({ id: 'var-1' });

    await expect(
      service.adjustStock({
        variantId: 'var-1',
        quantity: -5,
        type: 'SALE',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException for zero-quantity adjustment', async () => {
    await expect(
      service.adjustStock({
        variantId: 'var-1',
        quantity: 0,
        type: 'ADJUSTMENT',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when variant not found on increment', async () => {
    prisma.productVariant.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.adjustStock({
        variantId: 'var-999',
        quantity: 1,
        type: 'ADJUSTMENT',
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when variant not found on decrement', async () => {
    prisma.productVariant.updateMany.mockResolvedValue({ count: 0 });
    prisma.productVariant.findUnique.mockResolvedValue(null);
    await expect(
      service.adjustStock({
        variantId: 'var-999',
        quantity: -1,
        type: 'SALE',
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('should get inventory summary, filtering soft-deleted everywhere', async () => {
    prisma.productVariant.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);
    const result = await service.getInventorySummary();
    expect(result).toEqual({ totalVariants: 100, lowStock: 10, outOfStock: 3 });
    // Every call's where must include deletedAt: null at both levels.
    for (const call of prisma.productVariant.count.mock.calls) {
      expect(call[0].where.deletedAt).toBe(null);
      expect(call[0].where.product.isActive).toBe(true);
      expect(call[0].where.product.deletedAt).toBe(null);
    }
  });
});
