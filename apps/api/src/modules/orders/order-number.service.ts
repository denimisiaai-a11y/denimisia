import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderNumberService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next order number by reading the current maximum from
   * the database. Format: `DEN-NNNNNN` with a 6-digit zero-padded
   * sequence. Unlike RTN numbers, order numbers are NOT scoped by year —
   * we use a single flat sequence across all orders so customers see one
   * memorable identifier.
   *
   * NOTE: This function is NOT safe against concurrent callers. Two
   * simultaneous calls may produce the same number. The caller is
   * responsible for collision-safe insertion (see
   * `createOrderWithNumberRetry` in orders.service.ts).
   */
  async generate(): Promise<string> {
    const prefix = 'DEN-';
    const latest = await this.prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    let next = 1;
    if (latest?.orderNumber) {
      const seq = parseInt(latest.orderNumber.slice(prefix.length), 10);
      if (Number.isNaN(seq)) {
        throw new InternalServerErrorException(
          `Malformed orderNumber in database: ${latest.orderNumber}`,
        );
      }
      next = seq + 1;
    }
    return `${prefix}${String(next).padStart(6, '0')}`;
  }
}
