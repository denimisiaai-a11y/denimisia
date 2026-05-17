import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.decorator';

describe('CartService', () => {
  let service: CartService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let redis: { get: jest.Mock; del: jest.Mock; setex: jest.Mock };

  const mockVariant = {
    id: 'var-1',
    productId: 'prod-1',
    sku: 'SFD-32-BLU',
    size: '32',
    color: 'Blue',
    price: 2500,
    stock: 10,
    product: {
      id: 'prod-1',
      name: 'Slim Fit',
      slug: 'slim-fit',
      images: ['img.jpg'],
      price: 2500,
    },
  };

  const mockCart = {
    id: 'cart-1',
    userId: 'user-1',
    items: [
      {
        id: 'ci-1',
        cartId: 'cart-1',
        productId: 'prod-1',
        variantId: 'var-1',
        quantity: 2,
        variant: {
          price: 2500,
          product: {
            id: 'prod-1',
            name: 'Slim Fit',
            slug: 'slim-fit',
            images: ['img.jpg'],
            price: 2500,
          },
        },
      },
    ],
  };

  const mockCartItem = {
    id: 'ci-1',
    cartId: 'cart-1',
    productId: 'prod-1',
    variantId: 'var-1',
    quantity: 2,
  };

  beforeEach(async () => {
    prisma = {
      productVariant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      productBundle: {
        findUnique: jest.fn(),
      },
      cart: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      cartItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    redis = {
      get: jest.fn(),
      del: jest.fn(),
      setex: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(CartService);
  });

  // ─── getCart() ─────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('should return user cart with items and computed total', async () => {
      prisma.cart.findUnique.mockResolvedValue(mockCart);

      const result = await service.getCart('user-1');

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: expect.objectContaining({
          items: expect.any(Object),
        }),
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'cart-1',
          total: 5000, // 2500 * 2
        }),
      );
    });

    it('should return empty cart when user has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      const result = await service.getCart('user-1');

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should return guest cart from Redis when sessionId provided', async () => {
      const guestItems = [
        { variantId: 'var-1', quantity: 1, productId: 'prod-1' },
      ];
      redis.get.mockResolvedValue(JSON.stringify(guestItems));

      const result = await service.getCart(undefined, 'session-123');

      expect(redis.get).toHaveBeenCalledWith('cart:session-123');
      expect(result).toEqual({ items: guestItems, total: 0 });
    });

    it('should return empty guest cart when no data in Redis', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.getCart(undefined, 'session-123');

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should return empty cart when neither userId nor sessionId', async () => {
      const result = await service.getCart();

      expect(result).toEqual({ items: [], total: 0 });
    });
  });

  // ─── addItem() ─────────────────────────────────────────────────────────────

  describe('addItem', () => {
    const addDto = {
      productId: 'prod-1',
      variantId: 'var-1',
      quantity: 1,
    };

    it('should add new item to user cart', async () => {
      prisma.productVariant.findUnique
        .mockResolvedValueOnce(mockVariant) // stock check in addItem
        .mockResolvedValueOnce({ productId: 'prod-1' }); // productId lookup in addToUserCart
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.findFirst.mockResolvedValue(null);
      const created = { id: 'ci-new', ...addDto, cartId: 'cart-1' };
      prisma.cartItem.create.mockResolvedValue(created);

      const result = await service.addItem(addDto, 'user-1');

      expect(prisma.productVariant.findUnique).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        include: { product: true },
      });
      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cartId: 'cart-1',
          variantId: 'var-1',
          quantity: 1,
          productId: 'prod-1',
        }),
      });
      expect(result).toEqual(created);
    });

    it('should increment quantity when item already exists in cart', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(mockVariant);
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.findFirst.mockResolvedValue(mockCartItem);
      const updated = { ...mockCartItem, quantity: 3 };
      prisma.cartItem.update.mockResolvedValue(updated);

      const result = await service.addItem(addDto, 'user-1');

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'ci-1' },
        data: { quantity: 3 },
      });
      expect(result).toEqual(updated);
    });

    it('should create new cart when user has none', async () => {
      prisma.productVariant.findUnique
        .mockResolvedValueOnce(mockVariant)
        .mockResolvedValueOnce({ productId: 'prod-1' });
      prisma.cart.findUnique.mockResolvedValue(null);
      prisma.cart.create.mockResolvedValue({
        id: 'cart-new',
        userId: 'user-1',
      });
      prisma.cartItem.findFirst.mockResolvedValue(null);
      prisma.cartItem.create.mockResolvedValue({ id: 'ci-new' });

      await service.addItem(addDto, 'user-1');

      expect(prisma.cart.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
    });

    it('should throw NotFoundException when variant not found', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(null);

      await expect(service.addItem(addDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      const lowStock = { ...mockVariant, stock: 0 };
      prisma.productVariant.findUnique.mockResolvedValue(lowStock);

      await expect(service.addItem(addDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should add item to guest cart via Redis when sessionId provided', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(mockVariant);
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      const result = await service.addItem(addDto, undefined, 'session-123');

      expect(redis.setex).toHaveBeenCalledWith(
        'cart:session-123',
        7 * 24 * 60 * 60,
        expect.any(String),
      );
      expect(result).toEqual({ items: expect.any(Array) });
    });

    it('should increment guest cart item quantity when already exists', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(mockVariant);
      const existingItems = [
        { variantId: 'var-1', quantity: 2, productId: 'prod-1' },
      ];
      redis.get.mockResolvedValue(JSON.stringify(existingItems));
      redis.setex.mockResolvedValue('OK');

      await service.addItem(addDto, undefined, 'session-123');

      const savedJson = redis.setex.mock.calls[0][2];
      const savedItems = JSON.parse(savedJson);
      expect(savedItems[0].quantity).toBe(3);
    });

    it('should throw BadRequestException when no session or user', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(mockVariant);

      await expect(service.addItem(addDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── updateItem() ─────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('should update cart item quantity', async () => {
      prisma.cartItem.findFirst.mockResolvedValue(mockCartItem);
      const updated = { ...mockCartItem, quantity: 5 };
      prisma.cartItem.update.mockResolvedValue(updated);

      const result = await service.updateItem(
        'ci-1',
        { quantity: 5 },
        'user-1',
      );

      expect(prisma.cartItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'ci-1', cart: { userId: 'user-1' } },
      });
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'ci-1' },
        data: { quantity: 5 },
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when cart item not found', async () => {
      prisma.cartItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItem('non-existent', { quantity: 1 }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return undefined when no userId provided', async () => {
      const result = await service.updateItem('ci-1', { quantity: 1 });

      expect(prisma.cartItem.findFirst).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  // ─── removeItem() ─────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should remove item from user cart', async () => {
      prisma.cartItem.findFirst.mockResolvedValue(mockCartItem);
      prisma.cartItem.delete.mockResolvedValue(mockCartItem);

      await service.removeItem('ci-1', 'user-1');

      expect(prisma.cartItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'ci-1', cart: { userId: 'user-1' } },
      });
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'ci-1' },
      });
    });

    it('should throw NotFoundException when item not found', async () => {
      prisma.cartItem.findFirst.mockResolvedValue(null);

      await expect(
        service.removeItem('non-existent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should do nothing when no userId provided', async () => {
      await service.removeItem('ci-1');

      expect(prisma.cartItem.findFirst).not.toHaveBeenCalled();
      expect(prisma.cartItem.delete).not.toHaveBeenCalled();
    });
  });

  // ─── clearCart() ──────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('should clear user cart items', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });

      await service.clearCart('user-1');

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
    });

    it('should do nothing when user has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await service.clearCart('user-1');

      expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should clear guest cart from Redis', async () => {
      redis.del.mockResolvedValue(1);

      await service.clearCart(undefined, 'session-123');

      expect(redis.del).toHaveBeenCalledWith('cart:session-123');
    });
  });

  // ─── mergeGuestCart() ─────────────────────────────────────────────────────

  describe('mergeGuestCart', () => {
    it('should merge guest cart items into user cart', async () => {
      const guestItems = [
        { productId: 'prod-1', variantId: 'var-1', quantity: 2 },
      ];
      redis.get.mockResolvedValue(JSON.stringify(guestItems));
      redis.del.mockResolvedValue(1);

      // Pre-fetch all variants in one batched call (BUG #11 fix).
      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-1', stock: 5, productId: 'prod-1' },
      ]);

      // addToUserCart mock chain
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.findFirst.mockResolvedValue(null);
      prisma.productVariant.findUnique.mockResolvedValue({
        productId: 'prod-1',
      });
      prisma.cartItem.create.mockResolvedValue({ id: 'ci-new' });

      await service.mergeGuestCart('user-1', 'session-123');

      // The batched findMany replaces the per-item findUnique loop.
      expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['var-1'] } },
        select: { id: true, stock: true, productId: true },
      });
      expect(redis.get).toHaveBeenCalledWith('cart:session-123');
      expect(redis.del).toHaveBeenCalledWith('cart:session-123');
    });

    it('should do nothing when guest cart is empty', async () => {
      redis.get.mockResolvedValue(null);

      await service.mergeGuestCart('user-1', 'session-123');

      expect(prisma.cart.findUnique).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('re-validates bundle lines via addBundleItem during merge', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify([
          {
            bundleId: 'bun-1',
            bundleSlug: 'heritage-bundle',
            bundleSize: 'L',
            quantity: 1,
          },
        ]),
      );
      prisma.productBundle.findUnique.mockResolvedValue({
        id: 'bun-1',
        slug: 'heritage-bundle',
        name: 'Heritage Bundle',
        bundlePrice: 2500,
        availableSizes: ['L'],
        isActive: true,
        image: null,
        items: [{ productId: 'prod-1', color: 'Black' }],
      });
      prisma.productVariant.findMany.mockResolvedValue([
        { productId: 'prod-1', color: 'Black', stock: 5 },
      ]);
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.findFirst.mockResolvedValue(null);
      prisma.cartItem.create.mockResolvedValue({ id: 'ci-bundle' });
      redis.del.mockResolvedValue(1);

      await service.mergeGuestCart('user-1', 'session-123');

      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bundleId: 'bun-1',
          bundleSize: 'L',
          quantity: 1,
        }),
      });
      expect(redis.del).toHaveBeenCalledWith('cart:session-123');
    });
  });

  // ─── addBundleItem() ──────────────────────────────────────────────────────

  describe('addBundleItem', () => {
    const mockBundle = {
      id: 'bun-1',
      slug: 'heritage-bundle',
      name: 'Heritage Bundle',
      bundlePrice: 2500,
      availableSizes: ['S', 'M', 'L'],
      isActive: true,
      image: null,
      items: [
        { productId: 'prod-1', color: 'Black' },
        { productId: 'prod-2', color: 'Indigo' },
      ],
    };
    const dto = { bundleSlug: 'heritage-bundle', size: 'L', quantity: 1 };
    const fullStock = [
      { productId: 'prod-1', color: 'Black', stock: 5 },
      { productId: 'prod-2', color: 'Indigo', stock: 5 },
    ];

    it('creates a bundle line in the user cart on the happy path', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue(fullStock);
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.findFirst.mockResolvedValue(null);
      prisma.cartItem.create.mockResolvedValue({ id: 'ci-new' });

      await service.addBundleItem(dto, 'user-1');

      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: {
          cartId: 'cart-1',
          bundleId: 'bun-1',
          bundleSize: 'L',
          quantity: 1,
        },
      });
    });

    it('increments quantity when the same (bundleId, bundleSize) already exists', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue(fullStock);
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.findFirst.mockResolvedValue({
        id: 'ci-existing',
        quantity: 2,
      });
      prisma.cartItem.update.mockResolvedValue({
        id: 'ci-existing',
        quantity: 3,
      });

      await service.addBundleItem(dto, 'user-1');

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'ci-existing' },
        data: { quantity: 3 },
      });
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
    });

    it('throws NotFound when the bundle slug does not resolve', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(null);
      await expect(service.addBundleItem(dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequest when the bundle is inactive', async () => {
      prisma.productBundle.findUnique.mockResolvedValue({
        ...mockBundle,
        isActive: false,
      });
      await expect(service.addBundleItem(dto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequest when the size is not in availableSizes', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      await expect(
        service.addBundleItem({ ...dto, size: 'XXL' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws Conflict when a constituent variant is missing for the chosen size', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue([fullStock[0]]);
      await expect(service.addBundleItem(dto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws Conflict when a constituent variant has insufficient stock', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue([
        { productId: 'prod-1', color: 'Black', stock: 5 },
        { productId: 'prod-2', color: 'Indigo', stock: 0 },
      ]);
      await expect(service.addBundleItem(dto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('writes a bundle line to the guest Redis cart with full display fields', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue(fullStock);
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      await service.addBundleItem(dto, undefined, 'session-123');

      const saved = JSON.parse(redis.setex.mock.calls[0][2]);
      expect(saved[0]).toMatchObject({
        bundleId: 'bun-1',
        bundleSlug: 'heritage-bundle',
        bundleName: 'Heritage Bundle',
        bundleSize: 'L',
        bundlePrice: 2500,
        quantity: 1,
      });
    });

    it('throws BadRequest when neither session nor user is provided', async () => {
      prisma.productBundle.findUnique.mockResolvedValue(mockBundle);
      prisma.productVariant.findMany.mockResolvedValue(fullStock);
      await expect(service.addBundleItem(dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── getUserCart with mixed lines ─────────────────────────────────────────

  describe('getCart with bundle lines', () => {
    it('computes total across variant and bundle lines', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
        items: [
          {
            id: 'ci-var',
            cartId: 'cart-1',
            productId: 'prod-1',
            variantId: 'var-1',
            bundleId: null,
            bundleSize: null,
            quantity: 2,
            variant: {
              price: 2500,
              product: {
                id: 'prod-1',
                name: 'Slim Fit',
                slug: 'slim-fit',
                images: ['img.jpg'],
                price: 2500,
              },
            },
            bundle: null,
          },
          {
            id: 'ci-bun',
            cartId: 'cart-1',
            productId: null,
            variantId: null,
            bundleId: 'bun-1',
            bundleSize: 'L',
            quantity: 1,
            variant: null,
            bundle: { bundlePrice: 2500, items: [] },
          },
        ],
      });

      const result = await service.getCart('user-1');

      // variant: 2500 * 2 = 5000. bundle: 2500 * 1 = 2500. total = 7500.
      expect(result).toEqual(expect.objectContaining({ total: 7500 }));
    });
  });
});
