import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ThreadStatus, ThreadCloseReason, InboxThread } from '@prisma/client';

export interface CreateThreadInput {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  userId?: string;
}

export interface ListAdminOpts {
  status?: ThreadStatus;
  limit?: number;
}

@Injectable()
export class ThreadService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateThreadInput): Promise<InboxThread> {
    return this.prisma.inboxThread.create({
      data: {
        status: ThreadStatus.OPEN,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        userId: input.userId ?? null,
      },
    });
  }

  async close(threadId: string, reason: ThreadCloseReason): Promise<void> {
    await this.prisma.inboxThread.update({
      where: { id: threadId },
      data: {
        status: ThreadStatus.CLOSED,
        closeReason: reason,
        closedAt: new Date(),
      },
    });
  }

  async markActive(threadId: string): Promise<void> {
    const t = await this.prisma.inboxThread.findUnique({ where: { id: threadId } });
    if (!t || t.status === ThreadStatus.OPEN) return;
    await this.prisma.inboxThread.update({
      where: { id: threadId },
      data: { status: ThreadStatus.OPEN, closeReason: null, closedAt: null },
    });
  }

  async listForAdmin(opts: ListAdminOpts): Promise<InboxThread[]> {
    return this.prisma.inboxThread.findMany({
      where: { status: opts.status ?? ThreadStatus.OPEN },
      orderBy: { lastMessageAt: 'desc' },
      take: opts.limit ?? 50,
    });
  }

  async get(threadId: string): Promise<InboxThread | null> {
    return this.prisma.inboxThread.findUnique({ where: { id: threadId } });
  }

  async setBotPaused(threadId: string, until: Date | null): Promise<void> {
    await this.prisma.inboxThread.update({
      where: { id: threadId },
      data: { botPausedUntil: until },
    });
  }
}
