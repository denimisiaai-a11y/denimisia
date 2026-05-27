import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { OrderStatus } from '@prisma/client';

// JwtAuthGuard is applied per-endpoint below. The POST endpoint uses
// OptionalJwtAuthGuard so guest checkout (LR-001 Phase 1 slice B) works
// without auth; the service layer enforces "must be either logged-in or
// supply guestEmail+guestName+guestPhone" and the DB enforces the same
// invariant via CHECK Order_owner_check.
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  createOrder(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(user?.id ?? null, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
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

  // Unauthenticated lookup for guest order tracking. Requires BOTH the
  // order id and the email on the order to match — otherwise the same
  // 404 fires whether the order does not exist or the email is wrong.
  // This prevents enumeration by id alone. Global ThrottlerGuard already
  // caps the per-IP request rate.
  @Get('lookup')
  lookupOrder(@Query('id') id?: string, @Query('email') email?: string) {
    const cleanId = (id ?? '').trim();
    const cleanEmail = (email ?? '').trim();
    if (!cleanId || !cleanEmail) {
      throw new BadRequestException('id and email are required');
    }
    return this.ordersService.lookupForGuest(cleanId, cleanEmail);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOrder(@CurrentUser() user: any, @Param('id') id: string) {
    // Admins (ADMIN / SUPER_ADMIN) must be able to open any order from
    // the admin panel — including guest orders where order.userId is
    // null. Without the isAdmin flag, the service's row-owner check
    // rejects every admin view of a guest order with Forbidden.
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    return this.ordersService.getOrderById(user.id, id, isAdmin);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  cancelOrder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.cancelOrder(user.id, id);
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
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

  // Admin-only CSV bulk import of historical orders from the previous
  // e-commerce site. Multipart 'file' field, 20 MB cap. Returns counts
  // + downloadable error / placeholder reports per spec §5. See the
  // OrdersService.bulkImportHistory method for the parse + transactional
  // import flow.
  @Post('admin/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  importOrderHistory(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() admin: { id: string },
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'No file uploaded; expected multipart field "file"',
      );
    }
    return this.ordersService.bulkImportHistory(file.buffer, admin.id);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  updateOrderStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    // actorId comes from the authenticated admin user — never trust dto.changedBy.
    return this.ordersService.updateOrderStatus(id, dto, user.id);
  }

  @Get(':id/status-history')
  @UseGuards(JwtAuthGuard)
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
