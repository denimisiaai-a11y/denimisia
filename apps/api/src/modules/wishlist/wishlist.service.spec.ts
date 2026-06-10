import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WishlistService', () => {
  let service: WishlistService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockProduct = {
    id: 'prod-1',
    name: 'Slim Fit Denim',
    slug: 'slim-fit-denim',
    price: 2500,
    isActive: true,
    deletedAt: null as Date | null,
    images: ['image1.jpg'],
    variants: [
      { id: 'var-1', stock: 10 },
      { id: 'var-2', stock: 5 },
    ],
  };

  const mockWishlist = {
    id: 'wish-1',
    userId: 'user-1',
    shareToken: null,
    items: [
      {
        id: 'wi-1',
        wishlistId: 'wish-1',
        productId: 'prod-1',
        product: { ...mockProduct },
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      wishlist: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      wishlistItem: {
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(WishlistService);
  });

  // ─── getWishlist ──────────────────────────────────────────────────────────

  describe('getWishlist', () => {
    it('returns wishlist when one exists', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);

      const result = await service.getWishlist('user-1');

      expect(result).toBe(mockWishlist);
    });

    it('returns empty items shape when none exists', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(null);

      const result = await service.getWishlist('user-1');

      expect(result).toEqual({ items: [] });
    });
  });

  // ─── addItem ──────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('adds to existing wishlist with savedAtPrice + savedAtStock snapshot', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.wishlistItem.findUnique.mockResolvedValue(null);
      prisma.wishlistItem.create.mockResolvedValue({
        id: 'wi-2',
        wishlistId: 'wish-1',
        productId: 'prod-2',
        product: mockProduct,
      });

      const result = await service.addItem('user-1', 'prod-2');

      expect(prisma.wishlistItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            wishlistId: 'wish-1',
            productId: 'prod-2',
            savedAtPrice: mockProduct.price,
            savedAtStock: 15,
          }),
        }),
      );
      expect(result.product).toEqual(mockProduct);
    });

    it('creates a wishlist when none exists before adding', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(null);
      prisma.wishlist.create.mockResolvedValue({
        id: 'wish-new',
        userId: 'user-1',
      });
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.wishlistItem.findUnique.mockResolvedValue(null);
      prisma.wishlistItem.create.mockResolvedValue({
        id: 'wi-2',
        productId: 'prod-1',
        product: mockProduct,
      });

      await service.addItem('user-1', 'prod-1');

      expect(prisma.wishlist.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
    });

    it('throws NotFoundException when product is missing', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem('user-1', 'p-missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when product already in wishlist', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'wi-1' });

      await expect(service.addItem('user-1', 'prod-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when product is soft-deleted', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        deletedAt: new Date(),
      });

      await expect(service.addItem('user-1', 'prod-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when product is inactive', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await expect(service.addItem('user-1', 'prod-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── removeItem ───────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('throws NotFoundException when wishlist does not exist', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(null);

      await expect(service.removeItem('user-1', 'prod-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the item when wishlist exists', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);
      prisma.wishlistItem.delete.mockResolvedValue({ id: 'wi-1' });

      await service.removeItem('user-1', 'prod-1');

      expect(prisma.wishlistItem.delete).toHaveBeenCalled();
    });
  });

  // ─── bulkAdd ──────────────────────────────────────────────────────────────

  describe('bulkAdd', () => {
    it('returns zero counts for empty input', async () => {
      const result = await service.bulkAdd('user-1', []);

      expect(result).toEqual({ added: 0, skipped: 0 });
    });

    it('snapshots savedAtPrice + savedAtStock for each product', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);
      prisma.product.findMany.mockResolvedValue([
        { id: 'p-1', price: 100, variants: [{ stock: 5 }, { stock: 7 }] },
        { id: 'p-2', price: 200, variants: [{ stock: 1 }] },
      ]);
      prisma.wishlistItem.createMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkAdd('user-1', ['p-1', 'p-2']);

      expect(result.added).toBe(2);
      const args = prisma.wishlistItem.createMany.mock.calls[0][0] as {
        data: Array<{ savedAtStock: number }>;
      };
      expect(args.data[0].savedAtStock).toBe(12);
      expect(args.data[1].savedAtStock).toBe(1);
    });
  });

  // ─── share token ──────────────────────────────────────────────────────────

  describe('getOrCreateShareToken', () => {
    it('returns existing token when set', async () => {
      prisma.wishlist.findUnique.mockResolvedValue({
        ...mockWishlist,
        shareToken: 'existing-token',
      });

      const result = await service.getOrCreateShareToken('user-1');

      expect(result.shareToken).toBe('existing-token');
      expect(prisma.wishlist.update).not.toHaveBeenCalled();
    });

    it('mints a fresh hex token when none set', async () => {
      prisma.wishlist.findUnique.mockResolvedValue({
        ...mockWishlist,
        shareToken: null,
      });
      prisma.wishlist.update.mockImplementation(
        async ({ data }: { data: { shareToken: string } }) => ({
          ...mockWishlist,
          shareToken: data.shareToken,
        }),
      );

      const result = await service.getOrCreateShareToken('user-1');

      expect(result.shareToken).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('revokeShareToken', () => {
    it('throws NotFoundException when wishlist is missing', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(null);

      await expect(service.revokeShareToken('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('nulls the token when wishlist exists', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(mockWishlist);
      prisma.wishlist.update.mockResolvedValue(mockWishlist);

      await service.revokeShareToken('user-1');

      expect(prisma.wishlist.update).toHaveBeenCalledWith({
        where: { id: 'wish-1' },
        data: { shareToken: null },
      });
    });
  });

  // ─── public by token ──────────────────────────────────────────────────────

  describe('getPublicByToken', () => {
    it('throws NotFoundException when token does not match', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(null);

      await expect(service.getPublicByToken('bad-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not leak owner PII in the public payload', async () => {
      prisma.wishlist.findUnique.mockResolvedValue({
        id: 'wish-1',
        userId: 'user-1',
        items: [
          {
            id: 'wi-1',
            productId: 'p-1',
            product: {
              id: 'p-1',
              name: 'X',
              slug: 'x',
              price: 10,
              images: [],
              variants: [],
            },
          },
        ],
      });

      const result = await service.getPublicByToken('valid-token');

      // Allowlist check: anything beyond these keys is a potential PII leak.
      expect(Object.keys(result).sort()).toEqual(['items', 'ownerFirstName']);
      expect(result.ownerFirstName).toBeNull();
      expect(result.items).toHaveLength(1);
      // Each item must not leak the owner's userId or any timestamps.
      expect(Object.keys(result.items[0]).sort()).toEqual([
        'id',
        'product',
        'productId',
      ]);
    });
  });
});
