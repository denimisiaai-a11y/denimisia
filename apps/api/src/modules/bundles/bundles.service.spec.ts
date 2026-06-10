import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { BundlesService } from './bundles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BundlesService', () => {
  let service: BundlesService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockBundle = {
    id: 'bun-1',
    name: 'Heritage Bundle',
    slug: 'heritage-bundle',
    bundlePrice: 2500,
    availableSizes: ['S', 'M', 'L'],
    isActive: false,
    items: [
      { id: 'bi-1', bundleId: 'bun-1', productId: 'prod-1', color: 'Black' },
      { id: 'bi-2', bundleId: 'bun-1', productId: 'prod-2', color: 'Indigo' },
    ],
  };

  const validCreateDto = {
    name: 'Heritage Bundle',
    slug: 'heritage-bundle',
    badgeText: 'BEST DEAL',
    bundlePrice: 2500,
    availableSizes: ['S', 'M', 'L'],
    items: [
      { productId: 'prod-1', color: 'Black' },
      { productId: 'prod-2', color: 'Indigo' },
    ],
  };

  const fullVariantCover = [
    { productId: 'prod-1', color: 'Black', size: 'S' },
    { productId: 'prod-1', color: 'Black', size: 'M' },
    { productId: 'prod-1', color: 'Black', size: 'L' },
    { productId: 'prod-2', color: 'Indigo', size: 'S' },
    { productId: 'prod-2', color: 'Indigo', size: 'M' },
    { productId: 'prod-2', color: 'Indigo', size: 'L' },
  ];

  beforeEach(async () => {
    prisma = {
      productBundle: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      bundleItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
      },
      productVariant: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BundlesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BundlesService);
  });

  describe('findAllActive', () => {
    it('returns active bundles ordered by createdAt desc with items + variants', async () => {
      prisma.productBundle.findMany.mockResolvedValue([mockBundle]);
      const result = await service.findAllActive();
      expect(result).toEqual([mockBundle]);
      expect(prisma.productBundle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findBySlug', () => {
    it('returns the bundle when slug exists', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      const result = await service.findBySlug('heritage-bundle');
      expect(result).toEqual(mockBundle);
    });

    it('throws NotFound when slug does not resolve', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a bundle with items when all variants exist', async () => {
      prisma.productVariant.findMany.mockResolvedValue(fullVariantCover);
      prisma.productBundle.create.mockResolvedValue(mockBundle);

      const result = await service.create(validCreateDto as any);

      expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            { productId: 'prod-1', color: 'Black', size: 'S', deletedAt: null },
            { productId: 'prod-1', color: 'Black', size: 'M', deletedAt: null },
            { productId: 'prod-1', color: 'Black', size: 'L', deletedAt: null },
            {
              productId: 'prod-2',
              color: 'Indigo',
              size: 'S',
              deletedAt: null,
            },
            {
              productId: 'prod-2',
              color: 'Indigo',
              size: 'M',
              deletedAt: null,
            },
            {
              productId: 'prod-2',
              color: 'Indigo',
              size: 'L',
              deletedAt: null,
            },
          ]),
        },
        select: { productId: true, color: true, size: true },
      });
      expect(prisma.productBundle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bundlePrice: 2500,
            availableSizes: ['S', 'M', 'L'],
            items: {
              create: [
                { productId: 'prod-1', color: 'Black' },
                { productId: 'prod-2', color: 'Indigo' },
              ],
            },
          }),
        }),
      );
      expect(result).toEqual(mockBundle);
    });

    it('rejects when availableSizes has duplicates', async () => {
      await expect(
        service.create({
          ...validCreateDto,
          availableSizes: ['S', 'M', 'S'],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.productBundle.create).not.toHaveBeenCalled();
    });

    it('rejects when two items share the same (productId, color) pair', async () => {
      await expect(
        service.create({
          ...validCreateDto,
          items: [
            { productId: 'prod-1', color: 'Black' },
            { productId: 'prod-1', color: 'Black' },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.productBundle.create).not.toHaveBeenCalled();
    });

    it('rejects when a required (product, color, size) variant does not exist', async () => {
      // Missing prod-2/Indigo/L
      prisma.productVariant.findMany.mockResolvedValue(
        fullVariantCover.slice(0, 5),
      );
      await expect(service.create(validCreateDto as any)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.productBundle.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a bundle without re-validating when availableSizes is unchanged', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productBundle.update.mockResolvedValue(mockBundle);

      const result = await service.update('bun-1', { name: 'Renamed' } as any);

      expect(prisma.productVariant.findMany).not.toHaveBeenCalled();
      expect(prisma.productBundle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bun-1' },
          data: { name: 'Renamed' },
        }),
      );
      expect(result).toEqual(mockBundle);
    });

    it('re-runs the integrity check when availableSizes changes', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue([
        { productId: 'prod-1', color: 'Black', size: 'XL' },
        { productId: 'prod-2', color: 'Indigo', size: 'XL' },
      ]);
      prisma.productBundle.update.mockResolvedValue(mockBundle);

      await service.update('bun-1', { availableSizes: ['XL'] } as any);

      expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            {
              productId: 'prod-1',
              color: 'Black',
              size: 'XL',
              deletedAt: null,
            },
            {
              productId: 'prod-2',
              color: 'Indigo',
              size: 'XL',
              deletedAt: null,
            },
          ]),
        },
        select: { productId: true, color: true, size: true },
      });
    });

    it('rejects an availableSizes change that orphans an item', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      // No variant exists in the requested new size for prod-2/Indigo
      prisma.productVariant.findMany.mockResolvedValue([
        { productId: 'prod-1', color: 'Black', size: 'XL' },
      ]);

      await expect(
        service.update('bun-1', { availableSizes: ['XL'] } as any),
      ).rejects.toThrow(ConflictException);
      expect(prisma.productBundle.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when the bundle does not exist', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { name: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('cascades to bundle items then deletes the bundle', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      await service.delete('bun-1');
      expect(prisma.bundleItem.deleteMany).toHaveBeenCalledWith({
        where: { bundleId: 'bun-1' },
      });
      expect(prisma.productBundle.delete).toHaveBeenCalledWith({
        where: { id: 'bun-1' },
      });
    });
  });

  describe('addItems', () => {
    it('appends new items after revalidating against the existing availableSizes', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue([
        ...fullVariantCover,
        { productId: 'prod-3', color: 'Olive', size: 'S' },
        { productId: 'prod-3', color: 'Olive', size: 'M' },
        { productId: 'prod-3', color: 'Olive', size: 'L' },
      ]);
      prisma.bundleItem.createMany.mockResolvedValue({ count: 1 });

      await service.addItems('bun-1', [
        { productId: 'prod-3', color: 'Olive' },
      ]);

      expect(prisma.bundleItem.createMany).toHaveBeenCalledWith({
        data: [{ bundleId: 'bun-1', productId: 'prod-3', color: 'Olive' }],
        skipDuplicates: true,
      });
    });

    it('rejects when the new item lacks a variant for one of the bundle sizes', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue([
        ...fullVariantCover,
        { productId: 'prod-3', color: 'Olive', size: 'S' },
        // missing M and L for prod-3/Olive
      ]);

      await expect(
        service.addItems('bun-1', [{ productId: 'prod-3', color: 'Olive' }]),
      ).rejects.toThrow(ConflictException);
      expect(prisma.bundleItem.createMany).not.toHaveBeenCalled();
    });

    it('rejects when the bundle has empty availableSizes (legacy / un-reconfigured)', async () => {
      prisma.productBundle.findUnique.mockResolvedValue({
        ...mockBundle,
        availableSizes: [],
        items: [],
      });

      await expect(
        service.addItems('bun-1', [{ productId: 'prod-3', color: 'Olive' }]),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bundleItem.createMany).not.toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('deletes by the three-tuple compound key', async () => {
      prisma.bundleItem.delete.mockResolvedValue({});
      await service.removeItem('bun-1', 'prod-1', 'Black');
      expect(prisma.bundleItem.delete).toHaveBeenCalledWith({
        where: {
          bundleId_productId_color: {
            bundleId: 'bun-1',
            productId: 'prod-1',
            color: 'Black',
          },
        },
      });
    });
  });
});
