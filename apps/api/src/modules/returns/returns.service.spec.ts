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
      order: { findUnique: jest.fn(), findFirst: jest.fn() },
      return: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      returnItem: { groupBy: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
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
      prisma.order.findFirst.mockResolvedValue(null);
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
      prisma.order.findFirst.mockResolvedValue({
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
      prisma.order.findFirst.mockResolvedValue({
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
      prisma.order.findFirst.mockResolvedValue(validOrder);
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
      prisma.order.findFirst.mockResolvedValue({
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
      prisma.order.findFirst.mockResolvedValue(validOrder);
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
      prisma.order.findFirst.mockResolvedValue(validOrder);
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
      prisma.order.findFirst.mockResolvedValue({
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
      prisma.order.findFirst.mockResolvedValue({
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
      prisma.order.findFirst.mockResolvedValue({
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

  describe('listForAdmin', () => {
    beforeEach(() => {
      prisma.return.findMany = jest.fn().mockResolvedValue([]);
      prisma.return.count = jest.fn().mockResolvedValue(0);
    });

    it('filters by status array when no slaOverdue', async () => {
      await service.listForAdmin({
        status: ['REQUESTED'],
        page: 1,
        limit: 20,
      });
      expect(prisma.return.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['REQUESTED'] } },
        }),
      );
    });

    it('slaOverdue mode overrides status filter and pins to REQUESTED+UNDER_REVIEW', async () => {
      await service.listForAdmin({
        status: ['REJECTED'],
        slaOverdue: true,
        page: 1,
        limit: 20,
      });
      expect(prisma.return.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slaDeadline: { lt: expect.any(Date) },
            status: { in: ['REQUESTED', 'UNDER_REVIEW'] },
          }),
        }),
      );
    });

    it('paginates with skip/take', async () => {
      await service.listForAdmin({ page: 3, limit: 25 });
      expect(prisma.return.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 50, take: 25 }),
      );
    });
  });

  describe('transition', () => {
    it('rejects illegal transitions', async () => {
      prisma.return.findUnique.mockResolvedValue({
        status: 'REQUESTED',
        rtnNumber: 'RTN-1',
      });
      await expect(
        service.transition({
          id: 'r1',
          to: 'REFUNDED',
          adminId: 'admin1',
        }),
      ).rejects.toThrow(/Cannot transition/);
    });

    it('allows legal transitions and stamps timestamp', async () => {
      prisma.return.findUnique.mockResolvedValue({
        status: 'REQUESTED',
        rtnNumber: 'RTN-1',
      });
      prisma.return.update.mockResolvedValue({ id: 'r1', rtnNumber: 'RTN-1' });
      await service.transition({
        id: 'r1',
        to: 'UNDER_REVIEW',
        adminId: 'admin1',
      });
      expect(prisma.return.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'UNDER_REVIEW',
            reviewedAt: expect.any(Date),
          }),
        }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'return.under_review',
        expect.objectContaining({ rtnNumber: 'RTN-1' }),
      );
    });

    it('throws NotFoundException for missing return', async () => {
      prisma.return.findUnique.mockResolvedValue(null);
      await expect(
        service.transition({ id: 'r1', to: 'UNDER_REVIEW', adminId: 'a' }),
      ).rejects.toThrow(/Not Found/i);
    });
  });

  describe('recordInspection', () => {
    beforeEach(() => {
      prisma.returnItem.update = jest.fn().mockResolvedValue({});
    });

    it('rejects if return not in INSPECTING state', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'APPROVED',
        rtnNumber: 'RTN-1',
        items: [{ id: 'ri1' }],
      });
      await expect(
        service.recordInspection({
          id: 'r1',
          adminId: 'a',
          itemResults: [
            { returnItemId: 'ri1', inspectionResult: 'PASS', restock: true },
          ],
        }),
      ).rejects.toThrow(/INSPECTING/);
    });

    it('rejects unknown returnItemId', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'INSPECTING',
        rtnNumber: 'RTN-1',
        items: [{ id: 'ri1' }],
      });
      await expect(
        service.recordInspection({
          id: 'r1',
          adminId: 'a',
          itemResults: [
            { returnItemId: 'rogue', inspectionResult: 'PASS', restock: true },
          ],
        }),
      ).rejects.toThrow(/does not belong/);
    });

    it('sets INSPECTED_PASS when all items pass', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'INSPECTING',
        rtnNumber: 'RTN-1',
        items: [{ id: 'ri1' }, { id: 'ri2' }],
      });
      prisma.$transaction = jest.fn().mockResolvedValue([]);
      const result = await service.recordInspection({
        id: 'r1',
        adminId: 'a',
        itemResults: [
          { returnItemId: 'ri1', inspectionResult: 'PASS', restock: true },
          { returnItemId: 'ri2', inspectionResult: 'PASS', restock: false },
        ],
      });
      expect(result.status).toBe('INSPECTED_PASS');
      expect(events.emit).toHaveBeenCalledWith(
        'return.inspected_pass',
        expect.any(Object),
      );
    });

    it('sets INSPECTED_FAIL when any item fails', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'INSPECTING',
        rtnNumber: 'RTN-1',
        items: [{ id: 'ri1' }, { id: 'ri2' }],
      });
      prisma.$transaction = jest.fn().mockResolvedValue([]);
      const result = await service.recordInspection({
        id: 'r1',
        adminId: 'a',
        itemResults: [
          { returnItemId: 'ri1', inspectionResult: 'PASS', restock: true },
          { returnItemId: 'ri2', inspectionResult: 'FAIL', restock: false },
        ],
      });
      expect(result.status).toBe('INSPECTED_FAIL');
    });
  });

  describe('bundle-component returns', () => {
    // Bundle orders carry their constituents inside OrderItem.snapshot
    // as `{ items: [{ variantId, productName, size, color, ... }] }`.
    // The returns API requires the customer to name which constituent
    // is being returned and tracks already-returned quantity per
    // (orderItemId, bundleComponentVariantId) tuple so component A and
    // component B can be returned independently.
    const BUNDLE_SNAPSHOT = {
      bundleSlug: 'tee-3-pack',
      bundleName: 'Tee 3-Pack',
      bundleSize: 'M',
      bundlePrice: 900,
      items: [
        {
          productId: 'p-a',
          variantId: 'v-a',
          productName: 'Crew Tee',
          color: 'Black',
          size: 'M',
          image: null,
        },
        {
          productId: 'p-b',
          variantId: 'v-b',
          productName: 'Crew Tee',
          color: 'White',
          size: 'M',
          image: null,
        },
        {
          productId: 'p-c',
          variantId: 'v-c',
          productName: 'Crew Tee',
          color: 'Olive',
          size: 'M',
          image: null,
        },
      ],
    };

    const bundleOrder = {
      id: 'o-bundle',
      userId: 'u1',
      guestEmail: null,
      guestName: null,
      guestPhone: null,
      status: 'DELIVERED',
      items: [
        {
          id: 'oi-bundle',
          quantity: 1,
          bundleId: 'b1',
          snapshot: BUNDLE_SNAPSHOT,
          product: null,
        },
      ],
      statusHistory: [{ toStatus: 'DELIVERED', createdAt: FRESH_DELIVERY }],
    };

    it('rejects a bundle item request without bundleComponentVariantId', async () => {
      prisma.order.findFirst.mockResolvedValue(bundleOrder);
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o-bundle',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [{ orderItemId: 'oi-bundle', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/bundleComponentVariantId is required/);
    });

    it('rejects a non-bundle item request that supplies bundleComponentVariantId', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        guestEmail: null,
        guestName: null,
        guestPhone: null,
        status: 'DELIVERED',
        statusHistory: [{ toStatus: 'DELIVERED', createdAt: FRESH_DELIVERY }],
        items: [
          {
            id: 'oi1',
            quantity: 2,
            bundleId: null,
            snapshot: null,
            product: { returnable: true },
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
            items: [
              {
                orderItemId: 'oi1',
                quantity: 1,
                bundleComponentVariantId: 'v-a',
              },
            ],
          } as never,
        }),
      ).rejects.toThrow(/is not a bundle line/);
    });

    it('rejects bundleComponentVariantId that is not a constituent of the bundle', async () => {
      prisma.order.findFirst.mockResolvedValue(bundleOrder);
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o-bundle',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [
              {
                orderItemId: 'oi-bundle',
                quantity: 1,
                bundleComponentVariantId: 'v-rogue',
              },
            ],
          } as never,
        }),
      ).rejects.toThrow(/not a constituent/);
    });

    it('creates a ReturnItem with snapshot fields populated for a valid component', async () => {
      prisma.order.findFirst.mockResolvedValue(bundleOrder);
      prisma.return.create.mockResolvedValue({
        id: 'r-bundle',
        rtnNumber: 'RTN-2026-000010',
      });
      await service.createReturn({
        userId: 'u1',
        dto: {
          orderId: 'o-bundle',
          reason: 'CHANGED_MIND',
          photos: [],
          items: [
            {
              orderItemId: 'oi-bundle',
              quantity: 1,
              bundleComponentVariantId: 'v-b',
            },
          ],
        } as never,
      });
      expect(prisma.return.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [
                expect.objectContaining({
                  orderItemId: 'oi-bundle',
                  quantity: 1,
                  bundleComponentVariantId: 'v-b',
                  bundleComponentName: 'Crew Tee',
                  bundleComponentSize: 'M',
                  bundleComponentColor: 'White',
                }),
              ],
            },
          }),
        }),
      );
    });

    it('allows components A and B to be returned in the same request', async () => {
      prisma.order.findFirst.mockResolvedValue(bundleOrder);
      prisma.return.create.mockResolvedValue({
        id: 'r-bundle',
        rtnNumber: 'RTN-2026-000011',
      });
      await service.createReturn({
        userId: 'u1',
        dto: {
          orderId: 'o-bundle',
          reason: 'CHANGED_MIND',
          photos: [],
          items: [
            {
              orderItemId: 'oi-bundle',
              quantity: 1,
              bundleComponentVariantId: 'v-a',
            },
            {
              orderItemId: 'oi-bundle',
              quantity: 1,
              bundleComponentVariantId: 'v-c',
            },
          ],
        } as never,
      });
      const createCall = (prisma.return.create as jest.Mock).mock.calls[0][0];
      const createdItems = createCall.data.items.create;
      expect(createdItems).toHaveLength(2);
      expect(createdItems.map((i: { bundleComponentVariantId: string }) => i.bundleComponentVariantId)).toEqual([
        'v-a',
        'v-c',
      ]);
    });

    it('blocks returning component A twice (already-returned tracked per component)', async () => {
      prisma.order.findFirst.mockResolvedValue(bundleOrder);
      // groupBy now returns rows keyed by (orderItemId, bundleComponentVariantId)
      prisma.returnItem.groupBy.mockResolvedValue([
        {
          orderItemId: 'oi-bundle',
          bundleComponentVariantId: 'v-a',
          _sum: { quantity: 1 },
        },
      ]);
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o-bundle',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [
              {
                orderItemId: 'oi-bundle',
                quantity: 1,
                bundleComponentVariantId: 'v-a',
              },
            ],
          } as never,
        }),
      ).rejects.toThrow(/ITEM_ALREADY_RETURNED/);
    });

    it('returning component A does NOT block returning component B independently', async () => {
      prisma.order.findFirst.mockResolvedValue(bundleOrder);
      prisma.returnItem.groupBy.mockResolvedValue([
        {
          orderItemId: 'oi-bundle',
          bundleComponentVariantId: 'v-a',
          _sum: { quantity: 1 },
        },
      ]);
      prisma.return.create.mockResolvedValue({
        id: 'r-bundle-b',
        rtnNumber: 'RTN-2026-000012',
      });
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o-bundle',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [
              {
                orderItemId: 'oi-bundle',
                quantity: 1,
                bundleComponentVariantId: 'v-b',
              },
            ],
          } as never,
        }),
      ).resolves.toBeDefined();
    });

    it('rejects a bundle line whose snapshot is missing items[] (legacy snapshot drift)', async () => {
      prisma.order.findFirst.mockResolvedValue({
        ...bundleOrder,
        items: [
          {
            id: 'oi-legacy',
            quantity: 1,
            bundleId: 'b1',
            snapshot: { bundleSlug: 'legacy-pack' }, // no `items` array
            product: null,
          },
        ],
      });
      await expect(
        service.createReturn({
          userId: 'u1',
          dto: {
            orderId: 'o-bundle',
            reason: 'CHANGED_MIND',
            photos: [],
            items: [
              {
                orderItemId: 'oi-legacy',
                quantity: 1,
                bundleComponentVariantId: 'v-a',
              },
            ],
          } as never,
        }),
      ).rejects.toThrow(/missing constituents/);
    });
  });

  describe('matchesReturnOwnership (regression: auth-bypass via guest creds)', () => {
    it("does NOT allow a logged-in user to access another user's return by supplying guest creds", async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r2',
        rtnNumber: 'RTN-2026-000002',
        status: 'REQUESTED',
        userId: null,
        guestEmail: 'guest@example.com',
        guestPhone: '+8801711111111',
      });
      await expect(
        service.getByRtnNumber({
          rtnNumber: 'RTN-2026-000002',
          userId: 'attacker-user-id',
          guestEmail: 'guest@example.com',
          guestPhone: '+8801711111111',
        }),
      ).rejects.toThrow(/Forbidden/i);
    });
  });

  describe('createManual', () => {
    beforeEach(() => {
      prisma.return.create.mockResolvedValue({
        id: 'rm1',
        rtnNumber: 'RTN-2026-000050',
      });
    });

    it('creates a standalone manual return without orderId', async () => {
      const result = await service.createManual({
        adminId: 'admin1',
        dto: {
          orderId: null,
          customerName: 'Walk-in Customer',
          customerPhone: '+8801712345678',
          reason: 'CHANGED_MIND',
          photos: [],
          items: [
            {
              orderItemId: null,
              manualProductName: 'Standalone tee',
              manualSku: 'TEE-001',
              manualSize: 'M',
              manualColor: 'Black',
              manualUnitPrice: 1200,
              quantity: 1,
            },
          ],
        } as never,
      });

      expect(result.rtnNumber).toBe('RTN-2026-000050');
      expect(prisma.return.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isManual: true,
            orderId: null,
            userId: null,
            guestName: 'Walk-in Customer',
            guestPhone: '+8801712345678',
            fault: 'CUSTOMER',
            customerShipsBack: true,
          }),
        }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'return.requested',
        expect.objectContaining({ isManual: true, adminId: 'admin1' }),
      );
    });

    it('throws when orderId given but order not found', async () => {
      prisma.order.findFirst.mockResolvedValue(null);
      await expect(
        service.createManual({
          adminId: 'admin1',
          dto: {
            orderId: 'nonexistent',
            customerName: 'Customer',
            customerPhone: '+8801712345678',
            reason: 'DEFECTIVE',
            photos: ['https://r2/p.jpg'],
            items: [
              {
                orderItemId: null,
                manualProductName: 'X',
                manualUnitPrice: 100,
                quantity: 1,
              },
            ],
          } as never,
        }),
      ).rejects.toThrow(/not found/i);
    });

    it('throws when item references orderItemId not in the order', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        guestEmail: null,
        guestPhone: null,
        items: [{ id: 'oi1', quantity: 1, product: { returnable: true } }],
      });
      await expect(
        service.createManual({
          adminId: 'admin1',
          dto: {
            orderId: 'o1',
            customerName: 'Customer',
            customerPhone: '+8801712345678',
            reason: 'DEFECTIVE',
            photos: ['https://r2/p.jpg'],
            items: [{ orderItemId: 'rogue', quantity: 1 }],
          } as never,
        }),
      ).rejects.toThrow(/not in order/i);
    });

    it('honors faultOverride for forced US fault on customer-fault reason', async () => {
      await service.createManual({
        adminId: 'admin1',
        dto: {
          orderId: null,
          customerName: 'Customer',
          customerPhone: '+8801712345678',
          reason: 'CHANGED_MIND',
          faultOverride: 'US',
          photos: [],
          items: [
            {
              orderItemId: null,
              manualProductName: 'X',
              manualUnitPrice: 100,
              quantity: 1,
            },
          ],
        } as never,
      });
      expect(prisma.return.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fault: 'US',
            customerShipsBack: false,
          }),
        }),
      );
    });

    it('links to existing order when orderId provided + orderItemId valid', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        guestEmail: 'guest@example.com',
        guestPhone: '+8801711111111',
        items: [{ id: 'oi1', quantity: 2, product: { returnable: true } }],
      });
      await service.createManual({
        adminId: 'admin1',
        dto: {
          orderId: 'o1',
          customerName: 'Customer Override',
          customerPhone: '+8801712345678',
          reason: 'DEFECTIVE',
          photos: ['https://r2/p.jpg'],
          items: [{ orderItemId: 'oi1', quantity: 1 }],
        } as never,
      });
      expect(prisma.return.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'o1',
            userId: 'u1',
            // customer name override wins
            guestName: 'Customer Override',
            // phone override wins
            guestPhone: '+8801712345678',
            // email falls back to order's guestEmail since not provided
            guestEmail: 'guest@example.com',
            isManual: true,
          }),
        }),
      );
    });
  });
});
