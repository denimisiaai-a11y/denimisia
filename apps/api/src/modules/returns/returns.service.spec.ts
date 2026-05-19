import { ReturnsService } from './returns.service';

describe('ReturnsService', () => {
  let service: ReturnsService;
  let prisma: any;
  let rtnIds: any;
  let events: any;

  const FRESH_DELIVERY = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
  const STALE_DELIVERY = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn() },
      return: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      returnItem: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    rtnIds = { generate: jest.fn().mockResolvedValue('RTN-2026-000001') };
    events = { emit: jest.fn() };
    service = new ReturnsService(prisma, rtnIds, events);
  });

  describe('createReturn', () => {
    const validOrder = {
      id: 'o1',
      userId: 'u1',
      guestEmail: null,
      guestName: null,
      guestPhone: null,
      status: 'DELIVERED',
      items: [
        {
          id: 'oi1',
          quantity: 2,
          product: { returnable: true },
        },
      ],
      statusHistory: [{ toStatus: 'DELIVERED', createdAt: FRESH_DELIVERY }],
    };

    it('rejects when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o1',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/not found/i);
    });

    it('rejects when user is not the owner', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...validOrder,
        userId: 'someone-else',
      });
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o1',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/credentials/i);
    });

    it('rejects when order not DELIVERED', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...validOrder,
        status: 'SHIPPED',
      });
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o1',
            reason: 'DEFECTIVE',
            photos: ['https://r2/p.jpg'],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/DELIVERED/);
    });

    it('rejects when photos missing for fault reason', async () => {
      prisma.order.findUnique.mockResolvedValue(validOrder);
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o1',
            reason: 'DEFECTIVE',
            photos: [],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/Photos are required/);
    });

    it('rejects when 7-day window expired', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...validOrder,
        statusHistory: [{ toStatus: 'DELIVERED', createdAt: STALE_DELIVERY }],
      });
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o1',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/window/);
    });

    it('creates a return with auto-fault and emits event', async () => {
      prisma.order.findUnique.mockResolvedValue(validOrder);
      prisma.return.create.mockResolvedValue({
        id: 'r1',
        rtnNumber: 'RTN-2026-000001',
      });
      const out = await service.createReturn({
        userId: 'u1',
        dto: {
          orderId: 'o1',
          reason: 'CHANGED_MIND',
          photos: [],
          items: [{ orderItemId: 'oi1', quantity: 1 }],
        } as never,
      });
      expect(out.rtnNumber).toBe('RTN-2026-000001');
      expect(prisma.return.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fault: 'CUSTOMER',
            customerShipsBack: true,
          }),
        }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'return.requested',
        expect.objectContaining({ rtnNumber: 'RTN-2026-000001' }),
      );
    });

    it('blocks quantity exceeding ordered minus already-returned', async () => {
      prisma.order.findUnique.mockResolvedValue(validOrder);
      prisma.returnItem.groupBy.mockResolvedValue([
        { orderItemId: 'oi1', _sum: { quantity: 2 } },
      ]);
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o1',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/ineligible/);
    });

    it('blocks non-returnable products', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...validOrder,
        items: [
          {
            id: 'oi1',
            quantity: 2,
            product: { returnable: false },
          },
        ],
      });
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o1',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/ineligible.*PRODUCT_NOT_RETURNABLE/);
    });

    it('accepts guest with matching email + phone', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...validOrder,
        userId: null,
        guestEmail: 'guest@example.com',
        guestPhone: '+8801711111111',
      });
      prisma.return.create.mockResolvedValue({
        id: 'r1',
        rtnNumber: 'RTN-2026-000001',
      });
      await expect(
        service.createReturn({
          userId: null,
          dto: {
            orderId: 'o1',
            guestEmail: 'guest@example.com',
            guestPhone: '+8801711111111',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).resolves.toBeDefined();
    });

    it('rejects guest with mismatched email', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...validOrder,
        userId: null,
        guestEmail: 'guest@example.com',
        guestPhone: '+8801711111111',
      });
      await expect(
        service.createReturn({
          userId: null,
          dto: {
            orderId: 'o1',
            guestEmail: 'wrong@example.com',
            guestPhone: '+8801711111111',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [{ orderItemId: 'oi1', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/credentials/i);
    });
  });

  describe('cancelReturn', () => {
    it('cancels a REQUESTED return for its owner', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        rtnNumber: 'RTN-2026-000001',
        status: 'REQUESTED',
        userId: 'u1',
        guestEmail: null,
        guestPhone: null,
      });
      await service.cancelReturn({
        userId: 'u1',
        rtnNumber: 'RTN-2026-000001',
      });
      expect(prisma.return.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'CANCELLED', closedAt: expect.any(Date) },
      });
    });

    it('rejects cancellation of APPROVED return', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'APPROVED',
        userId: 'u1',
        guestEmail: null,
        guestPhone: null,
      });
      await expect(
        service.cancelReturn({ userId: 'u1', rtnNumber: 'RTN-2026-000001' }),
      ).rejects.toThrow(/Cannot cancel/);
    });
  });
});
