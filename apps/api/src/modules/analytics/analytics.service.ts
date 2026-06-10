import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';

interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

const COMPLETED_STATUSES: OrderStatus[] = [OrderStatus.DELIVERED];
const PROCESSING_STATUSES: OrderStatus[] = [
  OrderStatus.PROCESSING,
  OrderStatus.CONFIRMED,
  OrderStatus.SHIPPED,
];
const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

function resolveRange(from?: string, to?: string): DateRange {
  const to_ = to ? new Date(to) : new Date();
  const from_ = from
    ? new Date(from)
    : new Date(to_.getFullYear(), to_.getMonth() - 1, to_.getDate());
  return { from: from_, to: to_ };
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Shared filters: soft-deleted rows skew the dashboard.
    const orderActive = {
      status: { not: OrderStatus.CANCELLED },
      deletedAt: null,
    };
    const customerActive = { role: 'CUSTOMER' as const, deletedAt: null };

    const [
      totalOrders,
      monthOrders,
      lastMonthOrders,
      totalRevenue,
      monthRevenue,
      totalCustomers,
      newCustomers,
      totalProducts,
      lowStockCount,
    ] = await Promise.all([
      this.prisma.order.count({ where: orderActive }),
      this.prisma.order.count({
        where: { ...orderActive, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.order.count({
        where: {
          ...orderActive,
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: orderActive,
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { ...orderActive, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.user.count({ where: customerActive }),
      this.prisma.user.count({
        where: { ...customerActive, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.product.count({
        where: { isActive: true, deletedAt: null },
      }),
      this.prisma.productVariant.count({
        where: {
          stock: { lte: 5 },
          deletedAt: null,
          product: { isActive: true, deletedAt: null },
        },
      }),
    ]);

    return {
      orders: {
        total: totalOrders,
        thisMonth: monthOrders,
        lastMonth: lastMonthOrders,
        growth:
          lastMonthOrders > 0
            ? (
                ((monthOrders - lastMonthOrders) / lastMonthOrders) *
                100
              ).toFixed(1)
            : null,
      },
      revenue: {
        total: Number(totalRevenue._sum.total ?? 0),
        thisMonth: Number(monthRevenue._sum.total ?? 0),
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomers,
      },
      products: {
        total: totalProducts,
        lowStock: lowStockCount,
      },
    };
  }

  async getDashboardOverview(from?: string, to?: string) {
    const range = resolveRange(from, to);
    const whereRange: Prisma.OrderWhereInput = {
      createdAt: { gte: range.from, lte: range.to },
      deletedAt: null,
    };

    const [
      totalOrders,
      completedOrders,
      processingOrders,
      cancelledOrders,
      refundedOrders,
      otherOrders,
      salesAgg,
      totalCustomers,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { ...whereRange, status: { not: OrderStatus.CANCELLED } },
      }),
      this.prisma.order.count({
        where: { ...whereRange, status: { in: COMPLETED_STATUSES } },
      }),
      this.prisma.order.count({
        where: { ...whereRange, status: { in: PROCESSING_STATUSES } },
      }),
      this.prisma.order.count({
        where: { ...whereRange, status: OrderStatus.CANCELLED },
      }),
      this.prisma.order.count({
        where: { ...whereRange, status: OrderStatus.REFUNDED },
      }),
      this.prisma.order.count({
        where: {
          ...whereRange,
          status: {
            in: [
              OrderStatus.PENDING,
              OrderStatus.PAYMENT_FAILED,
              OrderStatus.RETURNED,
            ],
          },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        _count: { id: true },
        where: { ...whereRange, status: { in: ACTIVE_STATUSES } },
      }),
      this.prisma.user.count({
        where: { role: 'CUSTOMER', deletedAt: null },
      }),
    ]);

    const totalSales = Number(salesAgg._sum.total ?? 0);
    const salesOrderCount = salesAgg._count.id ?? 0;

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      orders: {
        total: totalOrders,
        completed: completedOrders,
        processing: processingOrders,
        cancelled: cancelledOrders,
        refunded: refundedOrders,
        other: otherOrders,
      },
      sales: {
        total: totalSales,
        average: salesOrderCount > 0 ? totalSales / salesOrderCount : 0,
      },
      customers: {
        total: totalCustomers,
        online: 0, // placeholder — session/presence tracking not yet wired
      },
    };
  }

  async getSalesSeries(from?: string, to?: string) {
    const range = resolveRange(from, to);

    const [orders, customers] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          status: { in: ACTIVE_STATUSES },
        },
        select: { createdAt: true, total: true, userId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.findMany({
        where: {
          role: 'CUSTOMER',
          createdAt: { gte: range.from, lte: range.to },
        },
        select: { createdAt: true },
      }),
    ]);

    const series: Record<
      string,
      { date: string; orders: number; customers: number; revenue: number }
    > = {};

    const pad = (n: number) => String(n).padStart(2, '0');
    const toKey = (d: Date) =>
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

    // Fill every day in range so charts don't skip gaps.
    const cursor = new Date(range.from);
    while (cursor <= range.to) {
      const key = toKey(cursor);
      series[key] = { date: key, orders: 0, customers: 0, revenue: 0 };
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const o of orders) {
      const key = toKey(o.createdAt);
      if (!series[key]) {
        series[key] = { date: key, orders: 0, customers: 0, revenue: 0 };
      }
      series[key].orders += 1;
      series[key].revenue += Number(o.total);
    }
    for (const c of customers) {
      const key = toKey(c.createdAt);
      if (!series[key]) {
        series[key] = { date: key, orders: 0, customers: 0, revenue: 0 };
      }
      series[key].customers += 1;
    }

    return Object.values(series).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getRevenueByDay(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, number> = {};
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      grouped[dateKey] = (grouped[dateKey] ?? 0) + Number(order.total);
    }

    return Object.entries(grouped).map(([date, revenue]) => ({
      date,
      revenue,
    }));
  }

  async getTopProducts(limit = 10, from?: string, to?: string) {
    const range = from || to ? resolveRange(from, to) : null;

    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
      where: {
        // Exclude bundle lines (productId is nullable post-LR-001 Slice 4).
        // Bundle aggregation requires a separate report keyed by bundleId.
        productId: { not: null },
        ...(range
          ? { order: { createdAt: { gte: range.from, lte: range.to } } }
          : {}),
      },
    });

    const productIds = items
      .map((i) => i.productId)
      .filter((id): id is string => id !== null);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, slug: true, images: true },
    });

    return items.map((item) => ({
      product: products.find((p) => p.id === item.productId),
      totalSold: item._sum.quantity ?? 0,
      totalRevenue: Number(item._sum.total ?? 0),
    }));
  }

  async getTopCategories(limit = 5, from?: string, to?: string) {
    const range = from || to ? resolveRange(from, to) : null;

    const items = await this.prisma.orderItem.findMany({
      where: range
        ? { order: { createdAt: { gte: range.from, lte: range.to } } }
        : undefined,
      select: {
        quantity: true,
        total: true,
        product: {
          select: {
            id: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const byCategory: Record<
      string,
      {
        id: string;
        name: string;
        slug: string;
        productIds: Set<string>;
        sales: number;
        revenue: number;
      }
    > = {};
    for (const item of items) {
      // Bundle lines have item.product === null. Top-categories aggregation
      // skips them; a separate bundle-categories report would belong in its
      // own method.
      if (!item.product) continue;
      const cat = item.product.category;
      if (!cat) continue;
      if (!byCategory[cat.id]) {
        byCategory[cat.id] = {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          productIds: new Set(),
          sales: 0,
          revenue: 0,
        };
      }
      byCategory[cat.id].productIds.add(item.product.id);
      byCategory[cat.id].sales += item.quantity;
      byCategory[cat.id].revenue += Number(item.total);
    }

    return Object.values(byCategory)
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c.productIds.size,
        totalSales: c.sales,
        totalRevenue: c.revenue,
      }))
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, limit);
  }

  async getTopCustomers(limit = 5, from?: string, to?: string) {
    const range = from || to ? resolveRange(from, to) : null;

    const grouped = await this.prisma.order.groupBy({
      by: ['userId'],
      _sum: { total: true },
      _count: { id: true },
      where: {
        status: { in: ACTIVE_STATUSES },
        ...(range ? { createdAt: { gte: range.from, lte: range.to } } : {}),
      },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    // Guest orders carry userId = NULL and are excluded from the
    // "top customers" leaderboard by design — there's no User row to point
    // at, and an unverified guest email is not a stable customer identity.
    // Phase 1 amendment C2's verified-email-attach flow folds those orders
    // into the new account, at which point they start counting toward this
    // metric. Filter nulls before the user lookup to keep the type tight.
    const userIds = grouped
      .map((g) => g.userId)
      .filter((id): id is string => id !== null);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    return grouped
      .filter((g): g is typeof g & { userId: string } => g.userId !== null)
      .map((g) => {
        const u = users.find((x) => x.id === g.userId);
        return {
          user: u
            ? {
                id: u.id,
                name: `${u.firstName} ${u.lastName}`.trim(),
                email: u.email,
              }
            : null,
          orderCount: g._count.id ?? 0,
          totalRevenue: Number(g._sum.total ?? 0),
        };
      });
  }

  async getLowStock(limit = 10, threshold = 5) {
    const variants = await this.prisma.productVariant.findMany({
      where: { stock: { lte: threshold }, product: { isActive: true } },
      orderBy: { stock: 'asc' },
      take: limit,
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        stock: true,
        images: true,
        product: {
          select: { id: true, name: true, slug: true, images: true },
        },
      },
    });

    return variants.map((v) => ({
      variantId: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock: v.stock,
      image: v.images[0] ?? v.product.images[0] ?? null,
      product: v.product,
    }));
  }

  async getLatestOrders(limit = 10) {
    const orders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        // user row is null for guest checkout orders; guestName + guestEmail
        // carry the customer contact in that case.
        user: { select: { firstName: true, lastName: true, email: true } },
        guestName: true,
        guestEmail: true,
      },
    });

    return orders.map((o) => {
      const isGuest = !o.user;
      const customer = isGuest
        ? (o.guestName ?? 'Guest')
        : `${o.user!.firstName} ${o.user!.lastName}`.trim();
      const email = isGuest ? (o.guestEmail ?? '') : o.user!.email;
      return {
        id: o.id,
        status: o.status,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
        customer,
        email,
        isGuest,
      };
    });
  }

  async getOrdersByStatus() {
    const counts = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    return counts.map((c) => ({ status: c.status, count: c._count.id }));
  }
}
