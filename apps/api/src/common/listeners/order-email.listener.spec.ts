import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { OrderEmailListener } from './order-email.listener';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { EmailService } from '../../modules/email/email.service';
import { OrderCreatedEvent } from '../events/order.events';

interface OrderRow {
  id: string;
  orderNumber: string;
  userId: string | null;
  guestEmail: string | null;
  guestName: string | null;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  shippingAddress: unknown;
  createdAt: Date;
  items: Array<{
    quantity: number;
    total: number;
    snapshot: unknown;
  }>;
  user: { email: string; firstName: string } | null;
}

describe('OrderEmailListener', () => {
  let listener: OrderEmailListener;
  let prisma: { order: { findUnique: jest.Mock } };
  let email: { send: jest.Mock };

  beforeEach(async () => {
    prisma = { order: { findUnique: jest.fn() } };
    email = {
      send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderEmailListener,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    listener = module.get(OrderEmailListener);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeOrder(overrides: Partial<OrderRow> = {}): OrderRow {
    return {
      id: 'cabcdefghijklmnopqrstuvwx',
      orderNumber: 'DEN-000042',
      userId: 'user-1',
      guestEmail: null,
      guestName: null,
      subtotal: 1500,
      discount: 0,
      shippingCost: 80,
      total: 1580,
      shippingAddress: {
        line1: '123 Banani',
        city: 'Dhaka',
        phone: '+8801711111111',
      },
      createdAt: new Date('2026-05-18T00:00:00Z'),
      items: [
        {
          quantity: 1,
          total: 1500,
          snapshot: { name: 'Selvedge Tee', size: 'L', color: 'Black' },
        },
      ],
      user: { email: 'customer@example.com', firstName: 'Aysha' },
      ...overrides,
    };
  }

  it('sends an order confirmation email to the logged-in user', async () => {
    const order = makeOrder();
    prisma.order.findUnique.mockResolvedValue(order);

    await listener.handleOrderCreated(
      new OrderCreatedEvent(order.id, order.userId, order.total),
    );

    expect(email.send).toHaveBeenCalledTimes(1);
    const arg = email.send.mock.calls[0][0];
    expect(arg.to).toBe('customer@example.com');
    expect(arg.subject).toMatch(/Order .* confirmed/i);
    expect(arg.text).toContain('Selvedge Tee');
    expect(arg.text.toLowerCase()).toContain('cash on delivery');
    expect(arg.html).toContain('Selvedge Tee');
  });

  it('routes to guestEmail when the order has no logged-in user', async () => {
    const order = makeOrder({
      userId: null,
      user: null,
      guestEmail: 'guest@example.com',
      guestName: 'Rahim Khan',
    });
    prisma.order.findUnique.mockResolvedValue(order);

    await listener.handleOrderCreated(
      new OrderCreatedEvent(order.id, null, order.total),
    );

    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0][0].to).toBe('guest@example.com');
  });

  it('renders bundle line snapshots correctly', async () => {
    const order = makeOrder({
      items: [
        {
          quantity: 1,
          total: 1800,
          snapshot: {
            bundleSlug: 'spring-trio',
            bundleName: 'Spring Trio',
            bundleImage: null,
            bundleSize: 'L',
            bundlePrice: 1800,
            items: [],
          },
        },
      ],
    });
    prisma.order.findUnique.mockResolvedValue(order);

    await listener.handleOrderCreated(
      new OrderCreatedEvent(order.id, order.userId, order.total),
    );

    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0][0].text).toContain('Spring Trio');
    expect(email.send.mock.calls[0][0].text).toContain('size L');
  });

  it('skips silently when the order is not found (does not throw)', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(
      listener.handleOrderCreated(
        new OrderCreatedEvent('missing-id', 'user-1', 0),
      ),
    ).resolves.toBeUndefined();

    expect(email.send).not.toHaveBeenCalled();
  });

  it('skips silently when neither a user email nor a guest email is set', async () => {
    const order = makeOrder({ userId: null, user: null, guestEmail: null });
    prisma.order.findUnique.mockResolvedValue(order);

    await listener.handleOrderCreated(
      new OrderCreatedEvent(order.id, null, order.total),
    );

    expect(email.send).not.toHaveBeenCalled();
  });

  it('catches and logs send failures so the order is never rolled back', async () => {
    const order = makeOrder();
    prisma.order.findUnique.mockResolvedValue(order);
    email.send.mockRejectedValueOnce(new Error('Resend down'));

    await expect(
      listener.handleOrderCreated(
        new OrderCreatedEvent(order.id, order.userId, order.total),
      ),
    ).resolves.toBeUndefined();
  });
});
