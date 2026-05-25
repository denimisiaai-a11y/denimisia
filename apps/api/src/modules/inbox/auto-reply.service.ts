import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotSuggestService } from './bot-suggest.service';
import { MessageService } from './message.service';
import { MessageBroadcaster } from './message.broadcaster';
import { EmailNotifier } from './email-notifier.service';
import { MessageSender } from '@prisma/client';

@Injectable()
export class AutoReplyService {
  private readonly logger = new Logger(AutoReplyService.name);
  private readonly inflight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly botSuggest: BotSuggestService,
    private readonly message: MessageService,
    private readonly broadcaster: MessageBroadcaster,
    private readonly emailNotifier: EmailNotifier,
  ) {}

  private minutes(): number {
    return parseInt(process.env.INBOX_AUTO_BOT_REPLY_MINUTES ?? '0', 10);
  }

  // Fire-and-forget. Called from any customer poll. Returns immediately;
  // the actual LLM + send happens in the background. Multiple concurrent
  // calls for the same thread are de-duped via the inflight set.
  trigger(threadId: string): void {
    if (this.inflight.has(threadId)) return;
    const minutes = this.minutes();
    if (minutes <= 0) return;
    this.inflight.add(threadId);
    void this.run(threadId, minutes).finally(() => this.inflight.delete(threadId));
  }

  private async run(threadId: string, idleMinutes: number): Promise<void> {
    try {
      const thread = await this.prisma.inboxThread.findUnique({
        where: { id: threadId },
        select: {
          id: true,
          status: true,
          guestEmail: true,
          guestName: true,
          customerLastSeenAt: true,
          consecutiveAdminMessages: true,
          lastMessageAt: true,
        },
      });
      if (!thread || thread.status !== 'OPEN') return;

      const idleMs = idleMinutes * 60 * 1000;
      if (Date.now() - thread.lastMessageAt.getTime() < idleMs) return;

      // Look at the latest message. If it's not from the customer (admin or
      // bot already replied), nothing to do.
      const latest = await this.prisma.inboxMessage.findFirst({
        where: { threadId },
        orderBy: { createdAt: 'desc' },
      });
      if (!latest || latest.sender !== MessageSender.CUSTOMER) return;

      // Generate the LLM-grounded reply from the latest customer message.
      const draft = await this.botSuggest.suggest(latest.body);
      if (!draft.body || draft.body.trim().length === 0) return;

      const msg = await this.message.append({
        threadId,
        sender: MessageSender.BOT,
        body: draft.body,
        inReplyToId: latest.id,
      });
      this.broadcaster.publishThread(threadId, msg);

      await this.emailNotifier.notifyCustomerOfAdminReply({
        threadId,
        customerEmail: thread.guestEmail,
        customerName: thread.guestName,
        body: draft.body,
        isFirstAdminReply: thread.consecutiveAdminMessages === 0,
        consecutiveAdminMessages: thread.consecutiveAdminMessages + 1,
        customerLastSeenAt: thread.customerLastSeenAt,
      });
    } catch (err) {
      this.logger.warn(`auto-reply failed for ${threadId}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
