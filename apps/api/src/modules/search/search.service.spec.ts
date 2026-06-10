import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockProduct = {
    id: 'prod-1',
    name: 'Slim Fit Denim',
    slug: 'slim-fit-denim',
    description: 'Premium denim jeans',
    price: 2500,
    isActive: true,
    images: ['image1.jpg'],
    category: { name: 'Jeans', slug: 'jeans' },
    variants: [
      {
        id: 'var-1',
        size: '32',
        color: 'Blue',
        price: '2500',
        stock: 10,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SearchService);
  });

  // ─── searchProducts ───────────────────────────────────────────────────────

  describe('searchProducts', () => {
    it('should return empty results for short query', async () => {
      const result = await service.searchProducts('a', 1, 20);
      expect(result).toEqual({
        products: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('should return empty results for empty query', async () => {
      const result = await service.searchProducts('', 1, 20);
      expect(result).toEqual({
        products: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('should search products with trimmed query', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.searchProducts('  denim  ', 1, 20);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: { contains: 'denim', mode: 'insensitive' },
              }),
            ]),
          }),
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({
        products: [mockProduct],
        total: 1,
        page: 1,
        limit: 20,
        query: 'denim',
      });
    });

    it('should respect pagination params', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.searchProducts('jeans', 2, 10);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  // ─── getSuggestions ───────────────────────────────────────────────────────

  describe('getSuggestions', () => {
    it('should return empty array for short query', async () => {
      const result = await service.getSuggestions('a');
      expect(result).toEqual([]);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('should return product suggestions', async () => {
      const suggestions = [
        {
          id: 'prod-1',
          name: 'Slim Fit Denim',
          slug: 'slim-fit-denim',
          images: ['img.jpg'],
        },
      ];
      prisma.product.findMany.mockResolvedValue(suggestions);

      const result = await service.getSuggestions('slim');

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          deletedAt: null,
          name: { contains: 'slim', mode: 'insensitive' },
        },
        select: { id: true, name: true, slug: true, images: true },
        take: 6,
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(suggestions);
    });

    it('excludes soft-deleted products from suggestions', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.getSuggestions('slim');
      const call = prisma.product.findMany.mock.calls[0][0];
      expect(call.where.deletedAt).toBe(null);
    });
  });

  describe('searchProducts soft-delete filter', () => {
    it('includes deletedAt: null in the search WHERE', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);
      await service.searchProducts('denim', 1, 20);
      const call = prisma.product.findMany.mock.calls[0][0];
      expect(call.where.deletedAt).toBe(null);
    });
  });
});
