import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { OrderNumberService } from './order-number.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrdersService', () => {
  let service: OrdersService;
  // $transaction is a root-level jest.Mock, not a Record of mocks, so mix the
  // two shapes with a loose index signature.
  let prisma: Record<string, any>;
  let eventEmitter: { emit: jest.Mock };
  let orderNumbers: { generate: jest.Mock };

  const mockVariant = {
    id: 'var-1',
    price: 2500,
    stock: 10,
    size: '32',
    color: 'Blue',
    productId: 'prod-1',
    product: {
      id: 'prod-1',
      name: 'Slim Fit Denim',
      images: ['img1.jpg'],
      slug: 'slim-fit-denim',
    },
  };

  const mockOrder = {
    id: 'order-1',
    userId: 'user-1',
    status: 'PENDING',
    subtotal: 5000,
    discount: 0,
    shippingCost: 80,
    total: 5080,
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        variantId: 'var-1',
        quantity: 2,
        unitPrice: 2500,
        total: 5000,
      },
    ],
    createdAt: new Date('2025-01-01'),
  };

  // Mock $transaction to execute the callback with a mock tx object
  const createMockTx = () => ({
    order: { create: jest.fn() },
    productVariant: { update: jest.fn() },
    inventoryLog: { create: jest.fn() },
    discount: { update: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  });

  beforeEach(async () => {
    prisma = {
      productVariant: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      discount: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      productBundle: {
        findMany: jest.fn(),
      },
      cart: {
        findUnique: jest.fn(),
      },
      cartItem: {
        deleteMany: jest.fn(),
      },
      inventoryLog: {
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      category: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      product: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    orderNumbers = {
      generate: jest.fn().mockResolvedValue('DEN-000123'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: OrderNumberService, useValue: orderNumbers },
      ],
    }).compile();

    service = module.get(OrdersService);

    // Default return values for mocks used by bulkImportHistory.
    // Individual tests override these as needed.
    prisma.productVariant.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({ id: 'cat-default', slug: 'legacy-imports' });
    prisma.product.create.mockResolvedValue({ id: 'prod-default' });
    prisma.productVariant.create.mockResolvedValue({ id: 'var-default', sku: 'DEFAULT' });
    prisma.order.create.mockResolvedValue({ id: 'ord-default' });
    prisma.user.upsert.mockResolvedValue({ id: 'user-default' });
  });

  // ─── createOrder() ────────────────────────────────────────────────────────

  describe('createOrder', () => {
    const createOrderDto = {
      items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 2 }],
      shippingAddress: { city: 'Dhaka', street: '123 Main St' },
    };

    it('should create order with items and update stock', async () => {
      prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

      const mockTx = createMockTx();
      mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
      const createdOrder = { ...mockOrder };
      mockTx.order.create.mockResolvedValue(createdOrder);
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});

      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.createOrder('user-1', createOrderDto as any);

      expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['var-1'] } },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              slug: true,
              price: true,
            },
          },
        },
      });
      expect(mockTx.order.create).toHaveBeenCalled();
      expect(mockTx.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { stock: { decrement: 2 } },
      });
      expect(mockTx.inventoryLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variantId: 'var-1',
          type: 'SALE',
          quantity: -2,
        }),
      });
      expect(result).toEqual(createdOrder);
    });

    it('should throw NotFoundException when variant not found', async () => {
      prisma.productVariant.findMany.mockResolvedValue([]);

      await expect(
        service.createOrder('user-1', createOrderDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when product ID mismatches variant', async () => {
      const mismatchedVariant = {
        ...mockVariant,
        product: { ...mockVariant.product, id: 'different-prod' },
      };
      prisma.productVariant.findMany.mockResolvedValue([mismatchedVariant]);

      await expect(
        service.createOrder('user-1', createOrderDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      const lowStockVariant = { ...mockVariant, stock: 1 };
      prisma.productVariant.findMany.mockResolvedValue([lowStockVariant]);

      await expect(
        service.createOrder('user-1', createOrderDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    // ─── Inventory race protection (LR-001 amendment C4) ─────────────────
    //
    // The pre-check on prisma.productVariant.findMany only proves "stock
    // was N when the order request landed." Between that read and the
    // decrement, another customer could have consumed the same unit. The
    // service guards this with SELECT ... FOR UPDATE inside the
    // transaction (orders.service.ts ~line 138) which row-locks the
    // variant until the decrement commits. These tests lock in the
    // structural contract; a true two-process race test belongs in the
    // integration suite where two real Postgres clients can compete.
    describe('inventory race protection', () => {
      it('issues SELECT FOR UPDATE on each variant before decrementing', async () => {
        prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

        const mockTx = createMockTx();
        mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
        mockTx.order.create.mockResolvedValue(mockOrder);
        mockTx.productVariant.update.mockResolvedValue({});
        mockTx.inventoryLog.create.mockResolvedValue({});
        (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
          cb(mockTx),
        );
        prisma.cart.findUnique.mockResolvedValue(null);

        await service.createOrder('user-1', createOrderDto as any);

        // One call per item, each parameterized with the variantId, each
        // using the FOR UPDATE clause. Without FOR UPDATE the lock would
        // not be held and two concurrent transactions could both read
        // stock=1 and both decrement to -1.
        expect(mockTx.$queryRawUnsafe).toHaveBeenCalledTimes(1);
        expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
          expect.stringMatching(/FOR UPDATE/i),
          'var-1',
        );
      });

      it('throws BadRequestException when locked stock is insufficient (race lost)', async () => {
        // Simulates the race: pre-check sees stock=10 (variant findMany),
        // but by the time we acquire the row lock another transaction has
        // committed and stock is now 1 — less than the 2 we want.
        prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

        const mockTx = createMockTx();
        mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 1 }]);
        (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
          cb(mockTx),
        );
        prisma.cart.findUnique.mockResolvedValue(null);

        await expect(
          service.createOrder('user-1', createOrderDto as any),
        ).rejects.toThrow(BadRequestException);

        // Critical: the order MUST NOT have been created and the variant
        // MUST NOT have been decremented (transaction rolls back when the
        // service throws inside the callback).
        expect(mockTx.order.create).not.toHaveBeenCalled();
        expect(mockTx.productVariant.update).not.toHaveBeenCalled();
      });

      it('throws BadRequestException when the locked-stock query returns no row', async () => {
        // Defensive: between pre-check and lock, the variant could be
        // soft-deleted by an admin. The lock returns [] (no row). The
        // service must treat that as out-of-stock, not as success.
        prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

        const mockTx = createMockTx();
        mockTx.$queryRawUnsafe.mockResolvedValue([]);
        (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
          cb(mockTx),
        );
        prisma.cart.findUnique.mockResolvedValue(null);

        await expect(
          service.createOrder('user-1', createOrderDto as any),
        ).rejects.toThrow(BadRequestException);

        expect(mockTx.order.create).not.toHaveBeenCalled();
      });
    });

    it('should clear user cart after successful order', async () => {
      prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

      const mockTx = createMockTx();
      mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});

      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId: 'user-1',
      });
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.createOrder('user-1', createOrderDto as any);

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
    });

    it('should emit order.created event', async () => {
      prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

      const mockTx = createMockTx();
      mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});

      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      prisma.cart.findUnique.mockResolvedValue(null);

      await service.createOrder('user-1', createOrderDto as any);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          orderId: 'order-1',
          userId: 'user-1',
        }),
      );
    });

    it('should calculate shipping cost as 80 for Dhaka', async () => {
      prisma.productVariant.findMany.mockResolvedValue([
        { ...mockVariant, price: 500 },
      ]);

      const mockTx = createMockTx();
      mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});

      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      prisma.cart.findUnique.mockResolvedValue(null);

      await service.createOrder('user-1', {
        items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 1 }],
        shippingAddress: { city: 'Dhaka' },
      } as any);

      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingCost: 80,
          }),
        }),
      );
    });

    it('should calculate shipping cost as 120 outside Dhaka', async () => {
      prisma.productVariant.findMany.mockResolvedValue([
        { ...mockVariant, price: 500 },
      ]);

      const mockTx = createMockTx();
      mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});

      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      prisma.cart.findUnique.mockResolvedValue(null);

      await service.createOrder('user-1', {
        items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 1 }],
        shippingAddress: { city: 'Chittagong' },
      } as any);

      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingCost: 120,
          }),
        }),
      );
    });

    it('should give free shipping for orders over 1500', async () => {
      prisma.productVariant.findMany.mockResolvedValue([
        { ...mockVariant, price: 2000 },
      ]);

      const mockTx = createMockTx();
      mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});

      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      prisma.cart.findUnique.mockResolvedValue(null);

      await service.createOrder('user-1', {
        items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 1 }],
        shippingAddress: { city: 'Dhaka' },
      } as any);

      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingCost: 0,
          }),
        }),
      );
    });

    // ─── Guest checkout (LR-001 Phase 1 slice B) ───────────────────────────
    //
    // Locks the three guarantees of the guest flow:
    //   1. createOrder(null, dto) without the full guest tuple throws 400
    //      (the service guard, before the DB CHECK can throw an opaque error)
    //   2. createOrder(null, dto) WITH the full guest tuple succeeds and the
    //      Order row is written with userId=null + guest fields populated
    //   3. createOrder(userId, dto) ignores any guest fields a logged-in
    //      caller sends — userId always wins, guest fields stay null
    //
    // The auth/permission boundary is enforced at the controller level (POST
    // /orders is the only endpoint that does NOT require JWT); these tests
    // assert the service contract regardless of how the controller gates it.
    describe('guest checkout', () => {
      const guestDto = {
        items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 1 }],
        shippingAddress: { city: 'Dhaka' },
        guestEmail: 'guest@example.com',
        guestName: 'Guest Buyer',
        guestPhone: '+8801700000000',
      };

      it('rejects anonymous order missing guestEmail', async () => {
        await expect(
          service.createOrder(null, {
            ...guestDto,
            guestEmail: undefined,
          } as any),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects anonymous order missing guestName', async () => {
        await expect(
          service.createOrder(null, {
            ...guestDto,
            guestName: undefined,
          } as any),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects anonymous order missing guestPhone', async () => {
        await expect(
          service.createOrder(null, {
            ...guestDto,
            guestPhone: undefined,
          } as any),
        ).rejects.toThrow(BadRequestException);
      });

      it('creates a guest order attached to a shadow user when no match exists', async () => {
        prisma.productVariant.findMany.mockResolvedValue([mockVariant]);
        // No existing user found — service will upsert a new shadow
        prisma.user.findFirst.mockResolvedValue(null);
        prisma.user.upsert.mockResolvedValue({ id: 'shadow-new-1' });

        const mockTx = createMockTx();
        mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
        mockTx.order.create.mockResolvedValue({
          ...mockOrder,
          userId: 'shadow-new-1',
          guestEmail: 'guest@example.com',
        });
        mockTx.productVariant.update.mockResolvedValue({});
        mockTx.inventoryLog.create.mockResolvedValue({});

        (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
          cb(mockTx),
        );

        await service.createOrder(null, guestDto as any);

        expect(mockTx.order.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'shadow-new-1',
              guestEmail: 'guest@example.com',
              guestName: 'Guest Buyer',
              guestPhone: '+8801700000000',
            }),
          }),
        );
        // Guests (even shadow-matched) have no Cart row — service must not try
        // to clear a cart that does not exist.
        expect(prisma.cart.findUnique).not.toHaveBeenCalled();
      });

      it('emits order.created with effectiveUserId for guest order (shadow upserted)', async () => {
        prisma.productVariant.findMany.mockResolvedValue([mockVariant]);
        prisma.user.findFirst.mockResolvedValue(null);
        prisma.user.upsert.mockResolvedValue({ id: 'shadow-new-1' });

        const mockTx = createMockTx();
        mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
        mockTx.order.create.mockResolvedValue({
          ...mockOrder,
          id: 'order-guest-1',
          userId: 'shadow-new-1',
        });
        mockTx.productVariant.update.mockResolvedValue({});
        mockTx.inventoryLog.create.mockResolvedValue({});

        (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
          cb(mockTx),
        );

        await service.createOrder(null, guestDto as any);

        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'order.created',
          expect.objectContaining({
            orderId: 'order-guest-1',
            userId: 'shadow-new-1',
          }),
        );
      });

      it('uses the authenticated userId and snapshots guest dto fields for receipts', async () => {
        // Logged-in customer who sends guestEmail in the body (e.g. a mobile
        // client that always sends the full dto). The service uses the
        // authenticated userId for the order owner, and snapshots the guest
        // contact fields as-provided for receipt purposes.
        prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

        const mockTx = createMockTx();
        mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
        mockTx.order.create.mockResolvedValue(mockOrder);
        mockTx.productVariant.update.mockResolvedValue({});
        mockTx.inventoryLog.create.mockResolvedValue({});

        (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
          cb(mockTx),
        );
        prisma.cart.findUnique.mockResolvedValue(null);

        await service.createOrder('user-1', guestDto as any);

        expect(mockTx.order.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'user-1',
            }),
          }),
        );
      });
    });
  });

  // ─── createOrder — bundle lines (LR-001 Phase 1 Slice 4) ──────────────────

  describe('createOrder — bundle lines', () => {
    const mockBundle = {
      id: 'bun-1',
      slug: 'heritage-bundle',
      name: 'Heritage Bundle',
      bundlePrice: 2500,
      availableSizes: ['S', 'M', 'L'],
      isActive: true,
      image: 'hero.jpg',
      items: [
        { productId: 'prod-1', color: 'Black' },
        { productId: 'prod-2', color: 'Indigo' },
      ],
    };
    const constituentVariants = [
      {
        id: 'var-1-bl-l',
        productId: 'prod-1',
        color: 'Black',
        size: 'L',
        stock: 5,
        product: {
          id: 'prod-1',
          name: 'Slim Tee',
          images: ['t1.jpg'],
          slug: 'slim-tee',
        },
      },
      {
        id: 'var-2-in-l',
        productId: 'prod-2',
        color: 'Indigo',
        size: 'L',
        stock: 5,
        product: {
          id: 'prod-2',
          name: 'Indigo Jean',
          images: ['j1.jpg'],
          slug: 'indigo-jean',
        },
      },
    ];
    const baseDto = {
      items: [{ bundleId: 'bun-1', bundleSize: 'L', quantity: 1 }],
      shippingAddress: { city: 'Dhaka', street: '123 Main' },
    };

    function setupHappyPath(): ReturnType<typeof createMockTx> {
      prisma.productBundle.findMany.mockResolvedValue([mockBundle]);
      prisma.productVariant.findMany.mockResolvedValue(constituentVariants);
      const mockTx = createMockTx();
      mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 5 }]);
      mockTx.order.create.mockResolvedValue({
        id: 'order-bun-1',
        items: [],
      });
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});
      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );
      prisma.cart.findUnique.mockResolvedValue(null);
      return mockTx;
    }

    it('creates an order with a bundle line and the snapshot captures constituents', async () => {
      const mockTx = setupHappyPath();

      await service.createOrder('user-1', baseDto as any);

      const createCall = mockTx.order.create.mock.calls[0][0];
      expect(createCall.data.items.create).toHaveLength(1);
      const orderItem = createCall.data.items.create[0];
      expect(orderItem.bundleId).toBe('bun-1');
      expect(orderItem.bundleSize).toBe('L');
      expect(orderItem.unitPrice).toBe(2500);
      expect(orderItem.total).toBe(2500);
      expect(orderItem.snapshot).toEqual(
        expect.objectContaining({
          bundleSlug: 'heritage-bundle',
          bundleName: 'Heritage Bundle',
          bundleSize: 'L',
          bundlePrice: 2500,
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: 'prod-1',
              variantId: 'var-1-bl-l',
              color: 'Black',
              size: 'L',
            }),
            expect.objectContaining({
              productId: 'prod-2',
              variantId: 'var-2-in-l',
              color: 'Indigo',
              size: 'L',
            }),
          ]),
        }),
      );
    });

    it('locks every constituent variant before decrementing', async () => {
      const mockTx = setupHappyPath();

      await service.createOrder('user-1', baseDto as any);

      // Two constituent variants, locked in deterministic (sorted) order.
      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringMatching(/FOR UPDATE/i),
        'var-1-bl-l',
      );
      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringMatching(/FOR UPDATE/i),
        'var-2-in-l',
      );
    });

    it('decrements stock for each constituent variant by the bundle line quantity', async () => {
      const mockTx = setupHappyPath();
      const dto = {
        ...baseDto,
        items: [{ bundleId: 'bun-1', bundleSize: 'L', quantity: 2 }],
      };

      await service.createOrder('user-1', dto as any);

      expect(mockTx.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1-bl-l' },
        data: { stock: { decrement: 2 } },
      });
      expect(mockTx.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-2-in-l' },
        data: { stock: { decrement: 2 } },
      });
    });

    it('rejects when the bundle is not active', async () => {
      prisma.productBundle.findMany.mockResolvedValue([]);

      await expect(
        service.createOrder('user-1', baseDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the bundleSize is not in availableSizes', async () => {
      prisma.productBundle.findMany.mockResolvedValue([mockBundle]);

      await expect(
        service.createOrder('user-1', {
          ...baseDto,
          items: [{ bundleId: 'bun-1', bundleSize: 'XXL', quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when a constituent variant does not exist', async () => {
      prisma.productBundle.findMany.mockResolvedValue([mockBundle]);
      prisma.productVariant.findMany.mockResolvedValue([
        constituentVariants[0],
      ]);

      await expect(
        service.createOrder('user-1', baseDto as any),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when a constituent variant has insufficient stock', async () => {
      prisma.productBundle.findMany.mockResolvedValue([mockBundle]);
      prisma.productVariant.findMany.mockResolvedValue([
        constituentVariants[0],
        { ...constituentVariants[1], stock: 0 },
      ]);

      await expect(
        service.createOrder('user-1', baseDto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an item that has both variantId and bundleId', async () => {
      await expect(
        service.createOrder('user-1', {
          ...baseDto,
          items: [
            {
              productId: 'prod-1',
              variantId: 'var-1',
              bundleId: 'bun-1',
              bundleSize: 'L',
              quantity: 1,
            },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an item that has neither variantId nor bundleId', async () => {
      await expect(
        service.createOrder('user-1', {
          ...baseDto,
          items: [{ quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('aggregates stock when the same variant is referenced from a variant line AND a bundle line', async () => {
      // Variant line wants 3 of var-1-bl-l directly, bundle line wants 1
      // of var-1-bl-l via Heritage Bundle. Total required = 4. The lock
      // must check 4 against the row's stock, not 3 or 1 separately.
      prisma.productVariant.findMany
        .mockResolvedValueOnce([
          // First call (resolveVariantLines)
          {
            ...constituentVariants[0],
            price: 2500,
          },
        ])
        .mockResolvedValueOnce(constituentVariants); // Second call (resolveBundleLines)
      prisma.productBundle.findMany.mockResolvedValue([mockBundle]);

      const mockTx = createMockTx();
      // Mock the FOR UPDATE: var-1-bl-l aggregates to 4, var-2-in-l = 1
      // Sorted lock order = ['var-1-bl-l', 'var-2-in-l']
      mockTx.$queryRawUnsafe
        .mockResolvedValueOnce([{ stock: 10 }])
        .mockResolvedValueOnce([{ stock: 10 }]);
      mockTx.order.create.mockResolvedValue({ id: 'order-mix', items: [] });
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});
      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );
      prisma.cart.findUnique.mockResolvedValue(null);

      const dto = {
        items: [
          { productId: 'prod-1', variantId: 'var-1-bl-l', quantity: 3 },
          { bundleId: 'bun-1', bundleSize: 'L', quantity: 1 },
        ],
        shippingAddress: { city: 'Dhaka' },
      };

      await service.createOrder('user-1', dto as any);

      // The variant-line decrement is 3; the bundle constituent decrement
      // for var-1-bl-l is 1. Both calls happen.
      const updateCalls = mockTx.productVariant.update.mock.calls;
      const var1Updates = updateCalls.filter(
        (c: any) => c[0].where.id === 'var-1-bl-l',
      );
      expect(var1Updates).toHaveLength(2);
      const totalDecrement = var1Updates.reduce(
        (sum: number, c: any) => sum + c[0].data.stock.decrement,
        0,
      );
      expect(totalDecrement).toBe(4);
    });

    it('throws when aggregated stock across variant + bundle lines exceeds available', async () => {
      // Variant line wants 4, bundle line wants 1, locked stock = 3. The
      // aggregation must reject the order without decrementing anything.
      prisma.productVariant.findMany
        .mockResolvedValueOnce([{ ...constituentVariants[0], price: 2500 }])
        .mockResolvedValueOnce(constituentVariants);
      prisma.productBundle.findMany.mockResolvedValue([mockBundle]);

      const mockTx = createMockTx();
      // var-1-bl-l comes first in sort. Required = 4 + 1 = 5. Stock = 3.
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ stock: 3 }]);
      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('user-1', {
          items: [
            { productId: 'prod-1', variantId: 'var-1-bl-l', quantity: 4 },
            { bundleId: 'bun-1', bundleSize: 'L', quantity: 1 },
          ],
          shippingAddress: { city: 'Dhaka' },
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.order.create).not.toHaveBeenCalled();
      expect(mockTx.productVariant.update).not.toHaveBeenCalled();
    });
  });

  // ─── getMyOrders() ────────────────────────────────────────────────────────

  describe('getMyOrders', () => {
    it('should return paginated orders for user', async () => {
      prisma.order.findMany.mockResolvedValue([mockOrder]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.getMyOrders('user-1');

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 10,
        }),
      );
      expect(result).toEqual({
        orders: [mockOrder],
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should apply custom page and limit', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.getMyOrders('user-1', 3, 5);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });
  });

  // ─── getOrderById() ──────────────────────────────────────────────────────

  describe('getOrderById', () => {
    it('should return order when user is the owner', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderById('user-1', 'order-1');

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderById('user-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.getOrderById('user-2', 'order-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to view any order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderById('user-2', 'order-1', true);

      expect(result).toEqual(mockOrder);
    });
  });

  // ─── lookupForGuest() ─────────────────────────────────────────────────────

  describe('lookupForGuest', () => {
    const lookupOrder = {
      id: 'order-1',
      orderNumber: 'DEN-000123',
      status: 'CONFIRMED',
      subtotal: 1500,
      discount: 0,
      shippingCost: 80,
      total: 1580,
      shippingAddress: { city: 'Dhaka' },
      createdAt: new Date('2026-05-18T00:00:00Z'),
      guestEmail: null,
      items: [],
      user: { email: 'Owner@Example.com', firstName: 'Owner' },
    };

    it('returns the order when (id, email) matches the registered user email case-insensitively', async () => {
      prisma.order.findFirst.mockResolvedValue(lookupOrder);

      const result = await service.lookupForGuest(
        'order-1',
        'OWNER@example.com',
      );

      expect(result.id).toBe('order-1');
      expect(result.status).toBe('CONFIRMED');
      expect(result.orderNumber).toBe('DEN-000123');
    });

    it('returns the order when (id, email) matches the guestEmail tuple', async () => {
      prisma.order.findFirst.mockResolvedValue({
        ...lookupOrder,
        user: null,
        guestEmail: 'GUEST@example.com',
      });

      const result = await service.lookupForGuest(
        'order-1',
        'guest@example.com',
      );

      expect(result.id).toBe('order-1');
    });

    it('throws NotFoundException when the order does not exist', async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.lookupForGuest('missing', 'someone@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException with the same message when the email does not match the order — no enumeration leak', async () => {
      prisma.order.findFirst.mockResolvedValue(lookupOrder);

      await expect(
        service.lookupForGuest('order-1', 'someone-else@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('accepts orderNumber in addition to raw CUID', async () => {
      prisma.order.findFirst.mockResolvedValue(lookupOrder);

      await service.lookupForGuest('DEN-000123', 'OWNER@example.com');

      // The OR branch must include both id AND orderNumber — caller may
      // pass either.
      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: 'DEN-000123' }, { orderNumber: 'DEN-000123' }],
          },
        }),
      );
    });
  });

  // ─── cancelOrder() ────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('should cancel PENDING order and restore stock', async () => {
      const pendingOrder = { ...mockOrder, status: 'PENDING' };
      prisma.order.findUnique.mockResolvedValue(pendingOrder);

      const mockTx = {
        order: { update: jest.fn() },
        productVariant: { update: jest.fn() },
        inventoryLog: { create: jest.fn() },
      };

      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      const result = await service.cancelOrder('user-1', 'order-1');

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'CANCELLED' },
      });
      expect(mockTx.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1' },
        data: { stock: { increment: 2 } },
      });
      expect(mockTx.inventoryLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variantId: 'var-1',
          type: 'RETURN',
          quantity: 2,
          note: 'Order order-1 → CANCELLED',
        }),
      });
      expect(result).toEqual({ message: 'Order cancelled successfully' });
    });

    it('should emit order.cancelled event', async () => {
      const pendingOrder = { ...mockOrder, status: 'PENDING' };
      prisma.order.findUnique.mockResolvedValue(pendingOrder);

      const mockTx = {
        order: { update: jest.fn() },
        productVariant: { update: jest.fn() },
        inventoryLog: { create: jest.fn() },
      };
      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      await service.cancelOrder('user-1', 'order-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.cancelled',
        expect.objectContaining({
          orderId: 'order-1',
          userId: 'user-1',
          items: [{ variantId: 'var-1', quantity: 2 }],
        }),
      );
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelOrder('user-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.cancelOrder('user-2', 'order-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when order is not PENDING', async () => {
      const shippedOrder = { ...mockOrder, status: 'SHIPPED' };
      prisma.order.findUnique.mockResolvedValue(shippedOrder);

      await expect(service.cancelOrder('user-1', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('restores stock for every constituent of a bundle line using snapshot', async () => {
      // A PENDING order with one bundle line. The snapshot captures the
      // per-constituent variantId, so restore walks the snapshot — no need
      // to re-read the bundle (which may have been edited or deactivated).
      const bundleOrder = {
        ...mockOrder,
        status: 'PENDING',
        items: [
          {
            id: 'oi-bun',
            orderId: 'order-1',
            productId: null,
            variantId: null,
            bundleId: 'bun-1',
            bundleSize: 'L',
            quantity: 2,
            snapshot: {
              bundleSlug: 'heritage-bundle',
              bundleName: 'Heritage Bundle',
              bundleSize: 'L',
              bundlePrice: 2500,
              items: [
                {
                  productId: 'prod-1',
                  variantId: 'var-1-bl-l',
                  productName: 'Slim Tee',
                  color: 'Black',
                  size: 'L',
                  image: null,
                },
                {
                  productId: 'prod-2',
                  variantId: 'var-2-in-l',
                  productName: 'Indigo Jean',
                  color: 'Indigo',
                  size: 'L',
                  image: null,
                },
              ],
            },
          },
        ],
      };
      prisma.order.findUnique.mockResolvedValue(bundleOrder);

      const mockTx = {
        order: { update: jest.fn() },
        productVariant: { update: jest.fn() },
        inventoryLog: { create: jest.fn() },
      };
      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );

      await service.cancelOrder('user-1', 'order-1');

      // Each constituent variant restores stock = bundle line quantity (2).
      expect(mockTx.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-1-bl-l' },
        data: { stock: { increment: 2 } },
      });
      expect(mockTx.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var-2-in-l' },
        data: { stock: { increment: 2 } },
      });
      expect(mockTx.inventoryLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variantId: 'var-1-bl-l',
          type: 'RETURN',
          quantity: 2,
          note: expect.stringContaining('bundle: heritage-bundle'),
        }),
      });
    });
  });

  // ─── getAllOrders() (Admin) ───────────────────────────────────────────────

  describe('getAllOrders', () => {
    it('should return all orders paginated', async () => {
      prisma.order.findMany.mockResolvedValue([mockOrder]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.getAllOrders();

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual({
        orders: [mockOrder],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('should filter by status when provided', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.getAllOrders(1, 20, 'PENDING' as any);

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING' },
        }),
      );
    });
  });

  // ─── updateOrderStatus() ─────────────────────────────────────────────────

  describe('updateOrderStatus', () => {
    // Helper: mock $transaction to execute the callback with a tx object whose
    // orderStatusHistory/productVariant/inventoryLog/order methods are jest mocks.
    const mockStatusTx = (orderUpdateResult: unknown) => {
      const tx = {
        orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        productVariant: { update: jest.fn().mockResolvedValue({}) },
        inventoryLog: { create: jest.fn().mockResolvedValue({}) },
        order: { update: jest.fn().mockResolvedValue(orderUpdateResult) },
      };
      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(tx),
      );
      return tx;
    };

    it('should transition status correctly and record history with actorId', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });
      const updatedOrder = { ...mockOrder, status: 'CONFIRMED' };
      const tx = mockStatusTx(updatedOrder);

      // actorId is the 3rd argument — comes from the authenticated admin.
      const result = await service.updateOrderStatus(
        'order-1',
        { status: 'CONFIRMED' },
        'admin-1',
      );

      expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          changedBy: 'admin-1',
        }),
      });
      expect(tx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'CONFIRMED' },
      });
      expect(result).toEqual(updatedOrder);
    });

    it('should ignore client-supplied changedBy and use authenticated actorId only', async () => {
      // SECURITY: the `changedBy` column must reflect the authenticated admin,
      // never whatever the client put in the request body.
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });
      const tx = mockStatusTx({ ...mockOrder, status: 'CONFIRMED' });

      await service.updateOrderStatus(
        'order-1',
        { status: 'CONFIRMED', changedBy: 'attacker-id' } as any,
        'admin-1',
      );

      expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: 'admin-1' }),
      });
      expect(tx.orderStatusHistory.create).not.toHaveBeenCalledWith({
        data: expect.objectContaining({ changedBy: 'attacker-id' }),
      });
    });

    it('should emit order.status_changed event', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });
      mockStatusTx({ ...mockOrder, status: 'CONFIRMED' });

      await service.updateOrderStatus(
        'order-1',
        { status: 'CONFIRMED' },
        'admin-1',
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'order.status_changed',
        expect.objectContaining({
          orderId: 'order-1',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
        }),
      );
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus(
          'non-existent',
          { status: 'CONFIRMED' },
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });

      await expect(
        service.updateOrderStatus(
          'order-1',
          { status: 'DELIVERED' },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for terminal state (CANCELLED)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      await expect(
        service.updateOrderStatus('order-1', { status: 'PENDING' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include tracking number when provided', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PROCESSING',
      });
      const tx = mockStatusTx({
        ...mockOrder,
        status: 'SHIPPED',
        trackingNumber: 'TRK-123',
      });

      await service.updateOrderStatus(
        'order-1',
        { status: 'SHIPPED', trackingNumber: 'TRK-123' },
        'admin-1',
      );

      expect(tx.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          status: 'SHIPPED',
          trackingNumber: 'TRK-123',
        },
      });
    });

    it('should allow valid PENDING -> CONFIRMED transition', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'PENDING',
      });
      mockStatusTx({ ...mockOrder, status: 'CONFIRMED' });

      const result = await service.updateOrderStatus(
        'order-1',
        { status: 'CONFIRMED' },
        'admin-1',
      );

      expect(result.status).toBe('CONFIRMED');
    });

    it('should allow valid SHIPPED -> DELIVERED transition', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: 'SHIPPED',
      });
      mockStatusTx({ ...mockOrder, status: 'DELIVERED' });

      const result = await service.updateOrderStatus(
        'order-1',
        { status: 'DELIVERED' },
        'admin-1',
      );

      expect(result.status).toBe('DELIVERED');
    });

    // ─── Parameterized full transition matrix (LR-001 amendment C3) ─────────
    //
    // Locks every (from, to) pair against the VALID_TRANSITIONS table in
    // orders.service.ts. Adding a state, renaming a state, or changing
    // which transitions are legal MUST update this matrix in the same PR
    // so the contract stays auditable. Each invalid pair must throw
    // BadRequestException; each valid pair must resolve cleanly.
    //
    // Valid transitions per VALID_TRANSITIONS:
    //   PENDING        -> CONFIRMED, CANCELLED, PAYMENT_FAILED
    //   CONFIRMED      -> PROCESSING, CANCELLED
    //   PROCESSING     -> SHIPPED, CANCELLED
    //   SHIPPED        -> DELIVERED, RETURNED
    //   DELIVERED      -> RETURNED
    //   CANCELLED      -> {} terminal
    //   RETURNED       -> REFUNDED
    //   REFUNDED       -> {} terminal
    //   PAYMENT_FAILED -> PENDING, CANCELLED
    describe('full transition matrix', () => {
      const ALL_STATES = [
        'PENDING',
        'CONFIRMED',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED',
        'PAYMENT_FAILED',
        'RETURNED',
      ] as const;

      const VALID: Record<string, string[]> = {
        PENDING: ['CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED'],
        CONFIRMED: ['PROCESSING', 'CANCELLED'],
        PROCESSING: ['SHIPPED', 'CANCELLED'],
        SHIPPED: ['DELIVERED', 'RETURNED'],
        DELIVERED: ['RETURNED'],
        CANCELLED: [],
        RETURNED: ['REFUNDED'],
        REFUNDED: [],
        PAYMENT_FAILED: ['PENDING', 'CANCELLED'],
      };

      const validPairs: Array<[string, string]> = [];
      const invalidPairs: Array<[string, string]> = [];
      for (const from of ALL_STATES) {
        for (const to of ALL_STATES) {
          if (from === to) {
            invalidPairs.push([from, to]);
            continue;
          }
          (VALID[from].includes(to) ? validPairs : invalidPairs).push([
            from,
            to,
          ]);
        }
      }

      it.each(validPairs)('allows %s -> %s', async (from, to) => {
        prisma.order.findUnique.mockResolvedValue({
          ...mockOrder,
          status: from,
        });
        mockStatusTx({ ...mockOrder, status: to });

        const result = await service.updateOrderStatus(
          'order-1',
          { status: to },
          'admin-1',
        );

        expect(result.status).toBe(to);
      });

      it.each(invalidPairs)(
        'rejects %s -> %s with BadRequest',
        async (from, to) => {
          prisma.order.findUnique.mockResolvedValue({
            ...mockOrder,
            status: from,
          });

          await expect(
            service.updateOrderStatus('order-1', { status: to }, 'admin-1'),
          ).rejects.toThrow(BadRequestException);
        },
      );
    });
  });

  // ─── getStatusHistory() ──────────────────────────────────────────────────

  describe('getStatusHistory', () => {
    const customer = { id: 'user-1', role: 'CUSTOMER' };
    const admin = { id: 'admin-1', role: 'ADMIN' };

    it('should return status history for the owning customer', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      const history = [
        {
          id: 'h-1',
          orderId: 'order-1',
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          createdAt: new Date(),
        },
      ];
      prisma.orderStatusHistory.findMany.mockResolvedValue(history);

      const result = await service.getStatusHistory('order-1', customer);

      expect(prisma.orderStatusHistory.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(history);
    });

    it('should allow admins to read any order history', async () => {
      // Order belongs to user-1; requester is admin-1 with role ADMIN.
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.orderStatusHistory.findMany.mockResolvedValue([]);

      await expect(service.getStatusHistory('order-1', admin)).resolves.toEqual(
        [],
      );
    });

    it('should mask non-owned orders as 404 for customers (IDOR protection)', async () => {
      // Order belongs to user-1; requester is a different customer.
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        service.getStatusHistory('order-1', { id: 'user-2', role: 'CUSTOMER' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getStatusHistory('non-existent', customer),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── createOrder — guest path match-or-create (Task 10) ────────────────────
  //
  // Three scenarios:
  //   SHADOW match  → attach order + fill-blanks profile update
  //   CLAIMED match → attach order only, never mutate profile (anti-spoofing)
  //   No match      → upsert new shadow User, attach order
  //
  // All three use the same DTO shape. The prisma.user.findFirst mock controls
  // which branch executes. Order-create mocks follow the same pattern as the
  // existing guest-checkout tests above.

  describe('createOrder — guest path match-or-create', () => {
    const baseGuestDto = {
      items: [{ productId: 'prod-1', variantId: 'var-1', quantity: 1 }],
      shippingAddress: {
        line1: '1 Test St', city: 'Dhaka', state: 'Dhaka',
        postalCode: '1200', country: 'BD',
      },
      guestEmail: 'guest@example.com',
      guestName: 'Guest User',
      guestPhone: '01776902711',
    };

    function setupOrderMocks(shadowUserId: string) {
      prisma.productVariant.findMany.mockResolvedValue([mockVariant]);
      const mockTx = createMockTx();
      mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
      mockTx.order.create.mockResolvedValue({
        ...mockOrder,
        id: 'order-mc-1',
        userId: shadowUserId,
      });
      mockTx.productVariant.update.mockResolvedValue({});
      mockTx.inventoryLog.create.mockResolvedValue({});
      (prisma as any).$transaction.mockImplementation(async (cb: Function) =>
        cb(mockTx),
      );
      return mockTx;
    }

    it('attaches order to matched SHADOW user and fill-blanks updates', async () => {
      // SHADOW user: claimedAt null, empty firstName, one existing phone
      prisma.user.findFirst.mockResolvedValue({
        id: 'shadow-1',
        email: 'guest@example.com',
        firstName: '',
        lastName: '',
        phones: ['01700000000'],
        claimedAt: null,
        deletedAt: null,
      });
      prisma.user.update.mockResolvedValue({ id: 'shadow-1' });
      const mockTx = setupOrderMocks('shadow-1');

      await service.createOrder(null, baseGuestDto as any);

      // SHADOW fill-blanks: firstName filled, phones dedup-prepended
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shadow-1' },
          data: expect.objectContaining({
            firstName: 'Guest User',
            phones: ['01776902711', '01700000000'],
          }),
        }),
      );
      // Order is created with userId = shadow.id
      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'shadow-1' }),
        }),
      );
    });

    it('attaches order to matched CLAIMED user but does NOT mutate profile', async () => {
      // CLAIMED user: claimedAt is set — profile is read-only from guest checkout
      prisma.user.findFirst.mockResolvedValue({
        id: 'real-1',
        email: 'guest@example.com',
        firstName: 'Real',
        lastName: 'User',
        phones: ['01700000000'],
        claimedAt: new Date('2026-01-01'),
        deletedAt: null,
      });
      const mockTx = setupOrderMocks('real-1');

      await service.createOrder(null, baseGuestDto as any);

      // Profile must NOT be mutated for claimed users
      expect(prisma.user.update).not.toHaveBeenCalled();
      // Order is still attached to the claimed user's id
      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'real-1' }),
        }),
      );
    });

    it('creates a new shadow when no match found', async () => {
      // No match: service upserts a new shadow record
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.upsert.mockResolvedValue({ id: 'new-shadow-1' });
      const mockTx = setupOrderMocks('new-shadow-1');

      await service.createOrder(null, baseGuestDto as any);

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'guest@example.com' },
          create: expect.objectContaining({
            email: 'guest@example.com',
            firstName: 'Guest User',
            lastName: '',
            phones: ['01776902711'],
            passwordHash: null,
            claimedAt: null,
            createdBy: null,
          }),
        }),
      );
      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'new-shadow-1' }),
        }),
      );
    });

    it('does not update SHADOW profile when firstName already set and phone unchanged', async () => {
      // SHADOW with firstName already populated and phone already at position 0
      prisma.user.findFirst.mockResolvedValue({
        id: 'shadow-2',
        email: 'guest@example.com',
        firstName: 'Already Set',
        lastName: '',
        phones: ['01776902711'], // same as incoming — no change needed
        claimedAt: null,
        deletedAt: null,
      });
      const mockTx = setupOrderMocks('shadow-2');

      await service.createOrder(null, baseGuestDto as any);

      // Nothing to update — no update call should be made
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'shadow-2' }),
        }),
      );
    });
  });

  describe('bulkImportHistory — placeholder product creation', () => {
    it('finds existing Legacy Imports category', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-legacy', slug: 'legacy-imports' });

      await service.bulkImportHistory(
        Buffer.from(`order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,UNKNOWN-SKU,1,1099`, 'utf-8'),
        'admin-1',
      );

      expect(prisma.category.create).not.toHaveBeenCalled();
    });

    it('creates Legacy Imports category if missing', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({ id: 'cat-new', slug: 'legacy-imports' });

      await service.bulkImportHistory(
        Buffer.from(`order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,UNKNOWN-SKU,1,1099`, 'utf-8'),
        'admin-1',
      );

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { slug: 'legacy-imports', name: 'Legacy Imports' },
      });
    });

    it('creates a hidden placeholder Product+Variant for an unknown SKU', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-legacy', slug: 'legacy-imports' });
      prisma.productVariant.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.user.upsert.mockResolvedValue({ id: 'new-shadow' });
      prisma.product.create.mockResolvedValue({ id: 'placeholder-prod' });
      prisma.productVariant.create.mockResolvedValue({
        id: 'placeholder-var',
        sku: 'UNKNOWN-SKU',
        productId: 'placeholder-prod',
      });
      prisma.order.create.mockResolvedValue({ id: 'ord-1', orderNumber: 'LEGACY-OLD-1' });

      const result = await service.bulkImportHistory(
        Buffer.from(`order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,UNKNOWN-SKU,1,1099`, 'utf-8'),
        'admin-1',
      );

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'UNKNOWN-SKU',
          slug: 'legacy-unknown-sku',
          price: 1099,
          isActive: false,
          categoryId: 'cat-legacy',
        }),
      });
      expect(prisma.productVariant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'placeholder-prod',
          sku: 'UNKNOWN-SKU',
          size: '-',
          color: '-',
          stock: 0,
          price: 1099,
        }),
      });
      expect(result.placeholdersCreated).toBe(1);
      expect(result.placeholdersReport).toEqual([
        expect.objectContaining({ sku: 'UNKNOWN-SKU', productId: 'placeholder-prod' }),
      ]);
    });

    it('reuses the same placeholder for multiple orders with same unknown SKU', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-legacy' });
      prisma.productVariant.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.user.upsert.mockResolvedValue({ id: 'shadow-1' });
      prisma.product.create.mockResolvedValue({ id: 'placeholder-prod' });
      prisma.productVariant.create.mockResolvedValue({ id: 'placeholder-var', sku: 'X-SKU' });
      prisma.order.create.mockResolvedValue({ id: 'ord-1' });

      await service.bulkImportHistory(
        Buffer.from(`order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,X-SKU,1,500
OLD-2,2024-08-16,grace@example.com,X-SKU,2,500`, 'utf-8'),
        'admin-1',
      );

      expect(prisma.product.create).toHaveBeenCalledTimes(1);
      expect(prisma.productVariant.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('bulkImportHistory — customer linkage + order creation', () => {
    const csv = `order_ref,order_date,customer_email,customer_name,customer_phone,sku,quantity,unit_price,shipping_cost
OLD-100,2024-08-15,sakib@example.com,Sakib,01776902711,SKU-A,2,1099,80`;

    beforeEach(() => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-legacy' });
      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-a', sku: 'SKU-A', productId: 'prod-a' },
      ]);
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.order.create.mockResolvedValue({ id: 'ord-1', orderNumber: 'LEGACY-OLD-100' });
    });

    it('attaches order to existing CLAIMED user without mutating profile', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'claimed-1',
          email: 'sakib@example.com',
          claimedAt: new Date('2024-01-01'),
          firstName: 'Real',
          phones: ['01700000000'],
        },
      ]);

      const result = await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.upsert).not.toHaveBeenCalled();
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: 'LEGACY-OLD-100',
            userId: 'claimed-1',
            status: 'DELIVERED',
            subtotal: 2 * 1099,
            shippingCost: 80,
            total: 2 * 1099 + 80,
            createdAt: new Date('2024-08-15'),
          }),
        }),
      );
      expect(result.ordersAttachedToExisting).toBe(1);
      expect(result.newShadowsCreated).toBe(0);
    });

    it('fill-blanks update on existing SHADOW user', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'shadow-1',
          email: 'sakib@example.com',
          claimedAt: null,
          firstName: '',
          phones: [],
        },
      ]);
      prisma.user.update.mockResolvedValue({ id: 'shadow-1' });

      await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'shadow-1' },
        data: expect.objectContaining({
          firstName: 'Sakib',
          phones: ['01776902711'],
        }),
      });
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'shadow-1' }),
        }),
      );
    });

    it('auto-creates shadow when no matching user exists', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.upsert.mockResolvedValue({ id: 'new-shadow' });

      const result = await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'sakib@example.com' },
          create: expect.objectContaining({
            email: 'sakib@example.com',
            firstName: 'Sakib',
            phones: ['01776902711'],
            passwordHash: null,
            claimedAt: null,
            createdBy: null,
          }),
        }),
      );
      expect(result.newShadowsCreated).toBe(1);
    });

    it('SKIPS stock decrement — does not call productVariant.update with stock change', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.upsert.mockResolvedValue({ id: 'new-shadow' });

      await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

      const variantUpdateCalls = (prisma.productVariant.update.mock.calls ?? []) as Array<
        [{ data: Record<string, unknown> }]
      >;
      for (const [arg] of variantUpdateCalls) {
        expect(arg.data).not.toHaveProperty('stock');
      }
    });

    it('dedupes orders by orderNumber on re-run', async () => {
      prisma.order.findFirst.mockResolvedValueOnce({ id: 'existing-ord' });
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

      expect(result.skipped_duplicate).toBe(1);
      expect(result.imported).toBe(0);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('computes total = sum(qty * unit_price) + shipping - discount', async () => {
      const csv2 = `order_ref,order_date,customer_email,sku,quantity,unit_price,shipping_cost,discount_amount
OLD-101,2024-08-15,ada@example.com,SKU-A,3,500,100,50`;
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.upsert.mockResolvedValue({ id: 'shadow-x' });

      await service.bulkImportHistory(Buffer.from(csv2, 'utf-8'), 'admin-1');

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 1500,
            shippingCost: 100,
            discount: 50,
            total: 1550,
          }),
        }),
      );
    });

    it('uses placeholder shipping address when ship_* columns missing', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.upsert.mockResolvedValue({ id: 'shadow-x' });

      await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shippingAddress: expect.objectContaining({
              line1: 'Imported from legacy system',
              city: 'Unknown',
              state: 'Unknown',
              postalCode: '0000',
              country: 'BD',
            }),
          }),
        }),
      );
    });
  });
});
