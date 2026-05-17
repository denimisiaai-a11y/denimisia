import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BundlesService } from './bundles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BundlesService', () => {
  let service: BundlesService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockBundle = {
    id: 'bun-1',
    name: 'Summer Bundle',
    slug: 'summer-bundle',
    isActive: true,
    items: [],
  };

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
        create: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BundlesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BundlesService);
  });

  it('should find all active bundles', async () => {
    prisma.productBundle.findMany.mockResolvedValue([mockBundle]);
    const result = await service.findAllActive();
    expect(prisma.productBundle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('should find bundle by slug', async () => {
    prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
    const result = await service.findBySlug('summer-bundle');
    expect(result).toEqual(mockBundle);
  });

  it('should throw when bundle not found by slug', async () => {
    prisma.productBundle.findUnique.mockResolvedValue(null);
    await expect(service.findBySlug('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should create bundle with items', async () => {
    prisma.productBundle.create.mockResolvedValue(mockBundle);
    const dto = {
      name: 'Summer',
      slug: 'summer',
      productIds: ['p1', 'p2'],
    } as any;
    const result = await service.create(dto);
    expect(prisma.productBundle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [{ productId: 'p1' }, { productId: 'p2' }] },
        }),
      }),
    );
  });

  it('should update bundle', async () => {
    prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
    prisma.productBundle.update.mockResolvedValue(mockBundle);
    const result = await service.update('bun-1', { name: 'Updated' } as any);
    expect(prisma.productBundle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bun-1' },
        data: { name: 'Updated' },
      }),
    );
  });

  it('should delete bundle and its items', async () => {
    prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
    await service.delete('bun-1');
    expect(prisma.bundleItem.deleteMany).toHaveBeenCalledWith({
      where: { bundleId: 'bun-1' },
    });
    expect(prisma.productBundle.delete).toHaveBeenCalledWith({
      where: { id: 'bun-1' },
    });
  });

  it('should add item to bundle', async () => {
    prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
    prisma.bundleItem.create.mockResolvedValue({});
    await service.addItem('bun-1', 'p1');
    expect(prisma.bundleItem.create).toHaveBeenCalledWith({
      data: { bundleId: 'bun-1', productId: 'p1' },
    });
  });

  it('should add multiple items to bundle', async () => {
    prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
    prisma.bundleItem.createMany.mockResolvedValue({ count: 2 });
    await service.addItems('bun-1', ['p1', 'p2']);
    expect(prisma.bundleItem.createMany).toHaveBeenCalledWith({
      data: [
        { bundleId: 'bun-1', productId: 'p1' },
        { bundleId: 'bun-1', productId: 'p2' },
      ],
      skipDuplicates: true,
    });
  });

  it('should remove item from bundle', async () => {
    prisma.bundleItem.delete.mockResolvedValue({});
    await service.removeItem('bun-1', 'p1');
    expect(prisma.bundleItem.delete).toHaveBeenCalledWith({
      where: {
        bundleId_productId_color: {
          bundleId: 'bun-1',
          productId: 'p1',
          color: '',
        },
      },
    });
  });
});
