import { ReturnsRefundService } from './returns.refund.service';

describe('ReturnsRefundService', () => {
  let service: ReturnsRefundService;
  let prisma: any;
  let events: any;

  beforeEach(() => {
    prisma = {
      return: { findUnique: jest.fn(), update: jest.fn() },
      refundTransaction: { create: jest.fn() },
      productVariant: { update: jest.fn() },
      $transaction: jest.fn(),
    };
    events = { emit: jest.fn() };
    service = new ReturnsRefundService(prisma, events);
  });

  describe('issueRefund', () => {
    it('throws NotFoundException when return missing', async () => {
      prisma.return.findUnique.mockResolvedValue(null);
      await expect(
        service.issueRefund({
          returnId: 'missing',
          adminId: 'a',
          amount: 100,
          method: 'CASH',
          reference: 'ref',
          overrideFromFail: false,
        }),
      ).rejects.toThrow(/Not Found/i);
    });

    it('rejects double-refund (refundTxn already exists)', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'INSPECTED_PASS',
        items: [],
        refundTxn: { id: 'txn-already' },
      });
      await expect(
        service.issueRefund({
          returnId: 'r1',
          adminId: 'a',
          amount: 100,
          method: 'CASH',
          reference: 'ref',
          overrideFromFail: false,
        }),
      ).rejects.toThrow(/already been issued/);
    });

    it('rejects from REQUESTED state', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'REQUESTED',
        items: [],
        refundTxn: null,
      });
      await expect(
        service.issueRefund({
          returnId: 'r1',
          adminId: 'a',
          amount: 100,
          method: 'CASH',
          reference: 'ref',
          overrideFromFail: false,
        }),
      ).rejects.toThrow(/Cannot refund/);
    });

    it('rejects from INSPECTED_FAIL without override', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'INSPECTED_FAIL',
        items: [],
        refundTxn: null,
      });
      await expect(
        service.issueRefund({
          returnId: 'r1',
          adminId: 'a',
          amount: 100,
          method: 'CASH',
          reference: 'ref',
          overrideFromFail: false,
        }),
      ).rejects.toThrow(/overrideFromFail/);
    });

    it('allows INSPECTED_FAIL with override', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        rtnNumber: 'RTN-1',
        status: 'INSPECTED_FAIL',
        items: [],
        refundTxn: null,
      });
      prisma.$transaction.mockResolvedValue([{ id: 'txn1' }]);
      await service.issueRefund({
        returnId: 'r1',
        adminId: 'a',
        amount: 100,
        method: 'BANK_TRANSFER',
        reference: 'TXN-100',
        overrideFromFail: true,
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith(
        'return.refunded',
        expect.objectContaining({ rtnNumber: 'RTN-1', amount: 100 }),
      );
    });

    it('happy path: INSPECTED_PASS issues refund + restock per item', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        rtnNumber: 'RTN-1',
        status: 'INSPECTED_PASS',
        items: [
          {
            id: 'ri1',
            inspectionResult: 'PASS',
            restock: true,
            quantity: 2,
            orderItem: { variantId: 'v1', variant: { id: 'v1' } },
          },
          {
            id: 'ri2',
            inspectionResult: 'PASS',
            restock: false,
            quantity: 1,
            orderItem: { variantId: 'v2', variant: { id: 'v2' } },
          },
        ],
        refundTxn: null,
      });
      prisma.$transaction.mockImplementation(async (ops: unknown[]) => {
        expect(ops.length).toBe(3); // refundTxn.create + return.update + 1 variant restock
        return [{ id: 'txn1' }];
      });

      await service.issueRefund({
        returnId: 'r1',
        adminId: 'a',
        amount: 500,
        method: 'BANK_TRANSFER',
        reference: 'BANK-001',
        overrideFromFail: false,
      });
      expect(events.emit).toHaveBeenCalledWith(
        'return.refunded',
        expect.objectContaining({ amount: 500, method: 'BANK_TRANSFER' }),
      );
    });

    it('skips restock for items missing variantId (manual returns)', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r1',
        rtnNumber: 'RTN-1',
        status: 'INSPECTED_PASS',
        items: [
          {
            id: 'ri1',
            inspectionResult: 'PASS',
            restock: true,
            quantity: 1,
            orderItem: null,
          },
        ],
        refundTxn: null,
      });
      prisma.$transaction.mockImplementation(async (ops: unknown[]) => {
        expect(ops.length).toBe(2); // refundTxn + return.update; no restock
        return [{ id: 'txn1' }];
      });
      await service.issueRefund({
        returnId: 'r1',
        adminId: 'a',
        amount: 100,
        method: 'CASH',
        reference: 'Voucher-1',
        overrideFromFail: false,
      });
    });

    it('restocks bundle component by bundleComponentVariantId (not parent line)', async () => {
      // Parent OrderItem on a bundle line has no variantId — restock
      // must target the constituent recorded on the ReturnItem itself.
      prisma.return.findUnique.mockResolvedValue({
        id: 'r-bundle',
        rtnNumber: 'RTN-BC',
        status: 'INSPECTED_PASS',
        items: [
          {
            id: 'ri-bc',
            inspectionResult: 'PASS',
            restock: true,
            quantity: 1,
            bundleComponentVariantId: 'v-b',
            orderItem: { variantId: null, variant: null },
          },
        ],
        refundTxn: null,
      });
      let observedRestockWhere: { id: string } | null = null;
      prisma.productVariant.update.mockImplementation(
        (args: { where: { id: string }; data: unknown }) => {
          observedRestockWhere = args.where;
          return args;
        },
      );
      prisma.$transaction.mockImplementation(async (ops: unknown[]) => {
        expect(ops.length).toBe(3); // refundTxn + return.update + 1 restock
        return [{ id: 'txn-bc' }];
      });
      await service.issueRefund({
        returnId: 'r-bundle',
        adminId: 'a',
        amount: 300,
        method: 'CASH',
        reference: 'Voucher-2',
        overrideFromFail: false,
      });
      expect(observedRestockWhere).toEqual({ id: 'v-b' });
    });

    it('non-bundle item still restocks by orderItem.variantId', async () => {
      prisma.return.findUnique.mockResolvedValue({
        id: 'r-mix',
        rtnNumber: 'RTN-MIX',
        status: 'INSPECTED_PASS',
        items: [
          {
            id: 'ri-regular',
            inspectionResult: 'PASS',
            restock: true,
            quantity: 2,
            bundleComponentVariantId: null,
            orderItem: { variantId: 'v-regular', variant: { id: 'v-regular' } },
          },
        ],
        refundTxn: null,
      });
      let observedRestockWhere: { id: string } | null = null;
      prisma.productVariant.update.mockImplementation(
        (args: { where: { id: string }; data: unknown }) => {
          observedRestockWhere = args.where;
          return args;
        },
      );
      prisma.$transaction.mockImplementation(async (ops: unknown[]) => {
        expect(ops.length).toBe(3);
        return [{ id: 'txn-mix' }];
      });
      await service.issueRefund({
        returnId: 'r-mix',
        adminId: 'a',
        amount: 200,
        method: 'CASH',
        reference: 'Voucher-3',
        overrideFromFail: false,
      });
      expect(observedRestockWhere).toEqual({ id: 'v-regular' });
    });
  });

  describe('computeBundleItemRefund', () => {
    it('divides discounted price evenly', () => {
      expect(
        service.computeBundleItemRefund({
          bundleDiscountedPrice: 300,
          bundleItemCount: 3,
        }),
      ).toBe(100);
    });

    it('rounds to 2 decimals', () => {
      expect(
        service.computeBundleItemRefund({
          bundleDiscountedPrice: 305.25,
          bundleItemCount: 3,
        }),
      ).toBe(101.75);
    });

    it('returns 0 for zero item count', () => {
      expect(
        service.computeBundleItemRefund({
          bundleDiscountedPrice: 300,
          bundleItemCount: 0,
        }),
      ).toBe(0);
    });
  });
});
