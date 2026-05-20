import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RefundMethod } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReturnsRefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Issues a refund for a return in INSPECTED_PASS or INSPECTED_FAIL+override state.
   * Atomically:
   * 1. Creates a RefundTransaction ledger row (immutable)
   * 2. Updates the Return to REFUNDED + stamps refundAmount/Method/Reference
   * 3. Restores variant inventory for items marked restock=true with PASS
   * Emits `return.refunded` event.
   */
  async issueRefund(args: {
    returnId: string;
    adminId: string;
    amount: number;
    method: RefundMethod;
    reference: string;
    notes?: string;
    overrideFromFail: boolean;
  }) {
    const ret = await this.prisma.return.findUnique({
      where: { id: args.returnId },
      include: {
        order: { select: { total: true } },
        items: {
          include: {
            orderItem: { include: { variant: true } },
          },
        },
        refundTxn: true,
      },
    });
    if (!ret) throw new NotFoundException();
    if (ret.refundTxn) {
      throw new BadRequestException(
        'Refund has already been issued for this return',
      );
    }

    if (ret.order) {
      const orderTotal = new Prisma.Decimal(ret.order.total as unknown as string);
      const requestedAmount = new Prisma.Decimal(args.amount);
      if (requestedAmount.greaterThan(orderTotal)) {
        throw new BadRequestException(
          `Refund amount ${requestedAmount.toFixed(2)} exceeds order total ${orderTotal.toFixed(2)}`,
        );
      }
    }

    const validFromState =
      ret.status === 'INSPECTED_PASS' ||
      (ret.status === 'INSPECTED_FAIL' && args.overrideFromFail);
    if (!validFromState) {
      throw new BadRequestException(
        `Cannot refund from status ${ret.status}` +
          (ret.status === 'INSPECTED_FAIL'
            ? ' without overrideFromFail=true'
            : ''),
      );
    }

    // Restock policy:
    //   * PASS + restock=true is the gate.
    //   * Bundle component lines restock the constituent variant
    //     (recorded at return time as bundleComponentVariantId — see
    //     ReturnItem schema). The whole-bundle OrderItem has no variant.
    //   * Regular order lines restock the OrderItem.variantId.
    //   * Manual lines without an orderItem AND without a component id
    //     have nothing to restock — skipped.
    const restockOps: Prisma.PrismaPromise<unknown>[] = [];
    for (const item of ret.items) {
      const shouldRestock = item.inspectionResult === 'PASS' && item.restock;
      if (!shouldRestock) continue;

      // Bundle constituent: restock the variant captured at return time.
      if (item.bundleComponentVariantId) {
        restockOps.push(
          this.prisma.productVariant.update({
            where: { id: item.bundleComponentVariantId },
            data: { stock: { increment: item.quantity } },
          }),
        );
        continue;
      }

      // Regular variant line.
      if (item.orderItem?.variantId) {
        restockOps.push(
          this.prisma.productVariant.update({
            where: { id: item.orderItem.variantId },
            data: { stock: { increment: item.quantity } },
          }),
        );
      }
    }

    const now = new Date();
    const amountDecimal = new Prisma.Decimal(args.amount);

    const [txn] = await this.prisma.$transaction(
      [
        this.prisma.refundTransaction.create({
          data: {
            returnId: ret.id,
            amount: amountDecimal,
            method: args.method,
            reference: args.reference,
            notes: args.notes,
            issuedById: args.adminId,
          },
        }),
        this.prisma.return.update({
          where: { id: ret.id },
          data: {
            status: 'REFUNDED',
            refundAmount: amountDecimal,
            refundMethod: args.method,
            refundReference: args.reference,
            refundedAt: now,
          },
        }),
        ...restockOps,
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.events.emit('return.refunded', {
      returnId: ret.id,
      rtnNumber: ret.rtnNumber,
      amount: args.amount,
      method: args.method,
      adminId: args.adminId,
    });

    return txn;
  }

  /**
   * Pure helper: refund per item in a bundle = discounted bundle price / item count.
   * Rounded to 2 decimals.
   */
  computeBundleItemRefund(args: {
    bundleDiscountedPrice: number;
    bundleItemCount: number;
  }): number {
    if (args.bundleItemCount <= 0) return 0;
    return (
      Math.round((args.bundleDiscountedPrice / args.bundleItemCount) * 100) /
      100
    );
  }
}
