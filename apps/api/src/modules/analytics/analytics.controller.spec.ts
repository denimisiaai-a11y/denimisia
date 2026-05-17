import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    analyticsService = {
      getDashboardStats: jest.fn(),
      getDashboardOverview: jest.fn(),
      getSalesSeries: jest.fn(),
      getRevenueByDay: jest.fn(),
      getTopProducts: jest.fn(),
      getTopCategories: jest.fn(),
      getTopCustomers: jest.fn(),
      getLowStock: jest.fn(),
      getLatestOrders: jest.fn(),
      getOrdersByStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: analyticsService }],
    }).compile();

    controller = module.get(AnalyticsController);
  });

  it('forwards dashboard stats', async () => {
    analyticsService.getDashboardStats.mockResolvedValue({
      orders: { total: 10 },
    });
    await controller.getDashboardStats();
    expect(analyticsService.getDashboardStats).toHaveBeenCalled();
  });

  it('parses the days query as a number for revenue', async () => {
    analyticsService.getRevenueByDay.mockResolvedValue([]);
    await controller.getRevenueByDay('30');
    expect(analyticsService.getRevenueByDay).toHaveBeenCalledWith(30);
  });

  it('forwards top-products with parsed limit + optional date range', async () => {
    analyticsService.getTopProducts.mockResolvedValue([]);
    await controller.getTopProducts('10');
    expect(analyticsService.getTopProducts).toHaveBeenCalledWith(
      10,
      undefined,
      undefined,
    );
  });

  it('defaults the top-products limit to 10 when omitted', async () => {
    analyticsService.getTopProducts.mockResolvedValue([]);
    await controller.getTopProducts(undefined, '2026-01-01', '2026-02-01');
    expect(analyticsService.getTopProducts).toHaveBeenCalledWith(
      10,
      '2026-01-01',
      '2026-02-01',
    );
  });

  it('forwards orders-by-status without arguments', async () => {
    analyticsService.getOrdersByStatus.mockResolvedValue([]);
    await controller.getOrdersByStatus();
    expect(analyticsService.getOrdersByStatus).toHaveBeenCalled();
  });
});
