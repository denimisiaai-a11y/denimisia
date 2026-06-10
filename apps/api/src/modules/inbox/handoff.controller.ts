import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  ServiceUnavailableException,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Sse,
  Query,
  Logger,
  Header,
} from '@nestjs/common';
import { Observable, map, from, merge } from 'rxjs';
import { IdentityCaptureService } from './identity-capture.service';
import { ThreadService } from './thread.service';
import { MessageService } from './message.service';
import { MagicLinkService } from './magic-link.service';
import { MessageBroadcaster } from './message.broadcaster';
import { EmailNotifier } from './email-notifier.service';
import { RateLimit } from './rate-limit.guard';
import { AutoReplyService } from './auto-reply.service';
import { MessageSender, ThreadCloseReason, InboxMessage } from '@prisma/client';
import { ImageRef } from './inbox.types';

interface StartBody {
  name: string;
  email: string;
  phone: string;
  sessionId: string;
  userId?: string;
  honeypot?: string;
}

interface MessageBody {
  body: string;
  images?: ImageRef[];
}

@Controller('inbox')
export class HandoffController {
  private readonly logger = new Logger(HandoffController.name);

  constructor(
    private readonly identity: IdentityCaptureService,
    private readonly thread: ThreadService,
    private readonly message: MessageService,
    private readonly magicLink: MagicLinkService,
    private readonly broadcaster: MessageBroadcaster,
    private readonly emailNotifier: EmailNotifier,
    private readonly rateLimit: RateLimit,
    private readonly autoReply: AutoReplyService,
  ) {}

  private checkFlag(): void {
    if (process.env.INBOX_ENABLED !== 'true') {
      throw new ServiceUnavailableException('inbox disabled');
    }
  }

  private async requireToken(authHeader: string | undefined, threadId: string): Promise<void> {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('missing token');
    const token = authHeader.slice('Bearer '.length);
    const payload = await this.magicLink.verify(token);
    if (payload.threadId !== threadId) throw new UnauthorizedException('token mismatch');
  }

  @Post('handoff/start')
  async start(
    @Body() body: StartBody,
    @Headers('x-forwarded-for') ip: string,
  ): Promise<{ threadId: string; magicToken: string }> {
    this.checkFlag();

    // Honeypot — bots that fill this field get a fake-success response.
    if (body.honeypot && body.honeypot.trim().length > 0) {
      return { threadId: 'honeypot', magicToken: 'noop' };
    }

    const ipKey = ip || 'unknown';
    const ipDecision = this.rateLimit.checkAndRecord({ kind: 'new_thread_ip', key: ipKey });
    if (!ipDecision.allowed) throw new HttpException('rate limit', HttpStatus.TOO_MANY_REQUESTS);

    const captured = await this.identity.capture(body);
    if (!captured.ok) throw new BadRequestException(captured.reason);
    const norm = captured.normalized!;

    const t = await this.thread.create({
      guestName: norm.name,
      guestEmail: norm.email,
      guestPhone: norm.phone,
      userId: body.userId ?? captured.userId,
    });
    const token = await this.magicLink.mint(t.id);
    return { threadId: t.id, magicToken: token };
  }

  @Post('handoff/threads/:id/messages')
  async sendMessage(
    @Param('id') threadId: string,
    @Body() body: MessageBody,
    @Headers('authorization') auth: string,
  ): Promise<{ id: string }> {
    this.checkFlag();
    await this.requireToken(auth, threadId);

    const rl = this.rateLimit.checkAndRecord({ kind: 'thread_message', key: threadId });
    if (!rl.allowed) throw new HttpException('rate limit', HttpStatus.TOO_MANY_REQUESTS);

    const t = await this.thread.get(threadId);
    if (!t) throw new BadRequestException('thread not found');

    await this.thread.markActive(threadId);

    const msg = await this.message.append({
      threadId,
      sender: MessageSender.CUSTOMER,
      body: body.body,
      images: body.images,
    });
    this.broadcaster.publishThread(threadId, msg);

    await this.emailNotifier.notifyAdminOfCustomerMessage({
      threadId,
      customerName: t.guestName,
      preview: body.body,
      isFirstFromCustomer: false,
      lastAdminEmailAt: t.lastAdminEmailAt,
    });

    // Kick the bot to reply immediately (unless admin has it paused).
    this.autoReply.trigger(threadId);

    return { id: msg.id };
  }

  @Post('handoff/threads/:id/resolve')
  async customerResolve(
    @Param('id') threadId: string,
    @Headers('authorization') auth: string,
  ): Promise<{ ok: true }> {
    this.checkFlag();
    await this.requireToken(auth, threadId);
    await this.thread.close(threadId, ThreadCloseReason.CUSTOMER_RESOLVED);
    return { ok: true };
  }

  @Get('handoff/threads/:id/messages')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('CDN-Cache-Control', 'no-store')
  async listMessages(
    @Param('id') threadId: string,
    @Headers('authorization') auth: string,
  ): Promise<InboxMessage[]> {
    this.checkFlag();
    await this.requireToken(auth, threadId);
    // While the customer is actively polling, opportunistically check whether
    // an auto-bot-reply is due for this thread. Fire-and-forget so the GET
    // returns immediately.
    this.autoReply.trigger(threadId);
    return this.message.list(threadId);
  }

  @Sse('handoff/threads/:id/stream')
  stream(
    @Param('id') threadId: string,
    @Query('token') token: string,
    @Query('lastMessageId') lastMessageId: string | undefined,
  ): Observable<MessageEvent> {
    this.checkFlag();
    // SSE uses a query-string token because EventSource cannot send custom headers.
    // We validate synchronously by calling verify and propagating any rejection.
    const verify$ = from(this.magicLink.verify(token)).pipe(
      map((payload) => {
        if (payload.threadId !== threadId) {
          throw new UnauthorizedException('token mismatch');
        }
        return null;
      }),
    );

    const replay = lastMessageId ? this.broadcaster.replayAfter(threadId, lastMessageId) : [];
    const replay$ = from(replay);
    const live$ = this.broadcaster.subscribeThread(threadId);

    return merge(verify$, replay$, live$).pipe(
      map((m) => {
        if (m == null) {
          return { type: 'ready', data: { ok: true } } as unknown as MessageEvent;
        }
        // NestJS @Sse serializes `data` itself — pass the object directly,
        // never pre-stringify or it ends up double-encoded at the client.
        return {
          id: (m as InboxMessage).id,
          type: 'message',
          data: m,
        } as unknown as MessageEvent;
      }),
    );
  }

  @Post('handoff/magic/verify')
  async verifyMagicLink(@Body() body: { token: string }): Promise<{ threadId: string }> {
    this.checkFlag();
    return this.magicLink.verify(body.token);
  }
}
