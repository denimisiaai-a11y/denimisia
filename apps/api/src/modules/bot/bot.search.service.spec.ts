import { Test } from '@nestjs/testing';
import { BotSearchService } from './bot.search.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BotSearchService', () => {
  let service: BotSearchService;
  let prisma: { product: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { product: { findMany: jest.fn() } };
    const mod = await Test.createTestingModule({
      providers: [
        BotSearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(BotSearchService);
  });

  it('builds a query with type, tags, and in-stock variants', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'X',
        variants: [{ stock: 2, color: 'black', size: '30' }],
      },
    ]);
    const result = await service.searchBySlots({
      type: 'PANTS',
      color: 'black',
      size: '30',
      tags: [{ dimension: 'silhouette', value: 'baggy' }],
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'PANTS',
          isActive: true,
          deletedAt: null,
          productTags: { some: { dimension: 'silhouette', value: 'baggy' } },
          variants: {
            some: {
              color: { equals: 'black', mode: 'insensitive' },
              size: '30',
              stock: { gt: 0 },
            },
          },
        }),
        take: 6,
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('returns newest products when only intent is "whats_new"', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p2' }]);
    await service.findWhatsNew();
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          isNewArrival: true,
          deletedAt: null,
        }),
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    );
  });

  it('filters out products with no in-stock variants', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'a', variants: [{ stock: 0 }, { stock: 0 }] },
      { id: 'b', variants: [{ stock: 3 }] },
    ]);
    const r = await service.searchBySlots({ tags: [] });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('b');
  });
});
