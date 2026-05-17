import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockCollection = {
    id: 'col-1',
    name: 'Summer 2025',
    slug: 'summer-2025',
    description: 'Summer collection',
    isActive: true,
    startDate: null as Date | null,
    endDate: null as Date | null,
    deletedAt: null as Date | null,
    _count: { products: 5 },
  };

  beforeEach(async () => {
    prisma = {
      collection: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      collectionProduct: {
        createMany: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CollectionsService);
  });

  describe('findAll', () => {
    it('filters active + not-soft-deleted + currently-in-window', async () => {
      prisma.collection.findMany.mockResolvedValue([mockCollection]);
      await service.findAll();
      const call = prisma.collection.findMany.mock.calls[0][0];
      expect(call.where.isActive).toBe(true);
      expect(call.where.deletedAt).toBe(null);
      expect(call.where.AND).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              { startDate: null },
              expect.objectContaining({ startDate: expect.any(Object) }),
            ]),
          }),
        ]),
      );
    });
  });

  describe('findBySlug', () => {
    it('returns the collection when active, in-window, and not soft-deleted', async () => {
      const withProducts = { ...mockCollection, products: [] };
      prisma.collection.findUnique.mockResolvedValue(withProducts);
      const result = await service.findBySlug('summer-2025');
      expect(result).toEqual(withProducts);
    });

    it('throws NotFound when soft-deleted', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        ...mockCollection,
        deletedAt: new Date(),
        products: [],
      });
      await expect(service.findBySlug('summer-2025')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound when inactive', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        ...mockCollection,
        isActive: false,
        products: [],
      });
      await expect(service.findBySlug('summer-2025')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound when startDate is in the future', async () => {
      const future = new Date(Date.now() + 86400000);
      prisma.collection.findUnique.mockResolvedValue({
        ...mockCollection,
        startDate: future,
        products: [],
      });
      await expect(service.findBySlug('summer-2025')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound when endDate is in the past', async () => {
      const past = new Date(Date.now() - 86400000);
      prisma.collection.findUnique.mockResolvedValue({
        ...mockCollection,
        endDate: past,
        products: [],
      });
      await expect(service.findBySlug('summer-2025')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFound when no match', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('filters soft-deleted + inactive products and orders by position', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        ...mockCollection,
        products: [],
      });
      await service.findBySlug('summer-2025');
      const call = prisma.collection.findUnique.mock.calls[0][0];
      expect(call.include.products.where).toEqual({
        product: { isActive: true, deletedAt: null },
      });
      expect(call.include.products.orderBy).toEqual({ position: 'asc' });
    });
  });

  describe('create', () => {
    it('passes the dto through to Prisma create', async () => {
      prisma.collection.create.mockResolvedValue(mockCollection);
      await service.create({ name: 'Summer', slug: 'summer' } as any);
      expect(prisma.collection.create).toHaveBeenCalledWith({
        data: { name: 'Summer', slug: 'summer' },
      });
    });
  });

  describe('update', () => {
    it('updates after asserting the row exists', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collection.update.mockResolvedValue({
        ...mockCollection,
        name: 'Updated',
      });
      await service.update('col-1', { name: 'Updated' } as any);
      expect(prisma.collection.update).toHaveBeenCalledWith({
        where: { id: 'col-1' },
        data: { name: 'Updated' },
      });
    });

    it('throws NotFound when the row does not exist', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { name: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('hard-deletes after asserting the row exists', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      await service.delete('col-1');
      expect(prisma.collection.delete).toHaveBeenCalledWith({
        where: { id: 'col-1' },
      });
    });
  });

  describe('addProducts', () => {
    it('assigns sequential positions starting from max+1', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.aggregate.mockResolvedValue({
        _max: { position: 4 },
      });
      prisma.collectionProduct.createMany.mockResolvedValue({ count: 2 });

      await service.addProducts('col-1', {
        productIds: ['p1', 'p2'],
      } as any);

      expect(prisma.collectionProduct.createMany).toHaveBeenCalledWith({
        data: [
          { collectionId: 'col-1', productId: 'p1', position: 5 },
          { collectionId: 'col-1', productId: 'p2', position: 6 },
        ],
        skipDuplicates: true,
      });
    });

    it('starts at position 0 when the collection is empty', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.aggregate.mockResolvedValue({
        _max: { position: null },
      });
      prisma.collectionProduct.createMany.mockResolvedValue({ count: 1 });

      await service.addProducts('col-1', { productIds: ['p1'] } as any);

      expect(prisma.collectionProduct.createMany).toHaveBeenCalledWith({
        data: [{ collectionId: 'col-1', productId: 'p1', position: 0 }],
        skipDuplicates: true,
      });
    });
  });

  describe('removeProduct', () => {
    it('deletes by compound key', async () => {
      prisma.collectionProduct.delete.mockResolvedValue({});
      await service.removeProduct('col-1', 'p1');
      expect(prisma.collectionProduct.delete).toHaveBeenCalledWith({
        where: {
          collectionId_productId: { collectionId: 'col-1', productId: 'p1' },
        },
      });
    });
  });
});
