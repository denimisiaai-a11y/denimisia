import { Injectable } from '@nestjs/common';
import { ReturnReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardData {
  rangeDays: number;
  returnsCount: number;
  ordersCount: number;
  returnRate: number;
  topReasons: { reason: ReturnReason; count: number }[];
  pendingRefundValue: number;
  averageResolutionHours: number | null;
}

@Injectable()
export class ReturnsMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(rangeDays = 30): Promise<DashboardData> {
    const safeRange = Math.max(1, Math.min(rangeDays, 365));
    const since = new Date(Date.now() - safeRange * 24 * 60 * 60 * 1000);

    const [returnsCount, ordersCount, byReason, openValueAgg, resolution] =
      await Promise.all([
        this.prisma.return.count({
          where: { requestedAt: { gte: since } },
        }),
        this.prisma.order.count({
          where: { status: 'DELIVERED', updatedAt: { gte: since } },
        }),
        this.prisma.return.groupBy({
          by: ['reason'],
          where: { requestedAt: { gte: since } },
          _count: { _all: true },
        }),
        this.prisma.return.aggregate({
          where: {
            status: {
              notIn: [
                'REFUNDED',
                'CLOSED',
                'REJECTED',
                'CANCELLED',
                'RETURNED_TO_CUSTOMER',
              ],
            },
          },
          _sum: { refundAmount: true },
        }),
        this.prisma.$queryRaw<{ avg_hours: number | null }[]>`
          SELECT AVG(EXTRACT(EPOCH FROM ("closedAt" - "requestedAt")) / 3600)::float AS avg_hours
          FROM "Return"
          WHERE "closedAt" IS NOT NULL AND "requestedAt" >= ${since}
        `,
      ]);

    const returnRate = ordersCount > 0 ? returnsCount / ordersCount : 0;
    return {
      rangeDays: safeRange,
      returnsCount,
      ordersCount,
      returnRate,
      topReasons: byReason
        .sort((a, b) => b._count._all - a._count._all)
        .map((r) => ({ reason: r.reason, count: r._count._all })),
      pendingRefundValue: Number(openValueAgg._sum.refundAmount ?? 0),
      averageResolutionHours: resolution[0]?.avg_hours ?? null,
    };
  }
}
