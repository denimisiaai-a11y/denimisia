import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurationService } from './curation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CurationService', () => {
  let service: CurationService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockCuration = {
    id: 'cur-1',
    pageKey: 'home',
    sectionKey: 'new-arrivals',
    label: 'New Arrivals',
    sourceMode: 'COLLECTION',
    collectionId: 'col-1',
    maxItems: 12,
    isActive: true,
    products: [],
    collection: { id: 'col-1', name: 'Spring', slug: 'spring' },
  };

  beforeEach(async () => {
    prisma = {
      sectionCuration: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      sectionProduct: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn(),
      },
      collectionProduct: {
        findMany: jest.fn(),
      },
      collection: {
        findUnique: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CurationService);
  });

  describe('listByPage', () => {
    it('returns all curations for a pageKey with collection + product previews', async () => {
      prisma.sectionCuration.findMany.mockResolvedValue([mockCuration]);
      const result = await service.listByPage('home');
      expect(result).toEqual([mockCuration]);
      expect(prisma.sectionCuration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pageKey: 'home' },
          orderBy: { sectionKey: 'asc' },
        }),
      );
    });
  });

  describe('addProductsBulk', () => {
    it('skips duplicates and inserts only new ones with sequential positions', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(mockCuration);
      prisma.sectionProduct.findMany.mockResolvedValue([
        { productId: 'prod-1' },
      ]);
      prisma.sectionProduct.aggregate.mockResolvedValue({
        _max: { position: 4 },
      });
      prisma.sectionProduct.createMany.mockResolvedValue({ count: 2 });

      const result = await service.addProductsBulk('home', 'new-arrivals', [
        'prod-1',
        'prod-2',
        'prod-3',
      ]);

      expect(result).toEqual({ added: 2, skipped: 1 });
      expect(prisma.sectionProduct.createMany).toHaveBeenCalledWith({
        data: [
          {
            curationId: 'cur-1',
            productId: 'prod-2',
            position: 5,
            isPinned: false,
          },
          {
            curationId: 'cur-1',
            productId: 'prod-3',
            position: 6,
            isPinned: false,
          },
        ],
      });
    });

    it('returns skipped=length when everything is already in the section', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(mockCuration);
      prisma.sectionProduct.findMany.mockResolvedValue([
        { productId: 'prod-1' },
        { productId: 'prod-2' },
      ]);

      const result = await service.addProductsBulk('home', 'new-arrivals', [
        'prod-1',
        'prod-2',
      ]);

      expect(result).toEqual({ added: 0, skipped: 2 });
      expect(prisma.sectionProduct.createMany).not.toHaveBeenCalled();
    });
  });

  describe('fillFromCollection', () => {
    it('copies the collection product list into the section up to maxItems', async () => {
      prisma.sectionCuration.findUnique
        .mockResolvedValueOnce(mockCuration)
        .mockResolvedValueOnce(mockCuration);
      prisma.collectionProduct.findMany.mockResolvedValue([
        { productId: 'prod-1' },
        { productId: 'prod-2' },
      ]);
      prisma.sectionProduct.findMany.mockResolvedValue([]);
      prisma.sectionProduct.aggregate.mockResolvedValue({
        _max: { position: -1 },
      });
      prisma.sectionProduct.createMany.mockResolvedValue({ count: 2 });

      const result = await service.fillFromCollection('home', 'new-arrivals');

      expect(result.added).toBe(2);
      expect(prisma.collectionProduct.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            collectionId: 'col-1',
            product: { isActive: true, deletedAt: null },
          },
          take: 12,
        }),
      );
    });

    it('throws BadRequest when the section has no linked collection', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue({
        ...mockCuration,
        collectionId: null,
      });
      await expect(
        service.fillFromCollection('home', 'new-arrivals'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getOrCreate', () => {
    it('returns existing curation when found', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(mockCuration);
      const result = await service.getOrCreate('home', 'new-arrivals');
      expect(result).toEqual(mockCuration);
      expect(prisma.sectionCuration.create).not.toHaveBeenCalled();
    });

    it('creates a new curation with the supplied label when missing', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(null);
      prisma.sectionCuration.create.mockResolvedValue(mockCuration);
      await service.getOrCreate('home', 'new-arrivals', 'Fresh');
      expect(prisma.sectionCuration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { pageKey: 'home', sectionKey: 'new-arrivals', label: 'Fresh' },
        }),
      );
    });

    it('falls back to sectionKey as label when none provided', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(null);
      prisma.sectionCuration.create.mockResolvedValue(mockCuration);
      await service.getOrCreate('home', 'new-arrivals');
      expect(prisma.sectionCuration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ label: 'new-arrivals' }),
        }),
      );
    });
  });

  describe('resolve', () => {
    it('returns empty when no curation exists', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(null);
      const result = await service.resolve('home', 'new-arrivals');
      expect(result).toEqual({ curation: null, items: [] });
    });

    it('returns empty when curation isActive is false', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue({
        ...mockCuration,
        isActive: false,
      });
      const result = await service.resolve('home', 'new-arrivals');
      expect(result).toEqual({ curation: null, items: [] });
    });

    it('filters out inactive + soft-deleted products at the SQL layer', async () => {
      // BUG fix: MANUAL section pinned to a soft-deleted product previously
      // leaked onto storefront. Verify Prisma include uses the where filter.
      prisma.sectionCuration.findUnique.mockResolvedValue({
        ...mockCuration,
        sourceMode: 'MANUAL',
        products: [],
      });
      await service.resolve('home', 'new-arrivals');
      const callArgs = prisma.sectionCuration.findUnique.mock.calls[0][0];
      expect(callArgs.include.products.where).toEqual({
        product: { isActive: true, deletedAt: null },
      });
    });

    it('MANUAL mode returns only pinned products from the section', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue({
        ...mockCuration,
        sourceMode: 'MANUAL',
        products: [
          {
            id: 'sp-1',
            productId: 'prod-1',
            isPinned: true,
            position: 0,
            product: { id: 'prod-1', name: 'Tee' },
            customImage: null,
          },
        ],
      });
      const result = await service.resolve('home', 'new-arrivals');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        productId: 'prod-1',
        isManual: true,
      });
      expect(prisma.collectionProduct.findMany).not.toHaveBeenCalled();
    });

    it('COLLECTION mode loads from the linked collection', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue({
        ...mockCuration,
        sourceMode: 'COLLECTION',
        products: [],
      });
      prisma.collectionProduct.findMany.mockResolvedValue([
        { product: { id: 'prod-c1', name: 'CollProd' } },
      ]);
      const result = await service.resolve('home', 'new-arrivals');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        productId: 'prod-c1',
        isManual: false,
      });
    });

    it('MIXED mode prepends pinned manual picks, then fills from collection', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue({
        ...mockCuration,
        sourceMode: 'MIXED',
        products: [
          {
            id: 'sp-1',
            productId: 'prod-pinned',
            isPinned: true,
            position: 0,
            product: { id: 'prod-pinned', name: 'Pinned' },
            customImage: null,
          },
        ],
      });
      prisma.collectionProduct.findMany.mockResolvedValue([
        { product: { id: 'prod-pinned', name: 'Pinned' } }, // dup, must skip
        { product: { id: 'prod-c1', name: 'CollProd' } },
      ]);
      const result = await service.resolve('home', 'new-arrivals');
      expect(result.items[0].productId).toBe('prod-pinned');
      expect(result.items[1].productId).toBe('prod-c1');
      // Pinned product should NOT appear twice
      expect(
        result.items.filter((i) => i.productId === 'prod-pinned'),
      ).toHaveLength(1);
    });

    it('truncates the combined list to maxItems', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue({
        ...mockCuration,
        sourceMode: 'COLLECTION',
        maxItems: 2,
        products: [],
      });
      prisma.collectionProduct.findMany.mockResolvedValue([
        { product: { id: 'p1' } },
        { product: { id: 'p2' } },
        { product: { id: 'p3' } },
      ]);
      const result = await service.resolve('home', 'new-arrivals');
      expect(result.items).toHaveLength(2);
    });
  });

  describe('upsert', () => {
    it('upserts with full data when collectionId is valid', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'col-1' });
      prisma.sectionCuration.upsert.mockResolvedValue(mockCuration);
      await service.upsert('home', 'new-arrivals', {
        label: 'New Arrivals',
        sourceMode: 'COLLECTION' as any,
        collectionId: 'col-1',
        maxItems: 12,
      } as any);
      expect(prisma.sectionCuration.upsert).toHaveBeenCalled();
    });

    it('rejects when collectionId does not exist', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(
        service.upsert('home', 'new-arrivals', {
          label: 'x',
          sourceMode: 'COLLECTION' as any,
          collectionId: 'missing-id',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes collection disconnect when collectionId is explicit null', async () => {
      prisma.sectionCuration.upsert.mockResolvedValue(mockCuration);
      await service.upsert('home', 'new-arrivals', {
        label: 'x',
        sourceMode: 'MANUAL' as any,
        collectionId: null,
      } as any);
      const args = prisma.sectionCuration.upsert.mock.calls[0][0];
      expect(args.update.collection).toEqual({ disconnect: true });
    });
  });

  describe('addProduct', () => {
    it('adds a product to the section with next position', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(mockCuration);
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-x' });
      prisma.sectionProduct.findUnique.mockResolvedValue(null);
      prisma.sectionProduct.aggregate.mockResolvedValue({
        _max: { position: 3 },
      });
      prisma.sectionProduct.create.mockResolvedValue({ id: 'sp-new' });

      await service.addProduct('home', 'new-arrivals', {
        productId: 'prod-x',
      });

      expect(prisma.sectionProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            curationId: 'cur-1',
            productId: 'prod-x',
            position: 4,
          }),
        }),
      );
    });

    it('rejects when product does not exist', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(mockCuration);
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.addProduct('home', 'new-arrivals', {
          productId: 'missing',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when product already in the section', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(mockCuration);
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-x' });
      prisma.sectionProduct.findUnique.mockResolvedValue({ id: 'sp-already' });
      await expect(
        service.addProduct('home', 'new-arrivals', {
          productId: 'prod-x',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProduct', () => {
    it('updates position and isPinned when provided', async () => {
      prisma.sectionProduct.update.mockResolvedValue({});
      await service.updateProduct('sp-1', { position: 5, isPinned: true });
      expect(prisma.sectionProduct.update).toHaveBeenCalledWith({
        where: { id: 'sp-1' },
        data: { position: 5, isPinned: true },
        include: { product: true, customImage: true },
      });
    });

    it('connects customImage when assetId provided, disconnects on null', async () => {
      prisma.sectionProduct.update.mockResolvedValue({});
      await service.updateProduct('sp-1', { customImageAssetId: 'asset-1' });
      let args = prisma.sectionProduct.update.mock.calls[0][0];
      expect(args.data.customImage).toEqual({ connect: { id: 'asset-1' } });

      await service.updateProduct('sp-1', { customImageAssetId: null });
      args = prisma.sectionProduct.update.mock.calls[1][0];
      expect(args.data.customImage).toEqual({ disconnect: true });
    });
  });

  describe('removeProduct', () => {
    it('deletes by sectionProductId', async () => {
      prisma.sectionProduct.delete.mockResolvedValue({});
      await service.removeProduct('sp-1');
      expect(prisma.sectionProduct.delete).toHaveBeenCalledWith({
        where: { id: 'sp-1' },
      });
    });
  });

  describe('reorder', () => {
    it('issues an updateMany per id inside a $transaction, then returns the refreshed section', async () => {
      prisma.sectionCuration.findUnique.mockResolvedValue(mockCuration);
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      await service.reorder('home', 'new-arrivals', ['prod-2', 'prod-1']);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.sectionProduct.updateMany).toHaveBeenCalledWith({
        where: { curationId: 'cur-1', productId: 'prod-2' },
        data: { position: 0 },
      });
      expect(prisma.sectionProduct.updateMany).toHaveBeenCalledWith({
        where: { curationId: 'cur-1', productId: 'prod-1' },
        data: { position: 1 },
      });
    });
  });

  describe('searchProducts', () => {
    it('returns the 10 newest active products when query is empty', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.searchProducts('');
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      );
    });

    it('searches by name OR slug OR description OR variant SKU when query provided', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.searchProducts('slim');
      const args = prisma.product.findMany.mock.calls[0][0];
      expect(args.where.OR).toEqual(
        expect.arrayContaining([
          { name: { contains: 'slim', mode: 'insensitive' } },
          { slug: { contains: 'slim', mode: 'insensitive' } },
          { description: { contains: 'slim', mode: 'insensitive' } },
          {
            variants: {
              some: { sku: { contains: 'slim', mode: 'insensitive' } },
            },
          },
        ]),
      );
    });

    it('caps limit at 25', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.searchProducts('x', 100);
      const args = prisma.product.findMany.mock.calls[0][0];
      expect(args.take).toBe(25);
    });
  });
});
