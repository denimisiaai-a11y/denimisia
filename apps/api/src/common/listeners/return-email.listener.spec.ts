import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { ReturnEmailListener } from './return-email.listener';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { EmailService } from '../../modules/email/email.service';

interface ReturnRow {
  id: string;
  rtnNumber: string;
  customerShipsBack: boolean;
  rejectionReason: string | null;
  refundAmount: number | null;
  refundMethod: 'CASH' | 'BANK_TRANSFER' | null;
  refundReference: string | null;
  guestEmail: string | null;
  guestName: string | null;
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

describe('ReturnEmailListener', () => {
  let listener: ReturnEmailListener;
  let prisma: { return: { findUnique: jest.Mock } };
  let email: { send: jest.Mock };

  beforeEach(async () => {
    prisma = { return: { findUnique: jest.fn() } };
    email = {
      send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnEmailListener,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    listener = module.get(ReturnEmailListener);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeReturn(overrides: Partial<ReturnRow> = {}): ReturnRow {
    return {
      id: 'ret-1',
      rtnNumber: 'RTN-260520-0001',
      customerShipsBack: true,
      rejectionReason: null,
      refundAmount: null,
      refundMethod: null,
      refundReference: null,
      guestEmail: null,
      guestName: null,
      user: {
        email: 'customer@example.com',
        firstName: 'Aysha',
        lastName: 'Khan',
      },
      ...overrides,
    };
  }

  describe('handleRequested', () => {
    it('fetches the return and dispatches a returnSubmitted email', async () => {
      const ret = makeReturn();
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleRequested({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      expect(prisma.return.findUnique).toHaveBeenCalledWith({
        where: { id: ret.id },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      });
      expect(email.send).toHaveBeenCalledTimes(1);
      const arg = email.send.mock.calls[0][0];
      expect(arg.to).toBe('customer@example.com');
      expect(arg.subject).toContain('Return request received');
      expect(arg.subject).toContain(ret.rtnNumber);
      expect(arg.text).toContain('48 hours');
      expect(arg.text).toContain(ret.rtnNumber);
      expect(arg.html).toContain(ret.rtnNumber);
    });

    it('routes to guestEmail when no user is linked', async () => {
      const ret = makeReturn({
        user: null,
        guestEmail: 'guest@example.com',
        guestName: 'Rahim',
      });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleRequested({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      expect(email.send).toHaveBeenCalledTimes(1);
      expect(email.send.mock.calls[0][0].to).toBe('guest@example.com');
    });
  });

  describe('handleApproved', () => {
    it('includes self-ship instructions when customerShipsBack is true', async () => {
      const ret = makeReturn({ customerShipsBack: true });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleApproved({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      expect(email.send).toHaveBeenCalledTimes(1);
      const arg = email.send.mock.calls[0][0];
      expect(arg.subject).toContain('Return approved');
      expect(arg.text).toContain('14 days');
      expect(arg.text).toContain('Denimisia Returns');
      expect(arg.text).not.toContain('arrange a pickup');
    });

    it('includes pickup language when customerShipsBack is false', async () => {
      const ret = makeReturn({ customerShipsBack: false });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleApproved({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      expect(email.send).toHaveBeenCalledTimes(1);
      const arg = email.send.mock.calls[0][0];
      expect(arg.text.toLowerCase()).toContain('pickup');
      expect(arg.text).not.toContain('14 days');
      expect(arg.text).not.toContain('Denimisia Returns\n');
    });
  });

  describe('handleRejected', () => {
    it('includes the rejection reason in the email', async () => {
      const ret = makeReturn({
        rejectionReason: 'Item shows clear signs of wear',
      });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleRejected({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      expect(email.send).toHaveBeenCalledTimes(1);
      const arg = email.send.mock.calls[0][0];
      expect(arg.subject).toContain('not approved');
      expect(arg.text).toContain('Item shows clear signs of wear');
      expect(arg.html).toContain('Item shows clear signs of wear');
    });

    it('falls back to "Not specified" when rejectionReason is null', async () => {
      const ret = makeReturn({ rejectionReason: null });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleRejected({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      const arg = email.send.mock.calls[0][0];
      expect(arg.text).toContain('Not specified');
    });
  });

  describe('handleReceived', () => {
    it('dispatches a returnReceived email with the RTN number', async () => {
      const ret = makeReturn();
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleReceived({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      expect(email.send).toHaveBeenCalledTimes(1);
      const arg = email.send.mock.calls[0][0];
      expect(arg.subject).toContain('We received your return');
      expect(arg.text).toContain('arrived');
    });
  });

  describe('handleRefunded', () => {
    it('includes amount, method, and reference in the email', async () => {
      const ret = makeReturn({
        refundAmount: 1580,
        refundMethod: 'BANK_TRANSFER',
        refundReference: 'TXN-9988',
      });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleRefunded({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      expect(email.send).toHaveBeenCalledTimes(1);
      const arg = email.send.mock.calls[0][0];
      expect(arg.subject).toContain('Refund issued');
      expect(arg.text).toContain('Bank Transfer');
      expect(arg.text).toContain('TXN-9988');
      expect(arg.text).toContain('1,580');
    });

    it('renders CASH method as "Cash"', async () => {
      const ret = makeReturn({
        refundAmount: 500,
        refundMethod: 'CASH',
        refundReference: 'WALK-IN-1',
      });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleRefunded({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      const arg = email.send.mock.calls[0][0];
      expect(arg.text).toContain('Cash');
      expect(arg.text).not.toContain('Bank Transfer');
    });

    it('falls back to event payload amount and method when DB fields are null', async () => {
      const ret = makeReturn({
        refundAmount: null,
        refundMethod: null,
        refundReference: null,
      });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleRefunded({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
        amount: 750,
        method: 'BANK_TRANSFER',
      });

      const arg = email.send.mock.calls[0][0];
      expect(arg.text).toContain('750');
      expect(arg.text).toContain('Bank Transfer');
    });
  });

  describe('early-return paths', () => {
    it('skips silently when the return does not exist', async () => {
      prisma.return.findUnique.mockResolvedValue(null);

      await listener.handleRequested({
        returnId: 'missing-id',
        rtnNumber: 'RTN-NONE',
      });

      expect(email.send).not.toHaveBeenCalled();
    });

    it('skips silently when there is no user email and no guest email', async () => {
      const ret = makeReturn({
        user: null,
        guestEmail: null,
        guestName: null,
      });
      prisma.return.findUnique.mockResolvedValue(ret);

      await listener.handleApproved({
        returnId: ret.id,
        rtnNumber: ret.rtnNumber,
      });

      expect(email.send).not.toHaveBeenCalled();
    });
  });

  describe('error swallowing', () => {
    it('handleRequested catches send failures so the event chain continues', async () => {
      prisma.return.findUnique.mockResolvedValue(makeReturn());
      email.send.mockRejectedValueOnce(new Error('Resend down'));

      await expect(
        listener.handleRequested({
          returnId: 'ret-1',
          rtnNumber: 'RTN-260520-0001',
        }),
      ).resolves.toBeUndefined();
    });

    it('handleApproved catches send failures', async () => {
      prisma.return.findUnique.mockResolvedValue(makeReturn());
      email.send.mockRejectedValueOnce(new Error('boom'));

      await expect(
        listener.handleApproved({
          returnId: 'ret-1',
          rtnNumber: 'RTN-260520-0001',
        }),
      ).resolves.toBeUndefined();
    });

    it('handleRejected catches send failures', async () => {
      prisma.return.findUnique.mockResolvedValue(makeReturn());
      email.send.mockRejectedValueOnce(new Error('boom'));

      await expect(
        listener.handleRejected({
          returnId: 'ret-1',
          rtnNumber: 'RTN-260520-0001',
        }),
      ).resolves.toBeUndefined();
    });

    it('handleReceived catches send failures', async () => {
      prisma.return.findUnique.mockResolvedValue(makeReturn());
      email.send.mockRejectedValueOnce(new Error('boom'));

      await expect(
        listener.handleReceived({
          returnId: 'ret-1',
          rtnNumber: 'RTN-260520-0001',
        }),
      ).resolves.toBeUndefined();
    });

    it('handleRefunded catches send failures', async () => {
      prisma.return.findUnique.mockResolvedValue(
        makeReturn({
          refundAmount: 100,
          refundMethod: 'CASH',
          refundReference: 'X',
        }),
      );
      email.send.mockRejectedValueOnce(new Error('boom'));

      await expect(
        listener.handleRefunded({
          returnId: 'ret-1',
          rtnNumber: 'RTN-260520-0001',
        }),
      ).resolves.toBeUndefined();
    });

    it('handleRequested also catches DB failures', async () => {
      prisma.return.findUnique.mockRejectedValueOnce(new Error('db down'));

      await expect(
        listener.handleRequested({
          returnId: 'ret-1',
          rtnNumber: 'RTN-260520-0001',
        }),
      ).resolves.toBeUndefined();
      expect(email.send).not.toHaveBeenCalled();
    });
  });
});
