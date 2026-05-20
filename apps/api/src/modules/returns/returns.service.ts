import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, ReturnStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RtnIdService } from './rtn-id.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ManualReturnDto } from './dto/manual-return.dto';
import {
  isWithinWindow,
  checkItemEligibility,
  RETURN_WINDOW_DAYS,
} from './returns.eligibility';
import {
  defaultFault,
  requiresPhotos,
  canTransition,
} from './returns.state-machine';

const SLA_HOURS = 48;
const RTN_CREATE_MAX_RETRIES = 3;

// Shape of one constituent inside `OrderItem.snapshot.items[]` for bundle
// order lines. Mirrored from BundleSnapshotItem in orders.service.ts.
// Kept inline (not imported) to avoid a cross-module type coupling for a
// 6-field denormalized read-only shape.
interface BundleSnapshotConstituent {
  productId: string;
  variantId: string;
  productName: string;
  color: string;
  size: string;
  image: string | null;
}

interface BundleSnapshotShape {
  items?: BundleSnapshotConstituent[];
}

// Composite key for tracking already-returned quantity per (orderItem,
// optional bundle constituent). Non-bundle rows use the empty string so
// the same Map can hold both kinds without collisions.
function returnedKey(
  orderItemId: string,
  bundleComponentVariantId: string | null | undefined,
): string {
  return `${orderItemId}::${bundleComponentVariantId ?? ''}`;
}

// Pull a constituent out of an OrderItem.snapshot Json blob. Returns null
// when the snapshot is malformed or the variantId is not found — callers
// treat null as "no extra display metadata", not as an error, because
// the variantId itself is the source of truth on the ReturnItem row.
function findBundleConstituent(
  snapshotJson: Prisma.JsonValue,
  variantId: string | null | undefined,
): BundleSnapshotConstituent | null {
  if (!variantId) return null;
  if (!snapshotJson || typeof snapshotJson !== 'object') return null;
  const snapshot = snapshotJson as unknown as BundleSnapshotShape;
  if (!Array.isArray(snapshot.items)) return null;
  return snapshot.items.find((c) => c.variantId === variantId) ?? null;
}

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rtnIds: RtnIdService,
    private readonly events: EventEmitter2,
  ) {}

  async createReturn(input: {
    userId: string | null;
    dto: CreateReturnDto;
  }): Promise<{ id: string; rtnNumber: string }> {
    const { userId, dto } = input;

    if (requiresPhotos(dto.reason) && dto.photos.length === 0) {
      throw new BadRequestException(
        `Photos are required for reason ${dto.reason}`,
      );
    }

    // `dto.orderId` accepts EITHER the raw CUID OR the customer-facing
    // orderNumber (DEN-NNNNNN). The DTO field keeps its historical name
    // to avoid churning every downstream caller; the storefront form is
    // free to pass whichever it has on hand.
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id: dto.orderId }, { orderNumber: dto.orderId }],
      },
      include: {
        items: { include: { product: true } },
        statusHistory: {
          where: { toStatus: 'DELIVERED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isOwner = this.matchesOrderOwnership({
      order: {
        userId: order.userId,
        guestEmail: order.guestEmail,
        guestPhone: order.guestPhone,
      },
      userId,
      providedEmail: dto.guestEmail,
      providedPhone: dto.guestPhone,
    });
    if (!isOwner) {
      throw new ForbiddenException(
        'Order does not match the provided credentials',
      );
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Returns can only be requested for DELIVERED orders',
      );
    }

    const deliveredEntry = order.statusHistory[0];
    if (!isWithinWindow(deliveredEntry?.createdAt ?? null)) {
      throw new BadRequestException(
        `Return window of ${RETURN_WINDOW_DAYS} days has expired`,
      );
    }

    const fault = defaultFault(dto.reason);
    const customerShipsBack = fault === 'CUSTOMER';
    const slaDeadline = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000);

    // Validate bundle-component semantics up-front (before the txn) so
    // the customer sees a clear 400 rather than a generic txn rollback.
    // For bundle order items the DTO MUST identify which constituent is
    // being returned; for non-bundle items the field MUST be absent.
    for (const item of dto.items) {
      const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
      if (!orderItem) continue; // checked again inside the txn
      this.validateBundleComponentRequest({
        orderItemId: item.orderItemId,
        isBundleLine: !!orderItem.bundleId,
        snapshot: orderItem.snapshot,
        bundleComponentVariantId: item.bundleComponentVariantId,
      });
    }

    const created = await this.createWithRtnRetry(async (rtnNumber) =>
      this.prisma.$transaction(
        async (tx) => {
          const orderItemIds = dto.items.map((i) => i.orderItemId);
          // Group existing return quantities by (orderItemId,
          // bundleComponentVariantId) — bundle constituents are tracked
          // independently of each other and of any whole-bundle line.
          const existingQuantities = await tx.returnItem.groupBy({
            by: ['orderItemId', 'bundleComponentVariantId'],
            where: {
              orderItemId: { in: orderItemIds },
              return: {
                status: { notIn: ['REJECTED', 'CANCELLED', 'CLOSED'] },
              },
            },
            _sum: { quantity: true },
          });
          const alreadyReturnedMap = new Map<string, number>(
            existingQuantities
              .filter(
                (row): row is typeof row & { orderItemId: string } =>
                  row.orderItemId !== null,
              )
              .map((row) => [
                returnedKey(row.orderItemId, row.bundleComponentVariantId),
                row._sum.quantity ?? 0,
              ]),
          );

          for (const item of dto.items) {
            const orderItem = order.items.find(
              (oi) => oi.id === item.orderItemId,
            );
            if (!orderItem) {
              throw new BadRequestException(
                `Order item ${item.orderItemId} not in order`,
              );
            }
            const failure = checkItemEligibility({
              orderItem,
              requestedQty: item.quantity,
              alreadyReturnedQty:
                alreadyReturnedMap.get(
                  returnedKey(orderItem.id, item.bundleComponentVariantId),
                ) ?? 0,
            });
            if (failure) {
              throw new BadRequestException(
                `Item ${orderItem.id} ineligible: ${failure}`,
              );
            }
          }

          return tx.return.create({
            data: {
              rtnNumber,
              orderId: order.id,
              userId: order.userId,
              guestEmail: order.guestEmail,
              guestName: order.guestName,
              guestPhone: order.guestPhone,
              reason: dto.reason,
              fault,
              description: dto.description,
              photos: dto.photos,
              customerShipsBack,
              slaDeadline,
              items: {
                create: dto.items.map((i) => {
                  const orderItem = order.items.find(
                    (oi) => oi.id === i.orderItemId,
                  )!;
                  if (!orderItem.bundleId) {
                    return {
                      orderItemId: i.orderItemId,
                      quantity: i.quantity,
                    };
                  }
                  const constituent = findBundleConstituent(
                    orderItem.snapshot,
                    i.bundleComponentVariantId,
                  );
                  return {
                    orderItemId: i.orderItemId,
                    quantity: i.quantity,
                    bundleComponentVariantId: i.bundleComponentVariantId,
                    bundleComponentName: constituent?.productName ?? null,
                    bundleComponentSize: constituent?.size ?? null,
                    bundleComponentColor: constituent?.color ?? null,
                  };
                }),
              },
            },
            select: { id: true, rtnNumber: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    this.events.emit('return.requested', {
      returnId: created.id,
      rtnNumber: created.rtnNumber,
    });
    return created;
  }

  async createManual(input: {
    adminId: string;
    dto: ManualReturnDto;
  }): Promise<{ id: string; rtnNumber: string }> {
    const { adminId, dto } = input;

    type OrderWithItems = Prisma.OrderGetPayload<{
      include: { items: { include: { product: true } } };
    }>;
    let order: OrderWithItems | null = null;
    if (dto.orderId) {
      // Admin manual entry also accepts either the CUID or the
      // DEN-NNNNNN orderNumber — they may be reading the number off a
      // printed invoice or a customer's confirmation email.
      order = await this.prisma.order.findFirst({
        where: {
          OR: [{ id: dto.orderId }, { orderNumber: dto.orderId }],
        },
        include: { items: { include: { product: true } } },
      });
      if (!order) {
        throw new NotFoundException(`Order ${dto.orderId} not found`);
      }
    }

    // For order-linked items, verify orderItemId is in the order +
    // enforce the bundle-component invariant (must name a constituent
    // when the source line is a bundle, must NOT name one otherwise).
    for (const item of dto.items) {
      if (item.orderItemId) {
        if (!order) {
          throw new BadRequestException(
            'Cannot reference orderItemId when orderId is null',
          );
        }
        const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
        if (!orderItem) {
          throw new BadRequestException(
            `Order item ${item.orderItemId} not in order ${dto.orderId}`,
          );
        }
        this.validateBundleComponentRequest({
          orderItemId: item.orderItemId,
          isBundleLine: !!orderItem.bundleId,
          snapshot: orderItem.snapshot,
          bundleComponentVariantId: item.bundleComponentVariantId,
        });
      } else if (item.bundleComponentVariantId) {
        // Manual-entry items without an orderItem can't reference a
        // bundle constituent — there is no snapshot to validate against.
        throw new BadRequestException(
          'bundleComponentVariantId requires orderItemId on manual returns',
        );
      }
    }

    const fault = dto.faultOverride ?? defaultFault(dto.reason);
    const customerShipsBack = fault === 'CUSTOMER';
    const slaDeadline = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000);

    const created = await this.createWithRtnRetry(async (rtnNumber) =>
      this.prisma.return.create({
        data: {
          rtnNumber,
          orderId: order?.id ?? null,
          userId: order?.userId ?? null,
          guestEmail: dto.customerEmail ?? order?.guestEmail ?? null,
          guestName: dto.customerName,
          guestPhone: dto.customerPhone,
          reason: dto.reason,
          fault,
          description: dto.description,
          photos: dto.photos,
          isManual: true,
          customerShipsBack,
          slaDeadline,
          items: {
            create: dto.items.map((i) => {
              const orderItem = i.orderItemId
                ? order?.items.find((oi) => oi.id === i.orderItemId)
                : null;
              const isBundle = !!orderItem?.bundleId;
              const constituent = isBundle
                ? findBundleConstituent(
                    orderItem!.snapshot,
                    i.bundleComponentVariantId,
                  )
                : null;
              return {
                orderItemId: i.orderItemId,
                manualProductName: i.manualProductName,
                manualSku: i.manualSku,
                manualSize: i.manualSize,
                manualColor: i.manualColor,
                manualUnitPrice:
                  i.manualUnitPrice !== undefined
                    ? new Prisma.Decimal(i.manualUnitPrice)
                    : undefined,
                quantity: i.quantity,
                ...(isBundle
                  ? {
                      bundleComponentVariantId: i.bundleComponentVariantId,
                      bundleComponentName: constituent?.productName ?? null,
                      bundleComponentSize: constituent?.size ?? null,
                      bundleComponentColor: constituent?.color ?? null,
                    }
                  : {}),
              };
            }),
          },
        },
        select: { id: true, rtnNumber: true },
      }),
    );

    this.events.emit('return.requested', {
      returnId: created.id,
      rtnNumber: created.rtnNumber,
      isManual: true,
      adminId,
    });

    return created;
  }

  async cancelReturn(input: {
    userId: string | null;
    rtnNumber: string;
    guestEmail?: string;
    guestPhone?: string;
  }): Promise<void> {
    const ret = await this.prisma.return.findUnique({
      where: { rtnNumber: input.rtnNumber },
    });
    if (!ret) throw new NotFoundException('Return not found');

    const isOwner = this.matchesReturnOwnership({
      ret,
      userId: input.userId,
      providedEmail: input.guestEmail,
      providedPhone: input.guestPhone,
    });
    if (!isOwner) throw new ForbiddenException();

    if (!canTransition(ret.status, 'CANCELLED')) {
      throw new BadRequestException(
        `Cannot cancel a return in status ${ret.status}`,
      );
    }

    await this.prisma.return.update({
      where: { id: ret.id },
      data: { status: 'CANCELLED', closedAt: new Date() },
    });
    this.events.emit('return.cancelled', {
      returnId: ret.id,
      rtnNumber: ret.rtnNumber,
    });
  }

  async getMyReturns(userId: string) {
    return this.prisma.return.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      include: { items: true },
    });
  }

  async getByRtnNumber(args: {
    rtnNumber: string;
    userId?: string | null;
    guestEmail?: string;
    guestPhone?: string;
  }) {
    const ret = await this.prisma.return.findUnique({
      where: { rtnNumber: args.rtnNumber },
      include: {
        items: { include: { orderItem: { include: { product: true } } } },
        order: { select: { id: true, total: true, status: true } },
      },
    });
    if (!ret) throw new NotFoundException();
    const isOwner = this.matchesReturnOwnership({
      ret,
      userId: args.userId ?? null,
      providedEmail: args.guestEmail,
      providedPhone: args.guestPhone,
    });
    if (!isOwner) throw new ForbiddenException();
    return ret;
  }

  async listForAdmin(args: {
    status?: ReturnStatus[];
    slaOverdue?: boolean;
    page: number;
    limit: number;
  }) {
    const where: Prisma.ReturnWhereInput = {};
    if (args.slaOverdue) {
      where.slaDeadline = { lt: new Date() };
      where.status = { in: ['REQUESTED', 'UNDER_REVIEW'] };
    } else if (args.status?.length) {
      where.status = { in: args.status };
    }
    const [items, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
        include: {
          items: true,
          order: { select: { id: true, total: true } },
          refundTxn: true,
        },
      }),
      this.prisma.return.count({ where }),
    ]);
    return { items, total, page: args.page, limit: args.limit };
  }

  async getForAdmin(id: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            // Include bundle so the admin UI can render constituent
            // returns with their parent-bundle metadata (name, image).
            // ReturnItem also carries denormalized
            // bundleComponentName/Size/Color from snapshot, but the
            // bundle relation is what links back to the catalog.
            orderItem: {
              include: { product: true, variant: true, bundle: true },
            },
          },
        },
        order: { include: { items: true } },
        refundTxn: true,
        reviewer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!ret) throw new NotFoundException();
    return ret;
  }

  async transition(args: {
    id: string;
    to: ReturnStatus;
    adminId: string;
    patch?: Prisma.ReturnUpdateInput;
  }) {
    const current = await this.prisma.return.findUnique({
      where: { id: args.id },
      select: { status: true, rtnNumber: true },
    });
    if (!current) throw new NotFoundException();
    if (!canTransition(current.status, args.to)) {
      throw new BadRequestException(
        `Cannot transition ${current.status} -> ${args.to}`,
      );
    }
    const now = new Date();
    const timestampField = this.timestampForStatus(args.to);
    // Optimistic lock: only update if status hasn't changed since our read.
    // Two concurrent admin actions on the same return will see the same
    // current.status, but only one update will match — the second gets P2025
    // which we surface as Conflict so neither admin proceeds blindly.
    let updated;
    try {
      updated = await this.prisma.return.update({
        where: { id: args.id, status: current.status },
        data: {
          status: args.to,
          ...(timestampField ? { [timestampField]: now } : {}),
          ...(args.patch ?? {}),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new ConflictException(
          'Return was modified by another admin. Refresh and try again.',
        );
      }
      throw err;
    }
    this.events.emit(`return.${args.to.toLowerCase()}`, {
      returnId: updated.id,
      rtnNumber: updated.rtnNumber,
      adminId: args.adminId,
    });
    return updated;
  }

  private timestampForStatus(status: ReturnStatus): string | null {
    switch (status) {
      case 'UNDER_REVIEW':
        return 'reviewedAt';
      case 'APPROVED':
        return 'approvedAt';
      case 'RECEIVED':
        return 'receivedAt';
      case 'INSPECTED_PASS':
      case 'INSPECTED_FAIL':
        return 'inspectedAt';
      case 'REFUNDED':
        return 'refundedAt';
      case 'CLOSED':
      case 'CANCELLED':
      case 'RETURNED_TO_CUSTOMER':
      case 'REJECTED':
        return 'closedAt';
      default:
        return null;
    }
  }

  async recordInspection(args: {
    id: string;
    adminId: string;
    itemResults: {
      returnItemId: string;
      inspectionResult: 'PASS' | 'FAIL';
      restock: boolean;
    }[];
    inspectionNotes?: string;
  }) {
    const ret = await this.prisma.return.findUnique({
      where: { id: args.id },
      include: { items: true },
    });
    if (!ret) throw new NotFoundException();
    if (ret.status !== 'INSPECTING') {
      throw new BadRequestException('Return is not in INSPECTING state');
    }

    // Validate every reported item belongs to this return
    const validIds = new Set(ret.items.map((i) => i.id));
    for (const r of args.itemResults) {
      if (!validIds.has(r.returnItemId)) {
        throw new BadRequestException(
          `ReturnItem ${r.returnItemId} does not belong to this return`,
        );
      }
    }

    const allPass = args.itemResults.every(
      (r) => r.inspectionResult === 'PASS',
    );
    const nextStatus: ReturnStatus = allPass
      ? 'INSPECTED_PASS'
      : 'INSPECTED_FAIL';

    await this.prisma.$transaction([
      ...args.itemResults.map((r) =>
        this.prisma.returnItem.update({
          where: { id: r.returnItemId },
          data: {
            inspectionResult: r.inspectionResult,
            restock: r.restock,
          },
        }),
      ),
      this.prisma.return.update({
        where: { id: args.id },
        data: {
          status: nextStatus,
          inspectedAt: new Date(),
          inspectionNotes: args.inspectionNotes,
        },
      }),
    ]);
    this.events.emit(`return.${nextStatus.toLowerCase()}`, {
      returnId: ret.id,
      rtnNumber: ret.rtnNumber,
      adminId: args.adminId,
    });
    return { status: nextStatus };
  }

  /**
   * Bundle-component invariant guard. Throws BadRequestException when:
   *   - A bundle order line is referenced without `bundleComponentVariantId`.
   *   - A non-bundle order line is referenced WITH `bundleComponentVariantId`.
   *   - The provided variantId is not one of the constituents recorded
   *     in `OrderItem.snapshot.items[]`.
   *
   * Defensive: if a legacy bundle order has a snapshot that does not
   * contain an `items[]` array, we block per-component returns entirely
   * (the customer would need to use a manual return path). This guards
   * against snapshot drift from before the bundle order schema settled.
   */
  private validateBundleComponentRequest(args: {
    orderItemId: string;
    isBundleLine: boolean;
    snapshot: Prisma.JsonValue;
    bundleComponentVariantId: string | undefined;
  }): void {
    if (!args.isBundleLine) {
      if (args.bundleComponentVariantId) {
        throw new BadRequestException(
          `Order item ${args.orderItemId} is not a bundle line; ` +
            `bundleComponentVariantId is not allowed`,
        );
      }
      return;
    }
    if (!args.bundleComponentVariantId) {
      throw new BadRequestException(
        `Order item ${args.orderItemId} is a bundle line; ` +
          `bundleComponentVariantId is required`,
      );
    }
    const snapshot =
      args.snapshot && typeof args.snapshot === 'object'
        ? (args.snapshot as unknown as BundleSnapshotShape)
        : null;
    const items = snapshot?.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException(
        `Order item ${args.orderItemId} bundle snapshot is missing constituents; ` +
          `per-component returns are not available for this order`,
      );
    }
    const found = items.some(
      (c) => c.variantId === args.bundleComponentVariantId,
    );
    if (!found) {
      throw new BadRequestException(
        `bundleComponentVariantId ${args.bundleComponentVariantId} ` +
          `is not a constituent of order item ${args.orderItemId}`,
      );
    }
  }

  private matchesOrderOwnership(args: {
    order: {
      userId: string | null;
      guestEmail: string | null;
      guestPhone: string | null;
    };
    userId: string | null;
    providedEmail?: string;
    providedPhone?: string;
  }): boolean {
    if (args.userId && args.order.userId === args.userId) return true;
    if (
      !args.userId &&
      args.order.guestEmail &&
      args.providedEmail &&
      args.order.guestEmail.toLowerCase() ===
        args.providedEmail.toLowerCase() &&
      args.order.guestPhone &&
      args.providedPhone &&
      args.order.guestPhone === args.providedPhone
    ) {
      return true;
    }
    return false;
  }

  private matchesReturnOwnership(args: {
    ret: {
      userId: string | null;
      guestEmail: string | null;
      guestPhone: string | null;
    };
    userId: string | null;
    providedEmail?: string;
    providedPhone?: string;
  }): boolean {
    if (args.userId && args.ret.userId === args.userId) return true;
    if (
      !args.userId &&
      args.ret.guestEmail &&
      args.providedEmail &&
      args.ret.guestEmail.toLowerCase() === args.providedEmail.toLowerCase() &&
      args.ret.guestPhone &&
      args.providedPhone &&
      args.ret.guestPhone === args.providedPhone
    ) {
      return true;
    }
    return false;
  }

  private async createWithRtnRetry<T>(
    fn: (rtnNumber: string) => Promise<T>,
  ): Promise<T> {
    for (let i = 0; i < RTN_CREATE_MAX_RETRIES; i++) {
      const rtnNumber = await this.rtnIds.generate();
      try {
        return await fn(rtnNumber);
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
    // All retries were P2002 collisions
    throw new InternalServerErrorException(
      'Could not generate a unique return number after multiple attempts',
    );
  }
}
