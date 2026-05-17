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

  it('should find all active collections', async () => {
    prisma.collection.findMany.mockResolvedValue([mockCollection]);
    const result = await service.findAll();
    expect(prisma.collection.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  });

  it('should find collection by slug', async () => {
    const withProducts = { ...mockCollection, products: [] };
    prisma.collection.findUnique.mockResolvedValue(withProducts);
    const result = await service.findBySlug('summer-2025');
    expect(result).toEqual(withProducts);
  });

  it('should throw NotFoundException when collection not found', async () => {
    prisma.collection.findUnique.mockResolvedValue(null);
    await expect(service.findBySlug('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should create collection', async () => {
    prisma.collection.create.mockResolvedValue(mockCollection);
    const result = await service.create({
      name: 'Summer',
      slug: 'summer',
    } as any);
    expect(prisma.collection.create).toHaveBeenCalledWith({
      data: { name: 'Summer', slug: 'summer' },
    });
  });

  it('should update collection', async () => {
    prisma.collection.findUnique.mockResolvedValue(mockCollection);
    prisma.collection.update.mockResolvedValue({
      ...mockCollection,
      name: 'Updated',
    });
    const result = await service.update('col-1', { name: 'Updated' } as any);
    expect(prisma.collection.update).toHaveBeenCalledWith({
      where: { id: 'col-1' },
      data: { name: 'Updated' },
    });
  });

  it('should delete collection', async () => {
    prisma.collection.findUnique.mockResolvedValue(mockCollection);
    await service.delete('col-1');
    expect(prisma.collection.delete).toHaveBeenCalledWith({
      where: { id: 'col-1' },
    });
  });

  it('should add products to collection', async () => {
    prisma.collection.findUnique.mockResolvedValue(mockCollection);
    prisma.collectionProduct.createMany.mockResolvedValue({ count: 2 });
    await service.addProducts('col-1', { productIds: ['p1', 'p2'] } as any);
    expect(prisma.collectionProduct.createMany).toHaveBeenCalledWith({
      data: [
        { collectionId: 'col-1', productId: 'p1' },
        { collectionId: 'col-1', productId: 'p2' },
      ],
      skipDuplicates: true,
    });
  });

  it('should remove product from collection', async () => {
    prisma.collectionProduct.delete.mockResolvedValue({});
    await service.removeProduct('col-1', 'p1');
    expect(prisma.collectionProduct.delete).toHaveBeenCalledWith({
      where: {
        collectionId_productId: { collectionId: 'col-1', productId: 'p1' },
      },
    });
  });
});
