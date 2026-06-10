import { InternalServerErrorException } from '@nestjs/common';
import { OrderNumberService } from './order-number.service';

describe('OrderNumberService', () => {
  let prisma: { order: { findFirst: jest.Mock } };
  let service: OrderNumberService;

  beforeEach(() => {
    prisma = { order: { findFirst: jest.fn() } };
    service = new OrderNumberService(prisma as never);
  });

  it('returns DEN-000001 when no prior order exists', async () => {
    prisma.order.findFirst.mockResolvedValue(null);
    await expect(service.generate()).resolves.toBe('DEN-000001');
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNumber: { startsWith: 'DEN-' } },
      }),
    );
  });

  it('increments by 1 and pads to 6 digits', async () => {
    prisma.order.findFirst.mockResolvedValue({ orderNumber: 'DEN-000042' });
    await expect(service.generate()).resolves.toBe('DEN-000043');
  });

  it('handles wrap from 999999 -> 1000000 without truncation', async () => {
    prisma.order.findFirst.mockResolvedValue({ orderNumber: 'DEN-999999' });
    await expect(service.generate()).resolves.toBe('DEN-1000000');
  });

  it('throws InternalServerErrorException when DB returns malformed orderNumber', async () => {
    prisma.order.findFirst.mockResolvedValue({ orderNumber: 'DEN-XXXXXX' });
    await expect(service.generate()).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(service.generate()).rejects.toThrow(/Malformed orderNumber/);
  });

  it('orders by orderNumber desc to pick the latest sequence', async () => {
    prisma.order.findFirst.mockResolvedValue({ orderNumber: 'DEN-000100' });
    await service.generate();
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { orderNumber: 'desc' },
      }),
    );
  });
});
