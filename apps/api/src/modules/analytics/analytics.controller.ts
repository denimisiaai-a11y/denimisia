import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }

  @Get('dashboard/overview')
  getDashboardOverview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getDashboardOverview(from, to);
  }

  @Get('sales-series')
  getSalesSeries(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getSalesSeries(from, to);
  }

  @Get('revenue')
  getRevenueByDay(@Query('days') days?: string) {
    return this.analyticsService.getRevenueByDay(Number(days) || 30);
  }

  @Get('top-products')
  getTopProducts(
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getTopProducts(Number(limit) || 10, from, to);
  }

  @Get('top-categories')
  getTopCategories(
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getTopCategories(Number(limit) || 5, from, to);
  }

  @Get('top-customers')
  getTopCustomers(
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getTopCustomers(Number(limit) || 5, from, to);
  }

  @Get('low-stock')
  getLowStock(
    @Query('limit') limit?: string,
    @Query('threshold') threshold?: string,
  ) {
    return this.analyticsService.getLowStock(
      Number(limit) || 10,
      Number(threshold) || 5,
    );
  }

  @Get('latest-orders')
  getLatestOrders(@Query('limit') limit?: string) {
    return this.analyticsService.getLatestOrders(Number(limit) || 10);
  }

  @Get('orders-by-status')
  getOrdersByStatus() {
    return this.analyticsService.getOrdersByStatus();
  }
}
