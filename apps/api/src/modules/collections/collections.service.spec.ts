import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CollectionsAutoService } from './collections.auto.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let prisma: Record<string, Record<string, jest.Mock>> & {
    $transaction: jest.Mock;
  };
  let auto: { resolve: jest.Mock };

  const mockCollection = {
    id: 'col-1',
    name: 'Summer 2025',
    slug: 'summer-2025',
    description: 'Summer collection',
    type: 'EDIT' as const,
    isActive: true,
    startDate: null as Date | null,
    endDate: null as Date | null,
    deletedAt: null as Date | null,
    autoRules: null,
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
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      collectionLookbook: {
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    } as never;

    auto = { resolve: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CollectionsAutoService, useValue: auto },
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
    it('returns the collection when active, in-window, not soft-deleted', async () => {
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
      await expect(service.findBySlug('summer-2025')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when inactive', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        ...mockCollection,
        isActive: false,
        products: [],
      });
      await expect(service.findBySlug('summer-2025')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when startDate is in the future', async () => {
      const future = new Date(Date.now() + 86_400_000);
      prisma.collection.findUnique.mockResolvedValue({
        ...mockCollection,
        startDate: future,
        products: [],
      });
      await expect(service.findBySlug('summer-2025')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when endDate is in the past', async () => {
      const past = new Date(Date.now() - 86_400_000);
      prisma.collection.findUnique.mockResolvedValue({
        ...mockCollection,
        endDate: past,
        products: [],
      });
      await expect(service.findBySlug('summer-2025')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when no match', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlugResolved', () => {
    it('returns auto-resolved products for AUTO type', async () => {
      const autoCollection = {
        ...mockCollection,
        type: 'AUTO' as const,
        autoRules: { includeIfBestseller: true },
        products: [],
        lookbook: [],
      };
      prisma.collection.findUnique.mockResolvedValue(autoCollection);
      auto.resolve.mockResolvedValue([{ position: 0, product: { id: 'p1' } }]);
      const result = await service.findBySlugResolved('bestsellers');
      expect(auto.resolve).toHaveBeenCalled();
      expect(result.products).toEqual([{ position: 0, product: { id: 'p1' } }]);
    });

    it('returns manual products for non-AUTO type', async () => {
      const editCollection = {
        ...mockCollection,
        type: 'EDIT' as const,
        products: [{ position: 0, product: { id: 'p1' } }],
        lookbook: [],
      };
      prisma.collection.findUnique.mockResolvedValue(editCollection);
      const result = await service.findBySlugResolved('baggy');
      expect(auto.resolve).not.toHaveBeenCalled();
      expect(result.products).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('passes the dto through to Prisma create', async () => {
      prisma.collection.create.mockResolvedValue(mockCollection);
      await service.create({ name: 'Summer', slug: 'summer' } as never);
      expect(prisma.collection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Summer', slug: 'summer' }),
      });
    });
  });

  describe('update', () => {
    it('updates after asserting row exists, converting date strings', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collection.update.mockResolvedValue({ ...mockCollection, name: 'Updated' });
      await service.update('col-1', {
        name: 'Updated',
        startDate: '2026-06-01T00:00:00Z',
      } as never);
      const call = prisma.collection.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'col-1' });
      expect(call.data.name).toBe('Updated');
      expect(call.data.startDate).toBeInstanceOf(Date);
    });

    it('throws NotFound when row missing', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' } as never)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('hard-deletes after asserting the row exists', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      await service.delete('col-1');
      expect(prisma.collection.delete).toHaveBeenCalledWith({ where: { id: 'col-1' } });
    });
  });

  describe('addProducts', () => {
    it('assigns sequential positions starting from max+1', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.aggregate.mockResolvedValue({ _max: { position: 4 } });
      prisma.collectionProduct.createMany.mockResolvedValue({ count: 2 });

      await service.addProducts('col-1', { productIds: ['p1', 'p2'] } as never);

      expect(prisma.collectionProduct.createMany).toHaveBeenCalledWith({
        data: [
          { collectionId: 'col-1', productId: 'p1', position: 5 },
          { collectionId: 'col-1', productId: 'p2', position: 6 },
        ],
        skipDuplicates: true,
      });
    });

    it('starts at position 0 when empty', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.aggregate.mockResolvedValue({ _max: { position: null } });
      prisma.collectionProduct.createMany.mockResolvedValue({ count: 1 });

      await service.addProducts('col-1', { productIds: ['p1'] } as never);

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
        where: { collectionId_productId: { collectionId: 'col-1', productId: 'p1' } },
      });
    });
  });

  describe('reorderProducts', () => {
    it('updates position based on array index in a transaction', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionProduct.update.mockResolvedValue({});
      await service.reorderProducts('col-1', ['pA', 'pB', 'pC']);
      expect(prisma.collectionProduct.update).toHaveBeenCalledWith({
        where: { collectionId_productId: { collectionId: 'col-1', productId: 'pA' } },
        data: { position: 0 },
      });
      expect(prisma.collectionProduct.update).toHaveBeenCalledWith({
        where: { collectionId_productId: { collectionId: 'col-1', productId: 'pC' } },
        data: { position: 2 },
      });
    });
  });

  describe('upsertLookbookItem', () => {
    it('creates a lookbook item attached to the collection', async () => {
      prisma.collection.findUnique.mockResolvedValue(mockCollection);
      prisma.collectionLookbook.create.mockResolvedValue({ id: 'lb1' });
      await service.upsertLookbookItem('col-1', { imageUrl: 'x.jpg', position: 0 } as never);
      expect(prisma.collectionLookbook.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          collectionId: 'col-1',
          imageUrl: 'x.jpg',
          position: 0,
        }),
      });
    });
  });

  describe('removeLookbookItem', () => {
    it('deletes by id', async () => {
      prisma.collectionLookbook.delete.mockResolvedValue({});
      await service.removeLookbookItem('lb1');
      expect(prisma.collectionLookbook.delete).toHaveBeenCalledWith({ where: { id: 'lb1' } });
    });
  });
});
