import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockCategory = {
    id: 'cat-1',
    name: 'Jeans',
    slug: 'jeans',
    description: 'Denim jeans',
    children: [],
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  it('finds all root categories, filtering out soft-deleted at every level', async () => {
    prisma.category.findMany.mockResolvedValue([mockCategory]);
    const result = await service.findAll();
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { parentId: null, deletedAt: null },
      include: {
        children: {
          where: { deletedAt: null },
          include: { children: { where: { deletedAt: null } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([mockCategory]);
  });

  it('finds category by slug, filtering soft-deleted children and products', async () => {
    const withProducts = { ...mockCategory, deletedAt: null, products: [] };
    prisma.category.findUnique.mockResolvedValue(withProducts);
    const result = await service.findBySlug('jeans');
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { slug: 'jeans' },
      include: {
        children: { where: { deletedAt: null } },
        products: {
          where: { isActive: true, deletedAt: null },
          include: { variants: true },
          take: 24,
        },
      },
    });
    expect(result).toEqual(withProducts);
  });

  it('treats a soft-deleted category as not found, even when slug matches', async () => {
    prisma.category.findUnique.mockResolvedValue({
      ...mockCategory,
      deletedAt: new Date(),
      products: [],
    });
    await expect(service.findBySlug('jeans')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when category not found by slug', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.findBySlug('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should create category', async () => {
    prisma.category.create.mockResolvedValue(mockCategory);
    const result = await service.create({
      name: 'Jeans',
      slug: 'jeans',
    } as any);
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Jeans', slug: 'jeans' },
    });
  });

  it('should update category', async () => {
    prisma.category.findUnique.mockResolvedValue(mockCategory);
    prisma.category.update.mockResolvedValue({
      ...mockCategory,
      name: 'Updated',
    });
    const result = await service.update('cat-1', { name: 'Updated' } as any);
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { name: 'Updated' },
    });
  });

  it('should delete category', async () => {
    prisma.category.findUnique.mockResolvedValue(mockCategory);
    prisma.category.delete.mockResolvedValue(mockCategory);
    await service.delete('cat-1');
    expect(prisma.category.delete).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
    });
  });
});
