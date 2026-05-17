import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { OrderStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  createOrder(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.id, dto);
  }

  @Get()
  getMyOrders(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const safeLimit = Math.min(Number(limit) || 10, 100);
    return this.ordersService.getMyOrders(
      user.id,
      Number(page) || 1,
      safeLimit,
    );
  }

  @Get(':id')
  getOrder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.getOrderById(user.id, id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.cancelOrder(user.id, id);
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  getAllOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
  ) {
    const safeLimit = Math.min(Number(limit) || 20, 100);
    return this.ordersService.getAllOrders(
      Number(page) || 1,
      safeLimit,
      status,
    );
  }

  @Patch('admin/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  updateOrderStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    // actorId comes from the authenticated admin user — never trust dto.changedBy.
    return this.ordersService.updateOrderStatus(id, dto, user.id);
  }

  @Get(':id/status-history')
  async getStatusHistory(@CurrentUser() user: any, @Param('id') id: string) {
    // NOTE: role compared as raw string; Prisma Role enum can be imported
    // once Role is exported centrally (TODO).
    const history = await this.ordersService.getStatusHistory(id, {
      id: user.id,
      role: user.role,
    });
    return { success: true, data: history };
  }
}
