import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RtnIdService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next RTN number for the given year by reading the current
   * maximum from the database. Format: `RTN-YYYY-NNNNNN` with a 6-digit
   * zero-padded sequence.
   *
   * NOTE: This function is NOT safe against concurrent callers. Two simultaneous
   * calls may produce the same number. The caller is responsible for
   * collision-safe insertion (see `tryCreateWithRtnRetry` in returns.service.ts,
   * Task 3).
   */
  async generate(year: number = new Date().getUTCFullYear()): Promise<string> {
    const prefix = `RTN-${year}-`;
    const latest = await this.prisma.return.findFirst({
      where: { rtnNumber: { startsWith: prefix } },
      orderBy: { rtnNumber: 'desc' },
      select: { rtnNumber: true },
    });
    let next = 1;
    if (latest) {
      const seq = parseInt(latest.rtnNumber.slice(prefix.length), 10);
      if (Number.isNaN(seq)) {
        throw new InternalServerErrorException(
          `Malformed rtnNumber in database: ${latest.rtnNumber}`,
        );
      }
      next = seq + 1;
    }
    return `${prefix}${String(next).padStart(6, '0')}`;
  }
}
