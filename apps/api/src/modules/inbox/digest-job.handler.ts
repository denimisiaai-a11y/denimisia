import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { inboxAdminDigest } from '../email/email-templates';
import { ThreadStatus } from '@prisma/client';

@Injectable()
export class InboxDigestHandler {
  static readonly NAME = 'INBOX_DIGEST';
  private readonly logger = new Logger(InboxDigestHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async run(_payload: Record<string, never>): Promise<{ sent: boolean; openCount: number }> {
    const threads = await this.prisma.inboxThread.findMany({
      where: { status: ThreadStatus.OPEN },
      orderBy: { lastMessageAt: 'asc' },
    });
    if (threads.length === 0) {
      return { sent: false, openCount: 0 };
    }
    const oldest = threads[0]?.lastMessageAt;
    const rendered = inboxAdminDigest({
      openCount: threads.length,
      oldestOpenSince: oldest?.toISOString() ?? '',
      threads: threads.slice(0, 20).map((t) => ({
        id: t.id,
        customerName: t.guestName,
        lastMessageAt: t.lastMessageAt.toISOString(),
      })),
    });
    try {
      await this.email.send({
        to: process.env.INBOX_ADMIN_EMAIL ?? 'Denimisia.ai@gmail.com',
        ...rendered,
      });
      return { sent: true, openCount: threads.length };
    } catch (err) {
      this.logger.warn(`digest send failed: ${err instanceof Error ? err.message : err}`);
      return { sent: false, openCount: threads.length };
    }
  }
}
