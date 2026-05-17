import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { OrderStatus } from '@prisma/client';
import {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderCancelledEvent,
} from '../../common/events/order.events';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // userId is `string | null`. When null, the caller is anonymous and the
  // dto MUST carry the full guest tuple (email + name + phone). The DB-
  // level CHECK Order_owner_check is the last line of defense; this guard
  // produces the user-facing 400 first so attackers can't probe schema by
  // triggering opaque DB errors.
  async createOrder(userId: string | null, dto: CreateOrderDto) {
    const isGuest = userId === null;
    if (isGuest) {
      const { guestEmail, guestName, guestPhone } = dto;
      if (!guestEmail || !guestName || !guestPhone) {
        throw new BadRequestException(
          'Guest checkout requires guestEmail + guestName + guestPhone',
        );
      }
    }

    // Validate all variants and check stock
    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: { select: { id: true, name: true, images: true, slug: true } },
      },
    });

    if (variants.length !== dto.items.length) {
      throw new NotFoundException('One or more variants not found');
    }

    // Check stock and validate productId matches variant for each item
    for (const item of dto.items) {
      const variant = variants.find((v) => v.id === item.variantId);
      if (!variant)
        throw new NotFoundException(`Variant ${item.variantId} not found`);
      if (variant.product.id !== item.productId) {
        throw new BadRequestException(
          `Product ID mismatch: variant ${item.variantId} belongs to product ${variant.product.id}, not ${item.productId}`,
        );
      }
      if (variant.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${variant.product.name} (${variant.size}/${variant.color})`,
        );
      }
    }

    // Calculate subtotal
    let subtotal = 0;
    const orderItemsData = dto.items.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId)!;
      const unitPrice = Number(variant.price);
      const total = unitPrice * item.quantity;
      subtotal += total;
      return {
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice,
        total,
        snapshot: {
          name: variant.product.name,
          size: variant.size,
          color: variant.color,
          image: variant.product.images[0] ?? null,
        },
      };
    });

    // Resolve discount
    let discountAmount = 0;
    let discountId: string | undefined;
    if (dto.discountCode) {
      const discount = await this.prisma.discount.findUnique({
        where: { code: dto.discountCode.toUpperCase() },
      });
      if (!discount || !discount.isActive) {
        throw new BadRequestException('Invalid or inactive discount code');
      }
      const now = new Date();
      if (discount.startDate && discount.startDate > now) {
        throw new BadRequestException('Discount code is not yet active');
      }
      if (discount.endDate && discount.endDate < now) {
        throw new BadRequestException('Discount code has expired');
      }
      if (discount.maxUses && discount.usedCount >= discount.maxUses) {
        throw new BadRequestException('Discount code usage limit reached');
      }
      if (
        discount.minOrderAmount &&
        subtotal < Number(discount.minOrderAmount)
      ) {
        throw new BadRequestException(
          `Minimum order amount is ${discount.minOrderAmount} for this discount`,
        );
      }
      discountId = discount.id;
      discountAmount =
        discount.type === 'PERCENTAGE'
          ? subtotal * (Number(discount.value) / 100)
          : discount.type === 'FIXED_AMOUNT'
            ? Number(discount.value)
            : 0; // FREE_SHIPPING handled at shipping level
    }

    // Calculate shipping cost — ৳80 Dhaka, ৳120 outside Dhaka, free over ৳1500
    let shippingCost = 80; // default Dhaka rate
    const shippingAddress = dto.shippingAddress;
    const city = ((shippingAddress?.city as string) ?? '').toLowerCase();
    if (city && city !== 'dhaka') {
      shippingCost = 120;
    }
    if (subtotal - discountAmount >= 1500) {
      shippingCost = 0; // free shipping over ৳1500
    }
    // FREE_SHIPPING discount type
    if (dto.discountCode) {
      const disc = await this.prisma.discount.findUnique({
        where: { code: dto.discountCode.toUpperCase() },
      });
      if (disc?.type === 'FREE_SHIPPING') shippingCost = 0;
    }

    const total = Math.max(0, subtotal - discountAmount + shippingCost);

    // Create order + items + deduct stock in a transaction with row-level locking
    const order = await this.prisma.$transaction(async (tx) => {
      // Lock variant rows to prevent overselling under concurrent orders
      for (const item of dto.items) {
        const [locked] = await tx.$queryRawUnsafe<{ stock: number }[]>(
          `SELECT stock FROM "ProductVariant" WHERE id = $1 FOR UPDATE`,
          item.variantId,
        );
        if (!locked || locked.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for variant ${item.variantId} (available: ${locked?.stock ?? 0}, requested: ${item.quantity})`,
          );
        }
      }

      const created = await tx.order.create({
        data: {
          // Logged-in: write userId, leave guest tuple null. Anonymous:
          // write the guest tuple, leave userId null. The DB CHECK
          // constraint rejects "neither"; the service guard above rejects
          // it with a friendlier 400 first.
          userId,
          guestEmail: userId ? null : dto.guestEmail,
          guestName: userId ? null : dto.guestName,
          guestPhone: userId ? null : dto.guestPhone,
          shippingAddress: dto.shippingAddress as any,
          billingAddress: dto.billingAddress as any,
          subtotal,
          discount: discountAmount,
          shippingCost,
          total,
          notes: dto.notes,
          discountId,
          items: { create: orderItemsData },
        },
        include: { items: true },
      });

      // Deduct stock and log inventory
      for (const item of dto.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            type: 'SALE',
            quantity: -item.quantity,
            note: `Order ${created.id}`,
          },
        });
      }

      // Increment discount used count (atomic guard against race condition)
      if (discountId) {
        const discount = await tx.discount.findUnique({
          where: { id: discountId },
        });
        if (discount?.maxUses && discount.usedCount >= discount.maxUses) {
          throw new BadRequestException('Discount is no longer available');
        }
        await tx.discount.update({
          where: { id: discountId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return created;
    });

    // Clear cart after successful checkout. Guests have no Cart row (cart
    // is keyed by userId), so this only runs for authenticated customers.
    if (userId) {
      const cart = await this.prisma.cart.findUnique({ where: { userId } });
      if (cart) {
        await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
    }

    this.eventEmitter.emit(
      'order.created',
      new OrderCreatedEvent(order.id, userId, total),
    );

    return order;
  }

  async getMyOrders(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: { select: { name: true, slug: true, images: true } },
              variant: { select: { size: true, color: true } },
            },
          },
        },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { orders, total, page, limit };
  }

  async getOrderById(userId: string, orderId: string, isAdmin = false) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        items: {
          include: {
            product: { select: { name: true, slug: true, images: true } },
            variant: { select: { size: true, color: true } },
          },
        },
        discountRel: { select: { code: true, type: true, value: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (!isAdmin && order.userId !== userId)
      throw new ForbiddenException('Access denied');
    return order;
  }

  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Access denied');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only PENDING orders can be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // Restore stock
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            type: 'RETURN',
            quantity: item.quantity,
            note: `Cancelled order ${orderId}`,
          },
        });
      }
    });

    this.eventEmitter.emit(
      'order.cancelled',
      new OrderCancelledEvent(
        orderId,
        userId,
        order.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      ),
    );

    return { message: 'Order cancelled successfully' };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  async getAllOrders(page = 1, limit = 20, status?: OrderStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          items: { select: { quantity: true, total: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, total, page, limit };
  }

  // ─── Order State Machine ───────────────────────────────────────────────────

  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'RETURNED'],
    DELIVERED: ['RETURNED'],
    CANCELLED: [],
    RETURNED: ['REFUNDED'],
    REFUNDED: [],
    PAYMENT_FAILED: ['PENDING', 'CANCELLED'],
  };

  /**
   * States where inventory has been RETURNED to stock. Moving the order
   * INTO one of these restores items; moving FROM them never re-restores.
   * Used to keep stock decrement idempotent across the full status lifecycle.
   */
  private static readonly STOCK_RETURNED_STATES = new Set<OrderStatus>([
    OrderStatus.CANCELLED,
    OrderStatus.RETURNED,
    OrderStatus.REFUNDED,
    OrderStatus.PAYMENT_FAILED,
  ]);

  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    actorId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const validStatuses = Object.values(OrderStatus);
    if (!validStatuses.includes(dto.status as OrderStatus)) {
      throw new BadRequestException(`Invalid status: ${dto.status}`);
    }

    const allowed = OrdersService.VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }

    const fromStatus = order.status;
    const newStatus = dto.status as OrderStatus;

    // Stock restoration — only when crossing the boundary from "stock is
    // deducted" to "stock is returned". Idempotent: if we were already in
    // a RETURNED_STATE (e.g. RETURNED → REFUNDED), we do not re-restore.
    const wasReturned = OrdersService.STOCK_RETURNED_STATES.has(fromStatus);
    const nowReturned = OrdersService.STOCK_RETURNED_STATES.has(newStatus);
    const shouldRestoreStock = !wasReturned && nowReturned;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus,
          toStatus: newStatus,
          changedBy: actorId,
          note: dto.note,
        },
      });

      if (shouldRestoreStock) {
        for (const item of order.items) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
          await tx.inventoryLog.create({
            data: {
              variantId: item.variantId,
              type: 'RETURN',
              quantity: item.quantity,
              note: `Order ${orderId} → ${newStatus}`,
            },
          });
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...(dto.trackingNumber ? { trackingNumber: dto.trackingNumber } : {}),
        },
      });
    });

    this.eventEmitter.emit(
      'order.status_changed',
      new OrderStatusChangedEvent(orderId, fromStatus, newStatus, actorId),
    );

    return updated;
  }

  async getStatusHistory(
    orderId: string,
    requester: { id: string; role: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    // IDOR protection: customers may only read their own order's history.
    // Treat non-owned access as 404 to avoid leaking order existence.
    if (requester.role === 'CUSTOMER' && order.userId !== requester.id) {
      throw new NotFoundException('Order not found');
    }

    return this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
