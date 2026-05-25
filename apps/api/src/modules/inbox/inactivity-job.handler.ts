import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadCloseReason, ThreadStatus } from '@prisma/client';

@Injectable()
export class InactivityCloseHandler {
  static readonly NAME = 'INBOX_INACTIVITY_CLOSE';

  constructor(private readonly prisma: PrismaService) {}

  async run(_payload: Record<string, never>): Promise<{ closed: number }> {
    const days = parseInt(process.env.INBOX_INACTIVE_DAYS ?? '14', 10);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.inboxThread.updateMany({
      where: { status: ThreadStatus.OPEN, lastMessageAt: { lt: cutoff } },
      data: {
        status: ThreadStatus.CLOSED,
        closeReason: ThreadCloseReason.INACTIVE_14D,
        closedAt: new Date(),
      },
    });
    return { closed: result.count };
  }
}
