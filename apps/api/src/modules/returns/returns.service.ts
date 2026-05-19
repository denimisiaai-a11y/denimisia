import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RtnIdService } from './rtn-id.service';
import { CreateReturnDto } from './dto/create-return.dto';
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

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
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

    const created = await this.createWithRtnRetry(async (rtnNumber) =>
      this.prisma.$transaction(
        async (tx) => {
          const orderItemIds = dto.items.map((i) => i.orderItemId);
          const existingQuantities = await tx.returnItem.groupBy({
            by: ['orderItemId'],
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
              .map((row) => [row.orderItemId, row._sum.quantity ?? 0]),
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
              alreadyReturnedQty: alreadyReturnedMap.get(orderItem.id) ?? 0,
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
                create: dto.items.map((i) => ({
                  orderItemId: i.orderItemId,
                  quantity: i.quantity,
                })),
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
