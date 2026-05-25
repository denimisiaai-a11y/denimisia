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

  private enabled(): boolean {
    return process.env.INBOX_AUTO_BOT_REPLY_ENABLED !== 'false';
  }

  // Fire-and-forget. Bot-first model: bot tries to reply to every customer
  // message unless the admin has paused the bot for this thread. The pause
  // is time-bound (set by the admin endpoint) so the bot resumes automatically
  // if the admin gets distracted and doesn't unpause.
  trigger(threadId: string): void {
    if (this.inflight.has(threadId)) return;
    if (!this.enabled()) return;
    this.inflight.add(threadId);
    void this.run(threadId).finally(() => this.inflight.delete(threadId));
  }

  private async run(threadId: string): Promise<void> {
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
          botPausedUntil: true,
        },
      });
      if (!thread || thread.status !== 'OPEN') return;

      // Admin has the bot on pause — back off.
      if (thread.botPausedUntil && thread.botPausedUntil.getTime() > Date.now()) {
        return;
      }

      // Look at the latest message. If it's not from the customer (admin or
      // bot already replied), nothing to do.
      const latest = await this.prisma.inboxMessage.findFirst({
        where: { threadId },
        orderBy: { createdAt: 'desc' },
      });
      if (!latest || latest.sender !== MessageSender.CUSTOMER) return;

      // Generate the LLM-grounded reply.
      const draft = await this.botSuggest.suggest(latest.body);
      if (!draft.body || draft.body.trim().length === 0) return;

      // Race check: between when we started generating and now, did an admin
      // (or another bot tick) reply? If so, discard this draft to avoid
      // talking over the admin.
      const stillLatest = await this.prisma.inboxMessage.findFirst({
        where: { threadId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, sender: true },
      });
      if (!stillLatest || stillLatest.id !== latest.id) return;

      // Re-check pause — admin may have hit pause while we were generating.
      const checkPause = await this.prisma.inboxThread.findUnique({
        where: { id: threadId },
        select: { botPausedUntil: true },
      });
      if (
        checkPause?.botPausedUntil &&
        checkPause.botPausedUntil.getTime() > Date.now()
      ) {
        return;
      }

      const msg = await this.message.append({
        threadId,
        sender: MessageSender.BOT,
        body: draft.body,
        inReplyToId: latest.id,
      });
      this.broadcaster.publishThread(threadId, msg);

      // Customer notifications still flow through the same throttling rules
      // — first reply emails the magic link, subsequent ones nudge if away.
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
