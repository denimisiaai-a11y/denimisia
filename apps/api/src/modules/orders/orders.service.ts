import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Role } from '@prisma/client';
import {
  normalizeAndValidate,
  prependPhoneToArray,
} from '../../common/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  OrderItemDto,
} from './orders.dto';
import { OrderStatus } from '@prisma/client';
import {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderCancelledEvent,
} from '../../common/events/order.events';
import { OrderNumberService } from './order-number.service';
import { parseOrderHistoryCsv } from './orders-import.parser';
import { fetchActiveCampaignPrices } from '../campaigns/campaign-pricing';

const ORDER_CREATE_MAX_RETRIES = 3;

// Snapshot Json shape written for a bundle order line. The constituent
// variantId is captured at order time so cancel-restore + audit can walk
// the snapshot without re-reading the bundle (which the admin may edit or
// deactivate between purchase and refund).
interface BundleSnapshotItem {
  productId: string;
  variantId: string;
  productName: string;
  color: string;
  size: string;
  image: string | null;
}

interface BundleSnapshot {
  bundleSlug: string;
  bundleName: string;
  bundleImage: string | null;
  bundleSize: string;
  bundlePrice: number;
  items: BundleSnapshotItem[];
}

interface VariantLineResolved {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  // Set when a campaign discount was applied to this line. Used
  // post-order-creation to record a CampaignUsage row per (campaign,
  // order) pair so attribution reports stay accurate.
  campaignId?: string;
  variant: {
    size: string;
    color: string;
    product: { id: string; name: string; images: string[]; slug: string };
  };
}

interface BundleLineResolved {
  bundleId: string;
  bundleSize: string;
  quantity: number;
  unitPrice: number;
  total: number;
  bundle: { id: string; slug: string; name: string; image: string | null };
  constituents: BundleSnapshotItem[];
}

interface StockOp {
  variantId: string;
  quantity: number;
  noteSuffix: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private orderNumbers: OrderNumberService,
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

    this.assertLineKindPerItem(dto.items);

    const variantInputs = dto.items.filter((i) => i.variantId);
    const bundleInputs = dto.items.filter((i) => i.bundleId);

    const variantLines = await this.resolveVariantLines(variantInputs);
    const bundleLines = await this.resolveBundleLines(bundleInputs);

    let subtotal = 0;
    const orderItemsData: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] =
      [];
    for (const line of variantLines) {
      subtotal += line.total;
      orderItemsData.push(this.buildVariantOrderItemData(line));
    }
    for (const line of bundleLines) {
      subtotal += line.total;
      orderItemsData.push(this.buildBundleOrderItemData(line));
    }

    let discountAmount = 0;
    let discountId: string | undefined;
    if (dto.discountCode) {
      ({ discountId, discountAmount } = await this.resolveDiscount(
        dto.discountCode,
        subtotal,
      ));
    }

    const shippingCost = await this.computeShipping(
      dto.shippingAddress,
      dto.discountCode,
      subtotal - discountAmount,
    );

    const total = Math.max(0, subtotal - discountAmount + shippingCost);
    const stockOps = this.collectStockOps(variantLines, bundleLines);

    // ── Determine effectiveUserId (match-or-create for guest path) ───────────
    // For signed-in users: pass through the userId as-is.
    // For guests: look for an existing User matched by email or phone. If a
    // SHADOW user is matched, fill blanks (firstName, phones). If a CLAIMED
    // user is matched, attach only — never mutate a real account's profile.
    // If no match, upsert a new shadow User (race-safe via email unique index).
    let effectiveUserId: string;
    if (userId !== null) {
      effectiveUserId = userId;
    } else {
      const emailLower = dto.guestEmail!.trim().toLowerCase();
      const phoneResult = normalizeAndValidate(dto.guestPhone!);
      const normalizedPhone = phoneResult.ok ? phoneResult.phone : '';

      const candidate = await this.prisma.user.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { email: emailLower },
            ...(normalizedPhone ? [{ phones: { has: normalizedPhone } }] : []),
          ],
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phones: true,
          claimedAt: true,
        },
      });

      if (candidate) {
        effectiveUserId = candidate.id;
        if (candidate.claimedAt === null) {
          // SHADOW: fill-blanks update — only write what is missing or changed
          const updates: Prisma.UserUpdateInput = {};
          if (!candidate.firstName && dto.guestName) {
            updates.firstName = dto.guestName.trim();
          }
          if (normalizedPhone) {
            const newPhones = prependPhoneToArray(
              candidate.phones,
              normalizedPhone,
            );
            if (
              newPhones.length !== candidate.phones.length ||
              newPhones[0] !== candidate.phones[0]
            ) {
              updates.phones = newPhones;
            }
          }
          if (Object.keys(updates).length > 0) {
            await this.prisma.user.update({
              where: { id: candidate.id },
              data: updates,
            });
          }
        }
        // CLAIMED: attach only, intentionally skip profile mutation to prevent
        // email/phone spoofing from injecting contact info into a real account.
        this.logger.log(
          `guest checkout matched user ${candidate.id} (state=${candidate.claimedAt ? 'claimed' : 'shadow'}, matchedOn=${candidate.email === emailLower ? 'email' : 'phone'})`,
        );
      } else {
        // No match: upsert new shadow user (race-safe via email unique constraint)
        const newShadow = await this.prisma.user.upsert({
          where: { email: emailLower },
          create: {
            email: emailLower,
            firstName: dto.guestName!.trim(),
            lastName: '',
            phones: normalizedPhone ? [normalizedPhone] : [],
            passwordHash: null,
            role: Role.CUSTOMER,
            isVerified: true,
            claimedAt: null,
            createdBy: null,
          },
          update: { email: emailLower }, // no-op on race; lets us read the id
          select: { id: true },
        });
        effectiveUserId = newShadow.id;
      }
    }

    const order = await this.createOrderWithNumberRetry((orderNumber) =>
      this.prisma.$transaction(async (tx) => {
        await this.lockAndAssertStock(tx, stockOps);

        const created = await tx.order.create({
          data: {
            orderNumber,
            userId: effectiveUserId,
            // Always snapshot guest contact fields if provided — preserves the
            // order's "as-typed" data for receipts even when a userId resolved.
            guestEmail: dto.guestEmail ?? null,
            guestName: dto.guestName ?? null,
            guestPhone: dto.guestPhone ?? null,
            shippingAddress: dto.shippingAddress as Prisma.InputJsonValue,
            billingAddress: dto.billingAddress as
              | Prisma.InputJsonValue
              | undefined,
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

        await this.applyStockOps(tx, stockOps, created.id);

        if (discountId) {
          await this.atomicReserveDiscount(tx, discountId);
        }

        return created;
      }),
    );

    // Only clear cart for originally signed-in users — guest-matched users
    // don't have a Cart row keyed to their id from this session.
    if (userId) {
      const cart = await this.prisma.cart.findUnique({ where: { userId } });
      if (cart) {
        await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
    }

    // Record CampaignUsage rows for any campaign(s) that contributed a
    // discount to this order. De-duplicated by campaignId — one row per
    // (campaign, order) pair, even if multiple line items from the same
    // campaign were in the cart. Best-effort: failures here must not
    // brick the checkout, so we log and continue.
    if (effectiveUserId) {
      const campaignIds = Array.from(
        new Set(
          variantLines
            .map((l) => l.campaignId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      if (campaignIds.length > 0) {
        try {
          await this.prisma.campaignUsage.createMany({
            data: campaignIds.map((campaignId) => ({
              campaignId,
              orderId: order.id,
              userId: effectiveUserId,
            })),
            skipDuplicates: true,
          });
        } catch (err) {
          this.logger.warn(
            `campaign usage write failed for order ${order.id}: ${err instanceof Error ? err.message : 'unknown'}`,
          );
        }
      }
    }

    this.eventEmitter.emit(
      'order.created',
      new OrderCreatedEvent(order.id, effectiveUserId, total),
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
        include: { items: { include: ORDER_ITEM_DISPLAY_INCLUDE } },
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
        items: { include: ORDER_ITEM_DISPLAY_INCLUDE },
        discountRel: { select: { code: true, type: true, value: true } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (!isAdmin && order.userId !== userId)
      throw new ForbiddenException('Access denied');
    return order;
  }

  // Public order lookup gated by (orderRef, email). Used by the guest
  // track-order page AND the returns form's guest lookup. `orderRef`
  // accepts EITHER the orderNumber (DEN-NNNNNN, the customer-facing
  // identifier from confirmation emails) OR the raw CUID (kept for
  // backward compatibility with any older email link still in the
  // wild). The same 404 fires whether the order does not exist or the
  // email does not match the row, so an attacker cannot enumerate
  // order existence by id alone. Email comparison is case-insensitive
  // against both the registered user's email and the guest checkout
  // email tuple.
  async lookupForGuest(orderRef: string, email: string) {
    const normEmail = email.toLowerCase();
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: orderRef }, { orderNumber: orderRef }],
      },
      include: {
        items: { include: ORDER_ITEM_DISPLAY_INCLUDE },
        user: { select: { email: true, firstName: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const candidateEmails = [
      order.user?.email ?? null,
      order.guestEmail ?? null,
    ]
      .filter((e): e is string => Boolean(e))
      .map((e) => e.toLowerCase());
    if (!candidateEmails.includes(normEmail)) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingCost: order.shippingCost,
      total: order.total,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
      items: order.items,
    };
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

    const restoreOps = this.collectRestoreOps(order.items, orderId);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });
      await this.applyStockRestore(tx, restoreOps);
    });

    this.eventEmitter.emit(
      'order.cancelled',
      new OrderCancelledEvent(
        orderId,
        userId,
        restoreOps.map((op) => ({
          variantId: op.variantId,
          quantity: op.quantity,
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
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phones: true,
            },
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

  // States where inventory has been RETURNED to stock. Moving the order
  // INTO one of these restores items; moving FROM them never re-restores.
  // Used to keep stock decrement idempotent across the full lifecycle.
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

    const wasReturned = OrdersService.STOCK_RETURNED_STATES.has(fromStatus);
    const nowReturned = OrdersService.STOCK_RETURNED_STATES.has(newStatus);
    const shouldRestoreStock = !wasReturned && nowReturned;
    const restoreOps = shouldRestoreStock
      ? this.collectRestoreOps(order.items, orderId, newStatus)
      : [];

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
        await this.applyStockRestore(tx, restoreOps);
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

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // Wraps a `prisma.order.create` (typically inside a transaction) and
  // retries on P2002 unique-constraint collisions against orderNumber.
  // Mirrors `createWithRtnRetry` in returns.service.ts. Two concurrent
  // creates can ask OrderNumberService.generate() and receive the same
  // value; the DB unique index catches it, we regenerate, and try
  // again. After 3 attempts we bail with a 500 rather than spin.
  private async createOrderWithNumberRetry<T>(
    fn: (orderNumber: string) => Promise<T>,
  ): Promise<T> {
    for (let i = 0; i < ORDER_CREATE_MAX_RETRIES; i++) {
      const orderNumber = await this.orderNumbers.generate();
      try {
        return await fn(orderNumber);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new InternalServerErrorException(
      'Could not generate a unique order number after multiple attempts',
    );
  }

  private assertLineKindPerItem(items: OrderItemDto[]): void {
    for (const item of items) {
      const isVariant = !!item.variantId;
      const isBundle = !!item.bundleId;
      if (isVariant === isBundle) {
        throw new BadRequestException(
          'Each order item must be either a variant line (productId + variantId) or a bundle line (bundleId + bundleSize), not both and not neither',
        );
      }
      if (isVariant && !item.productId) {
        throw new BadRequestException('variant line requires productId');
      }
      if (isBundle && !item.bundleSize) {
        throw new BadRequestException('bundle line requires bundleSize');
      }
    }
  }

  private async resolveVariantLines(
    inputs: OrderItemDto[],
  ): Promise<VariantLineResolved[]> {
    if (inputs.length === 0) return [];

    const variantIds = inputs.map((i) => i.variantId!);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: {
        // product.price is the canonical price; variant.price is an
        // override per size/color and is null for the common case where
        // every variant shares the parent price. Pull both so the order
        // line can fall back when the override is null.
        product: {
          select: { id: true, name: true, images: true, slug: true, price: true },
        },
      },
    });

    if (variants.length !== inputs.length) {
      throw new NotFoundException('One or more variants not found');
    }

    // Fetch active campaign discounts for every distinct product in the
    // cart in one round-trip. If a product is in an active campaign the
    // unit price gets replaced with the campaign's finalPrice — same
    // number the customer saw on the storefront.
    const productIds = Array.from(new Set(variants.map((v) => v.product.id)));
    const campaignMap = await fetchActiveCampaignPrices(this.prisma, productIds);

    return inputs.map((item) => {
      const variant = variants.find((v) => v.id === item.variantId)!;
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
      // variant.price overrides product.price when set (e.g. limited-edition
      // colorway costs more than the base SKU). When null, fall back to
      // product.price so orders never save a 0-priced line.
      const rawPrice = variant.price ?? variant.product.price;
      const baseUnitPrice = Number(rawPrice);
      if (!Number.isFinite(baseUnitPrice) || baseUnitPrice <= 0) {
        throw new BadRequestException(
          `No price configured for ${variant.product.name} (${variant.size}/${variant.color})`,
        );
      }
      // Campaign discounts apply per-product, not per-variant. If the
      // product is in an active campaign, the campaign's finalPrice
      // wins over both product.price and any variant.price override —
      // the storefront price the customer agreed to.
      const campaign = campaignMap.get(variant.product.id);
      const unitPrice = campaign ? campaign.finalPrice : baseUnitPrice;
      const total = unitPrice * item.quantity;
      return {
        productId: item.productId,
        variantId: item.variantId!,
        quantity: item.quantity,
        unitPrice,
        total,
        campaignId: campaign?.campaignId,
        variant: {
          size: variant.size,
          color: variant.color,
          product: variant.product,
        },
      };
    });
  }

  private async resolveBundleLines(
    inputs: OrderItemDto[],
  ): Promise<BundleLineResolved[]> {
    if (inputs.length === 0) return [];

    const bundleIds = inputs.map((i) => i.bundleId!);
    const bundles = await this.prisma.productBundle.findMany({
      where: { id: { in: bundleIds }, isActive: true },
      include: { items: true },
    });

    const constituentQueries = inputs.flatMap((line) => {
      const bundle = bundles.find((b) => b.id === line.bundleId);
      if (!bundle) {
        throw new NotFoundException(
          `Bundle ${line.bundleId} not found or inactive`,
        );
      }
      if (!bundle.availableSizes.includes(line.bundleSize!)) {
        throw new BadRequestException(
          `Size ${line.bundleSize} is not offered for bundle ${bundle.slug}`,
        );
      }
      return bundle.items.map((bi) => ({
        productId: bi.productId,
        color: bi.color,
        size: line.bundleSize!,
      }));
    });

    const constituentVariants =
      constituentQueries.length > 0
        ? await this.prisma.productVariant.findMany({
            where: {
              OR: constituentQueries.map((q) => ({
                productId: q.productId,
                color: q.color,
                size: q.size,
                deletedAt: null,
              })),
            },
            include: {
              product: {
                select: { id: true, name: true, images: true, slug: true },
              },
            },
          })
        : [];

    const lookupVariant = (productId: string, color: string, size: string) =>
      constituentVariants.find(
        (v) =>
          v.productId === productId && v.color === color && v.size === size,
      );

    return inputs.map((line) => {
      const bundle = bundles.find((b) => b.id === line.bundleId)!;
      const constituents: BundleSnapshotItem[] = bundle.items.map((bi) => {
        const variant = lookupVariant(bi.productId, bi.color, line.bundleSize!);
        if (!variant) {
          throw new ConflictException(
            `Bundle ${bundle.slug} requires variant ${bi.productId} ${bi.color}/${line.bundleSize} which does not exist`,
          );
        }
        if (variant.stock < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${variant.product.name} (${bi.color}/${line.bundleSize}) in bundle ${bundle.slug}`,
          );
        }
        return {
          productId: bi.productId,
          variantId: variant.id,
          productName: variant.product.name,
          color: bi.color,
          size: line.bundleSize!,
          image: variant.product.images[0] ?? null,
        };
      });
      const unitPrice = bundle.bundlePrice;
      const total = unitPrice * line.quantity;
      return {
        bundleId: bundle.id,
        bundleSize: line.bundleSize!,
        quantity: line.quantity,
        unitPrice,
        total,
        bundle: {
          id: bundle.id,
          slug: bundle.slug,
          name: bundle.name,
          image: bundle.image,
        },
        constituents,
      };
    });
  }

  private buildVariantOrderItemData(
    line: VariantLineResolved,
  ): Prisma.OrderItemUncheckedCreateWithoutOrderInput {
    return {
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.total,
      snapshot: {
        name: line.variant.product.name,
        size: line.variant.size,
        color: line.variant.color,
        image: line.variant.product.images[0] ?? null,
      },
    };
  }

  private buildBundleOrderItemData(
    line: BundleLineResolved,
  ): Prisma.OrderItemUncheckedCreateWithoutOrderInput {
    const snapshot: BundleSnapshot = {
      bundleSlug: line.bundle.slug,
      bundleName: line.bundle.name,
      bundleImage: line.bundle.image,
      bundleSize: line.bundleSize,
      bundlePrice: line.unitPrice,
      items: line.constituents,
    };
    return {
      bundleId: line.bundleId,
      bundleSize: line.bundleSize,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.total,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    };
  }

  private async resolveDiscount(
    rawCode: string,
    subtotal: number,
  ): Promise<{ discountId: string; discountAmount: number }> {
    const code = rawCode.toUpperCase();
    const discount = await this.prisma.discount.findUnique({ where: { code } });
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
    if (discount.minOrderAmount && subtotal < Number(discount.minOrderAmount)) {
      throw new BadRequestException(
        `Minimum order amount is ${discount.minOrderAmount} for this discount`,
      );
    }
    const discountAmount =
      discount.type === 'PERCENTAGE'
        ? subtotal * (Number(discount.value) / 100)
        : discount.type === 'FIXED_AMOUNT'
          ? Number(discount.value)
          : 0;
    return { discountId: discount.id, discountAmount };
  }

  private async computeShipping(
    shippingAddress: Record<string, unknown>,
    discountCode: string | undefined,
    subtotalAfterDiscount: number,
  ): Promise<number> {
    let shippingCost = 80;
    const city = ((shippingAddress?.city as string) ?? '').toLowerCase();
    if (city && city !== 'dhaka') {
      shippingCost = 120;
    }
    if (subtotalAfterDiscount >= 1500) {
      shippingCost = 0;
    }
    if (discountCode) {
      const disc = await this.prisma.discount.findUnique({
        where: { code: discountCode.toUpperCase() },
      });
      if (disc?.type === 'FREE_SHIPPING') shippingCost = 0;
    }
    return shippingCost;
  }

  private collectStockOps(
    variantLines: VariantLineResolved[],
    bundleLines: BundleLineResolved[],
  ): StockOp[] {
    const ops: StockOp[] = [];
    for (const line of variantLines) {
      ops.push({
        variantId: line.variantId,
        quantity: line.quantity,
        noteSuffix: '',
      });
    }
    for (const line of bundleLines) {
      for (const c of line.constituents) {
        ops.push({
          variantId: c.variantId,
          quantity: line.quantity,
          noteSuffix: ` (bundle: ${line.bundle.slug})`,
        });
      }
    }
    return ops;
  }

  // Locks the row for every referenced variantId in deterministic order
  // (sorted ascending) to prevent deadlock under concurrent overlapping
  // orders. Aggregates the required quantity per variant across all ops
  // so a variant referenced from both a variant line and a bundle line
  // (or from two bundle lines) is checked against the SUM.
  private async lockAndAssertStock(
    tx: Prisma.TransactionClient,
    ops: StockOp[],
  ): Promise<void> {
    const requiredByVariant = new Map<string, number>();
    for (const op of ops) {
      requiredByVariant.set(
        op.variantId,
        (requiredByVariant.get(op.variantId) ?? 0) + op.quantity,
      );
    }
    const sortedVariantIds = [...requiredByVariant.keys()].sort();
    for (const variantId of sortedVariantIds) {
      const [locked] = await tx.$queryRawUnsafe<{ stock: number }[]>(
        `SELECT stock FROM "ProductVariant" WHERE id = $1 FOR UPDATE`,
        variantId,
      );
      const required = requiredByVariant.get(variantId)!;
      if (!locked || locked.stock < required) {
        throw new BadRequestException(
          `Insufficient stock for variant ${variantId} (available: ${locked?.stock ?? 0}, requested: ${required})`,
        );
      }
    }
  }

  private async applyStockOps(
    tx: Prisma.TransactionClient,
    ops: StockOp[],
    orderId: string,
  ): Promise<void> {
    for (const op of ops) {
      await tx.productVariant.update({
        where: { id: op.variantId },
        data: { stock: { decrement: op.quantity } },
      });
      await tx.inventoryLog.create({
        data: {
          variantId: op.variantId,
          type: 'SALE',
          quantity: -op.quantity,
          note: `Order ${orderId}${op.noteSuffix}`,
        },
      });
    }
  }

  // Discount-use reservation (LR-001 amendment S9, race-safe). Single
  // atomic updateMany increments ONLY when the row is still active AND
  // still under the cap; if neither condition holds, count = 0 and we
  // abort the order. Mirrors discounts.service.tryConsume but stays
  // inside the order-creation transaction.
  private async atomicReserveDiscount(
    tx: Prisma.TransactionClient,
    discountId: string,
  ): Promise<void> {
    const reserved = await tx.discount.updateMany({
      where: {
        id: discountId,
        isActive: true,
        OR: [
          { maxUses: null },
          { usedCount: { lt: tx.discount.fields.maxUses } },
        ],
      },
      data: { usedCount: { increment: 1 } },
    });
    if (reserved.count === 0) {
      throw new BadRequestException('Discount is no longer available');
    }
  }

  // Walks order.items and produces a StockOp per (variantId, quantity)
  // for cancel / status-restore paths. For variant lines, the op points
  // at item.variantId. For bundle lines, each constituent.variantId is
  // restored by the bundle line quantity (the snapshot was written at
  // order time so the restore is correct even if the bundle has been
  // edited or deactivated since).
  private collectRestoreOps(
    items: Array<{
      variantId: string | null;
      bundleId: string | null;
      quantity: number;
      snapshot: Prisma.JsonValue;
    }>,
    orderId: string,
    targetStatus: OrderStatus = OrderStatus.CANCELLED,
  ): Array<{ variantId: string; quantity: number; note: string }> {
    const ops: Array<{ variantId: string; quantity: number; note: string }> =
      [];
    for (const item of items) {
      if (item.variantId) {
        ops.push({
          variantId: item.variantId,
          quantity: item.quantity,
          note: `Order ${orderId} → ${targetStatus}`,
        });
        continue;
      }
      if (item.bundleId) {
        const snapshot = item.snapshot as unknown as BundleSnapshot;
        for (const c of snapshot.items) {
          ops.push({
            variantId: c.variantId,
            quantity: item.quantity,
            note: `Order ${orderId} → ${targetStatus} (bundle: ${snapshot.bundleSlug})`,
          });
        }
      }
    }
    return ops;
  }

  // Restore is per-op tolerant. OrderItem.variantId has ON DELETE RESTRICT
  // which protects variant lines from FK breakage, but a bundle line's
  // constituent variantId lives only inside the snapshot JSON — admin
  // hard-deleting that variant after the order was placed would otherwise
  // P2025 the whole restore transaction and block the refund. We catch
  // P2025 per op, log it as an audit trail, and continue. The customer
  // gets their refund; ops can repair the inventory math out-of-band.
  private async applyStockRestore(
    tx: Prisma.TransactionClient,
    ops: Array<{ variantId: string; quantity: number; note: string }>,
  ): Promise<void> {
    for (const op of ops) {
      try {
        await tx.productVariant.update({
          where: { id: op.variantId },
          data: { stock: { increment: op.quantity } },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2025'
        ) {
          this.logger.warn(
            `applyStockRestore: variant ${op.variantId} no longer exists; skipping stock restore (qty=${op.quantity}). Inventory log still written for audit.`,
          );
        } else {
          throw err;
        }
      }
      await tx.inventoryLog.create({
        data: {
          variantId: op.variantId,
          type: 'RETURN',
          quantity: op.quantity,
          note: op.note,
        },
      });
    }
  }

  // ─── Bulk order history import helpers ────────────────────────────────────

  private async ensureLegacyCategoryId(): Promise<string> {
    const existing = await this.prisma.category.findFirst({
      where: { slug: 'legacy-imports' },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await this.prisma.category.create({
      data: { slug: 'legacy-imports', name: 'Legacy Imports' },
    });
    return created.id;
  }

  private async createPlaceholderVariant(
    sku: string,
    unitPrice: number,
    categoryId: string,
  ): Promise<{ id: string; productId: string }> {
    const slugSafeSku = sku
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const product = await this.prisma.product.create({
      data: {
        name: sku,
        slug: `legacy-${slugSafeSku}`,
        description: `Legacy product imported from order history. SKU: ${sku}`,
        price: unitPrice,
        images: [],
        isActive: false,
        categoryId,
      },
    });
    const variant = await this.prisma.productVariant.create({
      data: {
        productId: product.id,
        sku,
        size: '-',
        color: '-',
        stock: 0,
        price: unitPrice,
        images: [],
      },
    });
    return { id: variant.id, productId: product.id };
  }

  async bulkImportHistory(buffer: Buffer, adminUserId: string) {
    const parsed = await parseOrderHistoryCsv(buffer);
    const totalOrdersInFile = parsed.groups.size;

    // Pre-flight
    const allSkus = new Set<string>();
    const allEmails = new Set<string>();
    for (const group of parsed.groups.values()) {
      allEmails.add(group.header.customer_email);
      for (const item of group.items) allSkus.add(item.sku);
    }
    const existingVariants = await this.prisma.productVariant.findMany({
      where: { sku: { in: Array.from(allSkus) } },
      select: { id: true, sku: true, productId: true },
    });
    const variantBySku = new Map(existingVariants.map((v) => [v.sku, v]));
    const existingUsers = await this.prisma.user.findMany({
      where: { email: { in: Array.from(allEmails) } },
      select: { id: true, email: true, claimedAt: true, firstName: true, phones: true },
    });
    const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));

    let legacyCategoryId: string | null = null;
    const ensureLegacyCategory = async () => {
      if (legacyCategoryId === null) legacyCategoryId = await this.ensureLegacyCategoryId();
      return legacyCategoryId;
    };

    const placeholderBySku = new Map<string, { id: string; productId: string }>();
    const placeholderOccurrences = new Map<string, number>();

    const result = {
      totalOrdersInFile,
      imported: 0,
      skipped_duplicate: 0,
      skipped_invalid: 0,
      placeholdersCreated: 0,
      newShadowsCreated: 0,
      ordersAttachedToExisting: 0,
      errors: parsed.errors,
      placeholdersReport: [] as Array<{ sku: string; occurrences: number; productId: string }>,
    };

    for (const [orderRef, group] of parsed.groups) {
      const orderNumber = `LEGACY-${orderRef}`;

      const existingOrder = await this.prisma.order.findFirst({
        where: { orderNumber },
        select: { id: true },
      });
      if (existingOrder) {
        result.skipped_duplicate += 1;
        continue;
      }

      // Customer linkage
      const email = group.header.customer_email;
      const phoneClean = group.header.customer_phone
        .replace(/\D/g, '')
        .replace(/^880(?=\d{10,11}$)/, '0');
      const phoneValid = /^\d{10,11}$/.test(phoneClean);

      let userId: string;
      const candidate = userByEmail.get(email);
      if (candidate) {
        userId = candidate.id;
        if (candidate.claimedAt === null) {
          // Shadow: fill-blanks
          const updates: Record<string, unknown> = {};
          if (!candidate.firstName && group.header.customer_name) {
            updates.firstName = group.header.customer_name;
          }
          if (phoneValid && !candidate.phones.includes(phoneClean)) {
            updates.phones = [phoneClean, ...candidate.phones].slice(0, 20);
          }
          if (Object.keys(updates).length > 0) {
            await this.prisma.user.update({
              where: { id: candidate.id },
              data: updates,
            });
          }
        }
        // Claimed: attach only, never mutate.
        result.ordersAttachedToExisting += 1;
      } else {
        const shadow = await this.prisma.user.upsert({
          where: { email },
          create: {
            email,
            firstName: group.header.customer_name,
            lastName: '',
            phones: phoneValid ? [phoneClean] : [],
            passwordHash: null,
            role: 'CUSTOMER' as const,
            isVerified: true,
            claimedAt: null,
            createdBy: null,
          },
          update: { email },
          select: { id: true },
        });
        userId = shadow.id;
        result.newShadowsCreated += 1;
        userByEmail.set(email, {
          id: shadow.id,
          email,
          claimedAt: null,
          firstName: group.header.customer_name,
          phones: phoneValid ? [phoneClean] : [],
        });
      }

      // Variant resolution (some may already be placeholders from earlier groups in this batch)
      const resolvedItems: Array<{
        variantId: string; productId: string; quantity: number; unitPrice: number;
      }> = [];
      for (const item of group.items) {
        let variantInfo = variantBySku.get(item.sku) ?? placeholderBySku.get(item.sku);
        if (!variantInfo) {
          const categoryId = await ensureLegacyCategory();
          const created = await this.createPlaceholderVariant(item.sku, item.unit_price, categoryId);
          placeholderBySku.set(item.sku, created);
          result.placeholdersCreated += 1;
          variantInfo = created;
        }
        placeholderOccurrences.set(item.sku, (placeholderOccurrences.get(item.sku) ?? 0) + 1);
        resolvedItems.push({
          variantId: variantInfo.id,
          productId: variantInfo.productId,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        });
      }

      // Totals
      const subtotal = resolvedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const total = Math.max(0, subtotal + group.header.shipping_cost - group.header.discount_amount);

      // Shipping address (placeholder if missing)
      const shippingAddress = {
        line1: group.header.ship_line1 || 'Imported from legacy system',
        city: group.header.ship_city || 'Unknown',
        state: group.header.ship_state || 'Unknown',
        postalCode: group.header.ship_postal || '0000',
        country: group.header.ship_country || 'BD',
      };

      // Create order + items (NO stock decrement; createdAt overridden)
      await this.prisma.order.create({
        data: {
          orderNumber,
          userId,
          guestEmail: email,
          guestName: group.header.customer_name || null,
          guestPhone: phoneValid ? phoneClean : null,
          shippingAddress,
          subtotal,
          discount: group.header.discount_amount,
          shippingCost: group.header.shipping_cost,
          total,
          notes: group.header.notes || null,
          status: 'DELIVERED' as const,
          createdAt: new Date(group.header.order_date),
          items: {
            create: resolvedItems.map((it) => ({
              productId: it.productId,
              variantId: it.variantId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.quantity * it.unitPrice,
              snapshot: { sku: 'legacy-import' },
            })),
          },
        },
      });
      result.imported += 1;
    }

    for (const [sku, count] of placeholderOccurrences) {
      const info = placeholderBySku.get(sku);
      if (info) {
        result.placeholdersReport.push({ sku, occurrences: count, productId: info.productId });
      }
    }

    return result;
  }
}

// Reusable Prisma include shape for order-item display reads (customer + admin
// order detail). Returns variant info for variant lines and bundle info
// with constituent products for bundle lines.
const ORDER_ITEM_DISPLAY_INCLUDE = {
  product: { select: { name: true, slug: true, images: true } },
  variant: { select: { size: true, color: true } },
  bundle: {
    select: {
      id: true,
      slug: true,
      name: true,
      image: true,
      bundlePrice: true,
      items: {
        include: {
          product: {
            select: { id: true, name: true, slug: true, images: true },
          },
        },
      },
    },
  },
} as const;
