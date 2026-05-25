import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageSender, InboxMessage } from '@prisma/client';
import { ImageRef } from './inbox.types';

export interface AppendInput {
  threadId: string;
  sender: MessageSender;
  body: string;
  images?: ImageRef[];
  inReplyToId?: string;
}

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendInput): Promise<InboxMessage> {
    const message = await this.prisma.inboxMessage.create({
      data: {
        threadId: input.threadId,
        sender: input.sender,
        body: input.body,
        images: input.images as object | undefined,
        inReplyToId: input.inReplyToId ?? null,
      },
    });

    const now = new Date();
    const threadUpdate =
      input.sender === MessageSender.CUSTOMER
        ? {
            lastMessageAt: now,
            consecutiveAdminMessages: 0,
            customerLastSeenAt: now,
          }
        : {
            lastMessageAt: now,
            consecutiveAdminMessages: { increment: 1 },
          };

    await this.prisma.inboxThread.update({
      where: { id: input.threadId },
      data: threadUpdate,
    });

    return message;
  }

  list(threadId: string): Promise<InboxMessage[]> {
    return this.prisma.inboxMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  replayAfter(threadId: string, lastMessageId: string): Promise<InboxMessage[]> {
    return this.prisma.inboxMessage.findMany({
      where: { threadId, id: { gt: lastMessageId } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
