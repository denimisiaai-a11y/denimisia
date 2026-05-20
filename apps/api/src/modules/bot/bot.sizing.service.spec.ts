import { Test } from '@nestjs/testing';
import { BotSizingService } from './bot.sizing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BotSizingService', () => {
  let service: BotSizingService;
  let prisma: { product: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { product: { findMany: jest.fn() } };
    const mod = await Test.createTestingModule({
      providers: [
        BotSizingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(BotSizingService);
  });

  it('recommends size 30 for waist=32 hip=40 inseam=32', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'A',
        sizeCharts: [
          { sizeKey: '28', dimension: 'waist', bodyValueIn: 30 },
          { sizeKey: '28', dimension: 'hip', bodyValueIn: 38 },
          { sizeKey: '28', dimension: 'inseam', bodyValueIn: 30 },
          { sizeKey: '30', dimension: 'waist', bodyValueIn: 32 },
          { sizeKey: '30', dimension: 'hip', bodyValueIn: 40 },
          { sizeKey: '30', dimension: 'inseam', bodyValueIn: 32 },
          { sizeKey: '32', dimension: 'waist', bodyValueIn: 34 },
          { sizeKey: '32', dimension: 'hip', bodyValueIn: 42 },
          { sizeKey: '32', dimension: 'inseam', bodyValueIn: 32 },
        ],
        variants: [
          { size: '28', stock: 1 },
          { size: '30', stock: 1 },
          { size: '32', stock: 1 },
        ],
      },
    ]);
    const r = await service.recommend({
      type: 'PANTS',
      measurements: { waist: 32, hip: 40, inseam: 32 },
      fitPref: 'regular',
    });
    expect(r.recommendedSize).toBe('30');
    expect(r.alternativeSize).toBeUndefined();
  });

  it('returns alternative size when next-best is within tolerance', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'A',
        sizeCharts: [
          { sizeKey: '30', dimension: 'waist', bodyValueIn: 32 },
          { sizeKey: '32', dimension: 'waist', bodyValueIn: 32.5 },
        ],
        variants: [
          { size: '30', stock: 1 },
          { size: '32', stock: 1 },
        ],
      },
    ]);
    const r = await service.recommend({
      type: 'PANTS',
      measurements: { waist: 32.25 },
      fitPref: 'regular',
    });
    expect([r.recommendedSize, r.alternativeSize].sort()).toEqual(['30', '32']);
  });

  it('skips products with no chart data', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', sizeCharts: [], variants: [{ size: '30', stock: 1 }] },
    ]);
    const r = await service.recommend({
      type: 'PANTS',
      measurements: { waist: 32 },
      fitPref: 'regular',
    });
    expect(r.recommendedSize).toBeNull();
  });

  it('penalizes when bodyValueIn > body for slim preference', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        sizeCharts: [
          { sizeKey: '30', dimension: 'waist', bodyValueIn: 31 },
          { sizeKey: '32', dimension: 'waist', bodyValueIn: 32 },
        ],
        variants: [
          { size: '30', stock: 1 },
          { size: '32', stock: 1 },
        ],
      },
    ]);
    const slim = await service.recommend({
      type: 'PANTS',
      measurements: { waist: 32 },
      fitPref: 'slim',
    });
    expect(slim.recommendedSize).toBe('30');
  });
});
