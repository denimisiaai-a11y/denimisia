import { InternalServerErrorException } from '@nestjs/common';
import { RtnIdService } from './rtn-id.service';

describe('RtnIdService', () => {
  let prisma: { return: { findFirst: jest.Mock } };
  let service: RtnIdService;

  beforeEach(() => {
    prisma = { return: { findFirst: jest.fn() } };
    service = new RtnIdService(prisma as never);
  });

  it('returns RTN-{year}-000001 when no prior return exists for the year', async () => {
    prisma.return.findFirst.mockResolvedValue(null);
    await expect(service.generate(2026)).resolves.toBe('RTN-2026-000001');
    expect(prisma.return.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rtnNumber: { startsWith: 'RTN-2026-' } },
      }),
    );
  });

  it('increments by 1 and pads to 6 digits', async () => {
    prisma.return.findFirst.mockResolvedValue({ rtnNumber: 'RTN-2026-000042' });
    await expect(service.generate(2026)).resolves.toBe('RTN-2026-000043');
  });

  it('handles wrap from 999999 -> 1000000 without truncation', async () => {
    prisma.return.findFirst.mockResolvedValue({ rtnNumber: 'RTN-2026-999999' });
    await expect(service.generate(2026)).resolves.toBe('RTN-2026-1000000');
  });

  it('throws InternalServerErrorException when DB returns malformed rtnNumber', async () => {
    prisma.return.findFirst.mockResolvedValue({ rtnNumber: 'RTN-2026-XXXXXX' });
    await expect(service.generate(2026)).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(service.generate(2026)).rejects.toThrow(/Malformed rtnNumber/);
  });

  it('defaults to current UTC year when no argument is provided', async () => {
    prisma.return.findFirst.mockResolvedValue(null);
    const year = new Date().getUTCFullYear();
    const result = await service.generate();
    expect(result).toBe(`RTN-${year}-000001`);
  });

  it('scopes search by year prefix', async () => {
    prisma.return.findFirst.mockResolvedValue(null);
    await service.generate(2027);
    expect(prisma.return.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rtnNumber: { startsWith: 'RTN-2027-' } },
      }),
    );
  });
});
