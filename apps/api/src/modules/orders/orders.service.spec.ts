import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrdersService', () => {
  let service: OrdersService;
  // $transaction is a root-level jest.Mock, not a Record of mocks, so mix the
  // two shapes with a loose index signature.
  let prisma: Record<string, any>;
  let eventEmitter: { emit: jest.Mock };

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
        update: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
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
      cart: {
        findUnique: jest.fn(),
      },
      cartItem: {
        deleteMany: jest.fn(),
      },
      inventoryLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get(OrdersService);
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
            select: { id: true, name: true, images: true, slug: true },
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
          service.createOrder(null, { ...guestDto, guestEmail: undefined } as any),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects anonymous order missing guestName', async () => {
        await expect(
          service.createOrder(null, { ...guestDto, guestName: undefined } as any),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects anonymous order missing guestPhone', async () => {
        await expect(
          service.createOrder(null, { ...guestDto, guestPhone: undefined } as any),
        ).rejects.toThrow(BadRequestException);
      });

      it('creates a guest order with userId=null and full contact tuple', async () => {
        prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

        const mockTx = createMockTx();
        mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
        mockTx.order.create.mockResolvedValue({
          ...mockOrder,
          userId: null,
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
              userId: null,
              guestEmail: 'guest@example.com',
              guestName: 'Guest Buyer',
              guestPhone: '+8801700000000',
            }),
          }),
        );
        // Guests have no Cart row keyed by userId. The service must not try
        // to clear a cart that doesn't exist.
        expect(prisma.cart.findUnique).not.toHaveBeenCalled();
      });

      it('emits order.created with userId=null for guest order', async () => {
        prisma.productVariant.findMany.mockResolvedValue([mockVariant]);

        const mockTx = createMockTx();
        mockTx.$queryRawUnsafe.mockResolvedValue([{ stock: 10 }]);
        mockTx.order.create.mockResolvedValue({
          ...mockOrder,
          id: 'order-guest-1',
          userId: null,
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
            userId: null,
          }),
        );
      });

      it('ignores guest fields when a userId is supplied (logged-in wins)', async () => {
        // Logged-in customer who somehow sends guestEmail in the body. The
        // service must NOT write that guestEmail to the Order — the user's
        // identity wins. (Defense against confused or malicious clients.)
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
              guestEmail: null,
              guestName: null,
              guestPhone: null,
            }),
          }),
        );
      });
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
          note: 'Cancelled order order-1',
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
          (VALID[from].includes(to) ? validPairs : invalidPairs).push([from, to]);
        }
      }

      it.each(validPairs)('allows %s -> %s', async (from, to) => {
        prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: from });
        mockStatusTx({ ...mockOrder, status: to });

        const result = await service.updateOrderStatus(
          'order-1',
          { status: to },
          'admin-1',
        );

        expect(result.status).toBe(to);
      });

      it.each(invalidPairs)('rejects %s -> %s with BadRequest', async (from, to) => {
        prisma.order.findUnique.mockResolvedValue({ ...mockOrder, status: from });

        await expect(
          service.updateOrderStatus('order-1', { status: to }, 'admin-1'),
        ).rejects.toThrow(BadRequestException);
      });
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
});
