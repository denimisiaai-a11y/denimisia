import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      order: {
        count: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
      product: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      productVariant: {
        count: jest.fn(),
      },
      orderItem: {
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  it('should get dashboard stats', async () => {
    prisma.order.count.mockResolvedValue(10);
    prisma.order.aggregate.mockResolvedValue({ _sum: { total: 5000 } });
    prisma.user.count.mockResolvedValue(5);
    prisma.product.count.mockResolvedValue(20);
    prisma.productVariant.count.mockResolvedValue(2);

    const result = await service.getDashboardStats();

    expect(result.orders.total).toBe(10);
    expect(result.revenue.total).toBe(5000);
    expect(result.customers.total).toBe(5);
    expect(result.products.total).toBe(20);
    expect(result.products.lowStock).toBe(2);
  });

  it('should calculate growth when last month has orders', async () => {
    prisma.order.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(4);
    prisma.order.aggregate.mockResolvedValue({ _sum: { total: 1000 } });
    prisma.user.count.mockResolvedValue(1);
    prisma.product.count.mockResolvedValue(1);
    prisma.productVariant.count.mockResolvedValue(0);

    const result = await service.getDashboardStats();
    expect(result.orders.growth).toBe('50.0');
  });

  it('should return null growth when last month has no orders', async () => {
    prisma.order.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(0);
    prisma.order.aggregate.mockResolvedValue({ _sum: { total: 1000 } });
    prisma.user.count.mockResolvedValue(1);
    prisma.product.count.mockResolvedValue(1);
    prisma.productVariant.count.mockResolvedValue(0);

    const result = await service.getDashboardStats();
    expect(result.orders.growth).toBeNull();
  });

  it('should get revenue by day', async () => {
    const orders = [
      { createdAt: new Date('2025-01-01T10:00:00Z'), total: 100 },
      { createdAt: new Date('2025-01-01T12:00:00Z'), total: 200 },
      { createdAt: new Date('2025-01-02T10:00:00Z'), total: 150 },
    ];
    prisma.order.findMany.mockResolvedValue(orders);

    const result = await service.getRevenueByDay(30);
    expect(result).toContainEqual({ date: '2025-01-01', revenue: 300 });
    expect(result).toContainEqual({ date: '2025-01-02', revenue: 150 });
  });

  it('should get top products', async () => {
    prisma.orderItem.groupBy.mockResolvedValue([
      { productId: 'p-1', _sum: { quantity: 10, total: 1000 } },
    ]);
    prisma.product.findMany.mockResolvedValue([
      { id: 'p-1', name: 'Jeans', slug: 'jeans', images: [] },
    ]);

    const result = await service.getTopProducts(5);
    expect(result).toEqual([
      {
        product: { id: 'p-1', name: 'Jeans', slug: 'jeans', images: [] },
        totalSold: 10,
        totalRevenue: 1000,
      },
    ]);
  });

  it('should get orders by status', async () => {
    prisma.order.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { id: 3 } },
      { status: 'DELIVERED', _count: { id: 7 } },
    ]);

    const result = await service.getOrdersByStatus();
    expect(result).toEqual([
      { status: 'PENDING', count: 3 },
      { status: 'DELIVERED', count: 7 },
    ]);
  });
});
