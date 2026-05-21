import { ReturnsMetricsService } from './returns.metrics.service';

describe('ReturnsMetricsService', () => {
  let service: ReturnsMetricsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      return: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { refundAmount: null } }),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ avg_hours: null }]),
    };
    service = new ReturnsMetricsService(prisma);
  });

  it('returns zeros when no data', async () => {
    const result = await service.getDashboard(30);
    expect(result).toMatchObject({
      rangeDays: 30,
      returnsCount: 0,
      ordersCount: 0,
      returnRate: 0,
      topReasons: [],
      pendingRefundValue: 0,
      averageResolutionHours: null,
    });
  });

  it('computes returnRate when both counts present', async () => {
    prisma.return.count.mockResolvedValue(10);
    prisma.order.count.mockResolvedValue(100);
    const result = await service.getDashboard(30);
    expect(result.returnRate).toBe(0.1);
  });

  it('sorts topReasons by count desc', async () => {
    prisma.return.groupBy.mockResolvedValue([
      { reason: 'WRONG_SIZE', _count: { _all: 3 } },
      { reason: 'DEFECTIVE', _count: { _all: 7 } },
      { reason: 'CHANGED_MIND', _count: { _all: 5 } },
    ]);
    const result = await service.getDashboard(30);
    expect(result.topReasons.map((r) => r.reason)).toEqual([
      'DEFECTIVE',
      'CHANGED_MIND',
      'WRONG_SIZE',
    ]);
  });

  it('clamps rangeDays to [1, 365]', async () => {
    const r1 = await service.getDashboard(-5);
    expect(r1.rangeDays).toBe(1);
    const r2 = await service.getDashboard(999);
    expect(r2.rangeDays).toBe(365);
  });

  it('coerces Decimal refundAmount to number', async () => {
    prisma.return.aggregate.mockResolvedValue({
      _sum: {
        refundAmount: { toString: () => '1234.56', toFixed: () => '1234.56' },
      },
    });
    const result = await service.getDashboard(30);
    expect(result.pendingRefundValue).toBe(1234.56);
  });

  it('passes averageResolutionHours through', async () => {
    prisma.$queryRaw.mockResolvedValue([{ avg_hours: 12.5 }]);
    const result = await service.getDashboard(30);
    expect(result.averageResolutionHours).toBe(12.5);
  });
});
