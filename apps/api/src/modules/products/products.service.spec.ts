import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockProduct = {
    id: 'prod-1',
    name: 'Slim Fit Denim',
    slug: 'slim-fit-denim',
    description: 'Premium denim jeans',
    price: 2500,
    isActive: true,
    isFeatured: true,
    categoryId: 'cat-1',
    images: ['image1.jpg'],
    createdAt: new Date('2025-01-01'),
    category: { id: 'cat-1', name: 'Jeans', slug: 'jeans' },
    variants: [
      {
        id: 'var-1',
        sku: 'SFD-32-BLU',
        size: '32',
        color: 'Blue',
        price: 2500,
        stock: 10,
        images: [],
      },
    ],
    _count: { reviews: 5 },
  };

  const mockVariant = {
    id: 'var-1',
    sku: 'SFD-32-BLU',
    size: '32',
    color: 'Blue',
    price: 2500,
    stock: 10,
    productId: 'prod-1',
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productVariant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  // ─── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated products with default pagination', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 24,
        }),
      );
      expect(result).toEqual({
        products: [mockProduct],
        total: 1,
        page: 1,
        limit: 24,
        totalPages: 1,
      });
    });

    it('should apply page and limit from query', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(50);

      const result = await service.findAll({ page: '2', limit: '10' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
    });

    it('should filter by category slug', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ category: 'jeans' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            category: { slug: 'jeans' },
          }),
        }),
      );
    });

    it('should filter by collection slug', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ collection: 'summer-2025' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            collections: {
              some: { collection: { slug: 'summer-2025' } },
            },
          }),
        }),
      );
    });

    it('should sort by price ascending', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ sort: 'price_asc' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { price: 'asc' },
        }),
      );
    });

    it('should sort by price descending', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ sort: 'price_desc' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { price: 'desc' },
        }),
      );
    });

    it('should sort by oldest', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ sort: 'oldest' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('should default sort to newest (createdAt desc)', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should include category, variants, and review count', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            category: expect.any(Object),
            variants: expect.any(Object),
            _count: { select: { reviews: true } },
          }),
        }),
      );
    });
  });

  // ─── findFeatured() ───────────────────────────────────────────────────────

  describe('findFeatured', () => {
    it('should return up to 8 featured active products', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findFeatured();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, isFeatured: true },
          take: 8,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([mockProduct]);
    });
  });

  // ─── findNewArrivals() ────────────────────────────────────────────────────

  describe('findNewArrivals', () => {
    it('returns up to 8 admin-flagged isNewArrival products', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findNewArrivals();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, isNewArrival: true },
          take: 8,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([mockProduct]);
    });

    it('falls back to recent active products when no flagged rows exist', async () => {
      // First call: zero flagged rows.
      // Second call (fallback): a populated list keeps the homepage section
      // from rendering empty.
      prisma.product.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockProduct]);

      const result = await service.findNewArrivals();

      expect(prisma.product.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.product.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { isActive: true, isNewArrival: true },
        }),
      );
      expect(prisma.product.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { isActive: true },
          take: 8,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([mockProduct]);
    });
  });

  // ─── findBySlug() ─────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('should return product with variants, reviews, and collections', async () => {
      const fullProduct = {
        ...mockProduct,
        reviews: [],
        collections: [],
      };
      prisma.product.findUnique.mockResolvedValue(fullProduct);

      const result = await service.findBySlug('slim-fit-denim');

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { slug: 'slim-fit-denim' },
        include: expect.objectContaining({
          category: true,
          variants: true,
          reviews: expect.any(Object),
          collections: expect.any(Object),
        }),
      });
      expect(result).toEqual(fullProduct);
    });

    it('should throw NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when product is inactive', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await expect(service.findBySlug('inactive-product')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── create() ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create product with variants', async () => {
      const dto = {
        name: 'New Product',
        slug: 'new-product',
        description: 'A new product',
        price: 1500,
        categoryId: 'cat-1',
        variants: [
          { sku: 'NP-S', size: 'S', color: 'Black', price: 1500, stock: 20 },
        ],
      };
      const created = { id: 'prod-new', ...dto, variants: dto.variants };
      prisma.product.create.mockResolvedValue(created);

      const result = await service.create(dto as any);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          price: dto.price,
          categoryId: dto.categoryId,
          variants: { create: dto.variants },
        },
        include: { variants: true, category: true },
      });
      expect(result).toEqual(created);
    });

    it('should create product without variants when none provided', async () => {
      const dto = {
        name: 'Simple Product',
        slug: 'simple-product',
        description: 'No variants',
        price: 1000,
        categoryId: 'cat-1',
      };
      const created = { id: 'prod-simple', ...dto };
      prisma.product.create.mockResolvedValue(created);

      await service.create(dto as any);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          variants: undefined,
        }),
        include: { variants: true, category: true },
      });
    });
  });

  // ─── update() ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update existing product', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      const updated = { ...mockProduct, name: 'Updated Name' };
      prisma.product.update.mockResolvedValue(updated);

      const result = await service.update('prod-1', {
        name: 'Updated Name',
      } as any);

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { name: 'Updated Name' },
        include: { variants: true, category: true },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── softDelete() ─────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should mark product as inactive', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      const result = await service.softDelete('prod-1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.softDelete('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── addVariant() ─────────────────────────────────────────────────────────

  describe('addVariant', () => {
    it('should add variant to existing product', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productVariant.findMany.mockResolvedValue([]); // no siblings yet
      const variantDto = {
        sku: 'SFD-34-RED',
        size: '34',
        color: 'Red',
        price: 2500,
        stock: 15,
      };
      const createdVariant = {
        id: 'var-new',
        ...variantDto,
        productId: 'prod-1',
      };
      prisma.productVariant.create.mockResolvedValue(createdVariant);

      const result = await service.addVariant('prod-1', variantDto as any);

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
      });
      expect(prisma.productVariant.create).toHaveBeenCalledWith({
        data: { ...variantDto, productId: 'prod-1' },
      });
      expect(result).toEqual(createdVariant);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.addVariant('non-existent', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    // ─── Per-color image invariant (LR-001 D1) ─────────────────────────────
    // The admin product-create UI collects images per color, then duplicates
    // the same array across every variant of that color on save. This API
    // gate prevents direct writes from breaking the convention.

    it('accepts a new variant whose images match siblings of the same color', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      // One existing variant of color "Blue" with image set [a, b]
      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-existing', images: ['a.jpg', 'b.jpg'] },
      ]);
      const variantDto = {
        sku: 'NEW-BLUE-M',
        size: 'M',
        color: 'Blue',
        price: 2500,
        stock: 10,
        images: ['a.jpg', 'b.jpg'], // matches sibling exactly
      };
      prisma.productVariant.create.mockResolvedValue({
        id: 'var-new',
        ...variantDto,
      });

      await expect(
        service.addVariant('prod-1', variantDto as any),
      ).resolves.toBeDefined();
    });

    it('rejects a new variant whose images differ from siblings of same color (409)', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-existing', images: ['a.jpg', 'b.jpg'] },
      ]);
      const variantDto = {
        sku: 'NEW-BLUE-L',
        size: 'L',
        color: 'Blue',
        price: 2500,
        stock: 5,
        images: ['c.jpg'], // does NOT match
      };

      await expect(
        service.addVariant('prod-1', variantDto as any),
      ).rejects.toThrow(ConflictException);
      expect(prisma.productVariant.create).not.toHaveBeenCalled();
    });

    it('rejects when image order differs even though contents are the same', async () => {
      // Order matters: image[0] is the primary thumbnail per the product
      // model's contract. Swapping the order would silently re-thumbnail
      // every variant of the same color.
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-existing', images: ['a.jpg', 'b.jpg', 'c.jpg'] },
      ]);
      await expect(
        service.addVariant('prod-1', {
          sku: 'NEW',
          size: 'L',
          color: 'Blue',
          price: 100,
          stock: 1,
          images: ['c.jpg', 'a.jpg', 'b.jpg'],
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('first variant of a new color sets the canonical image set', async () => {
      // No siblings yet -> the variant being added establishes the canon.
      // No exception even if `images` is arbitrary.
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.productVariant.findMany.mockResolvedValue([]);
      prisma.productVariant.create.mockResolvedValue({ id: 'var-new' });

      await expect(
        service.addVariant('prod-1', {
          sku: 'FIRST-GREEN-S',
          size: 'S',
          color: 'Green',
          price: 100,
          stock: 1,
          images: ['anything.jpg'],
        } as any),
      ).resolves.toBeDefined();
    });
  });

  // ─── updateVariant() ──────────────────────────────────────────────────────

  describe('updateVariant', () => {
    it('should update variant for product', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(mockVariant);
      const updated = { ...mockVariant, stock: 25 };
      prisma.productVariant.update.mockResolvedValue(updated);

      const result = await service.updateVariant('prod-1', 'var-1', {
        stock: 25,
      } as any);

      expect(prisma.productVariant.findFirst).toHaveBeenCalledWith({
        where: { id: 'var-1', productId: 'prod-1' },
      });
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { stock: 25 },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when variant not found for product', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(null);

      await expect(
        service.updateVariant('prod-1', 'var-999', {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteVariant() ──────────────────────────────────────────────────────

  describe('deleteVariant', () => {
    it('should delete variant from product', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(mockVariant);
      prisma.productVariant.delete.mockResolvedValue(mockVariant);

      await service.deleteVariant('prod-1', 'var-1');

      expect(prisma.productVariant.delete).toHaveBeenCalledWith({
        where: { id: 'var-1' },
      });
    });

    it('should throw NotFoundException when variant not found', async () => {
      prisma.productVariant.findFirst.mockResolvedValue(null);

      await expect(service.deleteVariant('prod-1', 'var-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── findById() ───────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return product when found', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findById('prod-1');

      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
