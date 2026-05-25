import { QuotaGuard } from './quota.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('QuotaGuard', () => {
  const prismaMock = {
    botLlmQuota: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    (prismaMock.botLlmQuota.upsert as jest.Mock).mockReset();
    (prismaMock.botLlmQuota.findUnique as jest.Mock).mockReset();
    process.env.BOT_LLM_DAILY_NEURON_CAP = '8000';
  });

  it('allows when under cap', async () => {
    (prismaMock.botLlmQuota.findUnique as jest.Mock).mockResolvedValue({
      date: todayUTC(),
      neuronsUsed: 1000,
      callCount: 10,
    });
    const guard = new QuotaGuard(prismaMock);
    expect(await guard.check()).toBe(true);
  });

  it('denies when at cap', async () => {
    (prismaMock.botLlmQuota.findUnique as jest.Mock).mockResolvedValue({
      date: todayUTC(),
      neuronsUsed: 8000,
      callCount: 999,
    });
    const guard = new QuotaGuard(prismaMock);
    expect(await guard.check()).toBe(false);
  });

  it('increments via upsert', async () => {
    const guard = new QuotaGuard(prismaMock);
    await guard.recordUsage(50);
    expect(prismaMock.botLlmQuota.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: todayUTC() },
        create: expect.objectContaining({ neuronsUsed: 50, callCount: 1 }),
        update: expect.objectContaining({
          neuronsUsed: { increment: 50 },
          callCount: { increment: 1 },
        }),
      }),
    );
  });
});

function todayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
