import { Test } from '@nestjs/testing';
import { CollectionsAutoService } from './collections.auto.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CollectionsAutoService', () => {
  let service: CollectionsAutoService;
  const prismaMock = {
    product: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    prismaMock.product.findMany.mockReset();
    const mod = await Test.createTestingModule({
      providers: [
        CollectionsAutoService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = mod.get(CollectionsAutoService);
  });

  it('returns isTrending products when includeIfBestseller is true', async () => {
    prismaMock.product.findMany.mockResolvedValue([{ id: 'p1' }]);
    await service.resolve({
      autoRules: { includeIfBestseller: true, maxProducts: 5 },
    } as never);
    const call = prismaMock.product.findMany.mock.calls[0][0];
    expect(call.where.isTrending).toBe(true);
    expect(call.where.isActive).toBe(true);
    expect(call.take).toBe(5);
  });

  it('filters by createdAt window when includeIfNewArrival', async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    await service.resolve({
      autoRules: { includeIfNewArrival: true, newArrivalDays: 7 },
    } as never);
    const call = prismaMock.product.findMany.mock.calls[0][0];
    expect(call.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it('defaults maxProducts to 24 and take to 24', async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    await service.resolve({ autoRules: { includeIfBestseller: true } } as never);
    const call = prismaMock.product.findMany.mock.calls[0][0];
    expect(call.take).toBe(24);
  });

  it('shapes result like CollectionProduct join rows with position', async () => {
    prismaMock.product.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const out = await service.resolve({ autoRules: {} } as never);
    expect(out).toEqual([
      expect.objectContaining({ position: 0, product: { id: 'a' } }),
      expect.objectContaining({ position: 1, product: { id: 'b' } }),
    ]);
  });

  it('filters by category and tag arrays', async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    await service.resolve({
      autoRules: { includeCategoryIds: ['c1'], includeTags: ['t1'] },
    } as never);
    const call = prismaMock.product.findMany.mock.calls[0][0];
    expect(call.where.categoryId).toEqual({ in: ['c1'] });
    expect(call.where.tags).toEqual({ hasSome: ['t1'] });
  });

  it('excludes products listed in excludeProductIds', async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    await service.resolve({ autoRules: { excludeProductIds: ['x1'] } } as never);
    const call = prismaMock.product.findMany.mock.calls[0][0];
    expect(call.where.id).toEqual({ notIn: ['x1'] });
  });

  it('applies inStockOnly via variants relation', async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    await service.resolve({ autoRules: { inStockOnly: true } } as never);
    const call = prismaMock.product.findMany.mock.calls[0][0];
    expect(call.where.variants).toEqual({ some: { stock: { gt: 0 } } });
  });
});
