import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Sse,
  ServiceUnavailableException,
  BadRequestException,
  Header,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { ThreadService } from './thread.service';
import { MessageService } from './message.service';
import { MessageBroadcaster } from './message.broadcaster';
import { EmailNotifier } from './email-notifier.service';
import { BotSuggestService } from './bot-suggest.service';
import { InactivityCloseHandler } from './inactivity-job.handler';
import { InboxDigestHandler } from './digest-job.handler';
import {
  MessageSender,
  ThreadCloseReason,
  ThreadStatus,
  InboxThread,
  InboxMessage,
} from '@prisma/client';
import { ImageRef } from './inbox.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
@Controller('inbox/admin')
export class AdminInboxController {
  constructor(
    private readonly thread: ThreadService,
    private readonly message: MessageService,
    private readonly broadcaster: MessageBroadcaster,
    private readonly emailNotifier: EmailNotifier,
    private readonly botSuggest: BotSuggestService,
    private readonly inactivity: InactivityCloseHandler,
    private readonly digest: InboxDigestHandler,
  ) {}

  private checkFlag(): void {
    if (process.env.INBOX_ENABLED !== 'true') {
      throw new ServiceUnavailableException('inbox disabled');
    }
  }

  @Get('threads')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async list(@Query('status') status?: string): Promise<InboxThread[]> {
    this.checkFlag();
    const filter = status === 'CLOSED' ? ThreadStatus.CLOSED : ThreadStatus.OPEN;
    return this.thread.listForAdmin({ status: filter, limit: 50 });
  }

  @Get('threads/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async detail(@Param('id') id: string): Promise<(InboxThread & { messages: InboxMessage[] }) | null> {
    this.checkFlag();
    const t = await this.thread.get(id);
    if (!t) return null;
    const messages = await this.message.list(id);
    return { ...t, messages };
  }

  @Post('threads/:id/messages')
  async reply(
    @Param('id') id: string,
    @Body() body: { body: string; images?: ImageRef[]; inReplyToId?: string },
  ): Promise<{ id: string }> {
    this.checkFlag();
    const t = await this.thread.get(id);
    if (!t) throw new BadRequestException('thread not found');

    const isFirstAdminReply = t.consecutiveAdminMessages === 0;

    const msg = await this.message.append({
      threadId: id,
      sender: MessageSender.ADMIN,
      body: body.body,
      images: body.images,
      inReplyToId: body.inReplyToId,
    });
    this.broadcaster.publishThread(id, msg);

    await this.emailNotifier.notifyCustomerOfAdminReply({
      threadId: id,
      customerEmail: t.guestEmail,
      customerName: t.guestName,
      body: body.body,
      isFirstAdminReply,
      consecutiveAdminMessages: t.consecutiveAdminMessages + 1,
      customerLastSeenAt: t.customerLastSeenAt,
    });

    return { id: msg.id };
  }

  @Post('threads/:id/close')
  async close(@Param('id') id: string): Promise<{ ok: true }> {
    this.checkFlag();
    await this.thread.close(id, ThreadCloseReason.ADMIN_RESOLVED);
    return { ok: true };
  }

  @Post('threads/:id/reopen')
  async reopen(@Param('id') id: string): Promise<{ ok: true }> {
    this.checkFlag();
    await this.thread.markActive(id);
    return { ok: true };
  }

  @Post('threads/:id/pause-bot')
  async pauseBot(
    @Param('id') id: string,
    @Body() body: { minutes?: number },
  ): Promise<{ botPausedUntil: string }> {
    this.checkFlag();
    const minutes = Math.max(1, Math.min(60, body.minutes ?? 5));
    const until = new Date(Date.now() + minutes * 60 * 1000);
    await this.thread.setBotPaused(id, until);
    return { botPausedUntil: until.toISOString() };
  }

  @Post('threads/:id/resume-bot')
  async resumeBot(@Param('id') id: string): Promise<{ ok: true }> {
    this.checkFlag();
    await this.thread.setBotPaused(id, null);
    return { ok: true };
  }

  @Post('threads/:id/bot-suggest')
  async botSuggestEndpoint(
    @Param('id') _id: string,
    @Body() body: { customerMessage: string },
  ): Promise<{ body: string; note?: string }> {
    this.checkFlag();
    return this.botSuggest.suggest(body.customerMessage);
  }

  @Post('threads/:id/bot-reply')
  async botReplyEndpoint(
    @Param('id') id: string,
    @Body() body: { customerMessage: string },
  ): Promise<{ id: string; body: string }> {
    this.checkFlag();
    const t = await this.thread.get(id);
    if (!t) throw new BadRequestException('thread not found');

    const draft = await this.botSuggest.suggest(body.customerMessage);
    if (!draft.body || draft.body.trim().length === 0) {
      throw new BadRequestException('bot could not generate a reply');
    }

    const isFirstAdminReply = t.consecutiveAdminMessages === 0;
    const msg = await this.message.append({
      threadId: id,
      sender: MessageSender.BOT,
      body: draft.body,
    });
    this.broadcaster.publishThread(id, msg);

    await this.emailNotifier.notifyCustomerOfAdminReply({
      threadId: id,
      customerEmail: t.guestEmail,
      customerName: t.guestName,
      body: draft.body,
      isFirstAdminReply,
      consecutiveAdminMessages: t.consecutiveAdminMessages + 1,
      customerLastSeenAt: t.customerLastSeenAt,
    });

    return { id: msg.id, body: draft.body };
  }

  @Post('jobs/inactivity-close')
  async runInactivityClose(): Promise<{ closed: number }> {
    this.checkFlag();
    return this.inactivity.run({});
  }

  @Post('jobs/digest')
  async runDigest(): Promise<{ sent: boolean; openCount: number }> {
    this.checkFlag();
    return this.digest.run({});
  }

  @Sse('stream')
  adminStream(): Observable<MessageEvent> {
    this.checkFlag();
    return this.broadcaster.subscribeAdmin().pipe(
      map(
        (evt) =>
          ({
            id: evt.message.id,
            type: 'admin-event',
            data: evt,
          }) as unknown as MessageEvent,
      ),
    );
  }
}
