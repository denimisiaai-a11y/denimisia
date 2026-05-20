import { ReturnsAdminController } from './returns-admin.controller';

describe('ReturnsAdminController', () => {
  let controller: ReturnsAdminController;
  let service: {
    listForAdmin: jest.Mock;
    getForAdmin: jest.Mock;
    transition: jest.Mock;
    recordInspection: jest.Mock;
  };
  let refunds: {
    issueRefund: jest.Mock;
  };

  const adminUser = { id: 'admin-1' };

  beforeEach(() => {
    service = {
      listForAdmin: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      getForAdmin: jest.fn().mockResolvedValue({ id: 'r1' }),
      transition: jest.fn().mockResolvedValue({ id: 'r1', status: 'APPROVED' }),
      recordInspection: jest
        .fn()
        .mockResolvedValue({ status: 'INSPECTED_PASS' }),
    };
    refunds = {
      issueRefund: jest.fn().mockResolvedValue({ id: 'txn1' }),
    };
    const metrics = {
      getDashboard: jest.fn().mockResolvedValue({}),
    };
    controller = new ReturnsAdminController(
      service as never,
      refunds as never,
      metrics as never,
    );
  });

  describe('list', () => {
    it('passes single status as a one-element array', async () => {
      await controller.list({
        status: 'REQUESTED',
        page: 1,
        limit: 20,
      } as never);
      expect(service.listForAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['REQUESTED'] }),
      );
    });

    it('passes status array through untouched', async () => {
      await controller.list({
        status: ['REQUESTED', 'UNDER_REVIEW'],
        page: 1,
        limit: 20,
      } as never);
      expect(service.listForAdmin).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['REQUESTED', 'UNDER_REVIEW'],
        }),
      );
    });

    it('omits status when absent', async () => {
      await controller.list({ page: 2, limit: 50 } as never);
      expect(service.listForAdmin).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined, page: 2, limit: 50 }),
      );
    });
  });

  describe('review', () => {
    it('transitions to UNDER_REVIEW and connects reviewer relation', async () => {
      await controller.review('r1', adminUser, { reviewerNotes: 'hi' });
      expect(service.transition).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'r1',
          to: 'UNDER_REVIEW',
          adminId: 'admin-1',
          patch: expect.objectContaining({
            reviewer: { connect: { id: 'admin-1' } },
            reviewerNotes: 'hi',
          }),
        }),
      );
    });
  });

  describe('approve', () => {
    it('forwards approval patch with carrier + pickupAddress', async () => {
      await controller.approve('r1', adminUser, {
        carrier: 'Pathao',
        pickupAddress: {
          line1: '1 Main',
          city: 'Dhaka',
          contactName: 'Joy',
          contactPhone: '+8801711111111',
        },
        approvalNotes: 'OK',
      });
      expect(service.transition).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'APPROVED',
          patch: expect.objectContaining({
            carrier: 'Pathao',
            pickupAddress: expect.objectContaining({ city: 'Dhaka' }),
            reviewerNotes: 'OK',
          }),
        }),
      );
    });
  });

  describe('reject', () => {
    it('transitions to REJECTED and stamps closedAt', async () => {
      await controller.reject('r1', adminUser, {
        rejectionReason: 'photos invalid',
      });
      const call = service.transition.mock.calls[0][0];
      expect(call.to).toBe('REJECTED');
      expect(call.patch.rejectionReason).toBe('photos invalid');
      expect(call.patch.closedAt).toBeInstanceOf(Date);
    });
  });

  describe('markReceived', () => {
    it('transitions to RECEIVED with tracking', async () => {
      await controller.markReceived('r1', adminUser, {
        trackingNumber: 'TRK-1',
      });
      expect(service.transition).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'RECEIVED',
          patch: { trackingNumber: 'TRK-1' },
        }),
      );
    });
  });

  describe('startInspection', () => {
    it('transitions to INSPECTING with no patch', async () => {
      await controller.startInspection('r1', adminUser);
      expect(service.transition).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'INSPECTING', id: 'r1' }),
      );
    });
  });

  describe('inspect', () => {
    it('delegates to recordInspection', async () => {
      await controller.inspect('r1', adminUser, {
        itemResults: [
          { returnItemId: 'ri1', inspectionResult: 'PASS', restock: true },
        ],
        inspectionNotes: 'all good',
      });
      expect(service.recordInspection).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'r1',
          adminId: 'admin-1',
          inspectionNotes: 'all good',
        }),
      );
    });
  });

  describe('returnToCustomer', () => {
    it('transitions to RETURNED_TO_CUSTOMER', async () => {
      await controller.returnToCustomer('r1', adminUser);
      expect(service.transition).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'RETURNED_TO_CUSTOMER' }),
      );
    });
  });

  describe('issueRefund', () => {
    it('delegates to refunds.issueRefund with admin id + dto fields', async () => {
      await controller.issueRefund('r1', adminUser, {
        amount: 500,
        method: 'CASH',
        reference: 'Voucher-1',
        notes: 'paid in store',
        overrideFromFail: false,
      });
      expect(refunds.issueRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          returnId: 'r1',
          adminId: 'admin-1',
          amount: 500,
          method: 'CASH',
          reference: 'Voucher-1',
          notes: 'paid in store',
          overrideFromFail: false,
        }),
      );
    });
  });
});
