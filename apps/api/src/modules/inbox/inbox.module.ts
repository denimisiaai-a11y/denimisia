import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { BotModule } from '../bot/bot.module';
import { MediaModule } from '../media/media.module';
import { MagicLinkService } from './magic-link.service';
import { IdentityCaptureService } from './identity-capture.service';
import { ThreadService } from './thread.service';
import { MessageService } from './message.service';
import { RateLimit } from './rate-limit.guard';
import { ImageAttachService } from './image-attach.service';
import { MessageBroadcaster } from './message.broadcaster';
import { EmailNotifier } from './email-notifier.service';
import { BotSuggestService } from './bot-suggest.service';
import { HandoffController } from './handoff.controller';
import { AdminInboxController } from './admin-inbox.controller';
import { InactivityCloseHandler } from './inactivity-job.handler';
import { InboxDigestHandler } from './digest-job.handler';
import { AutoReplyService } from './auto-reply.service';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    BotModule,
    MediaModule,
    JwtModule.register({}),
  ],
  controllers: [HandoffController, AdminInboxController],
  providers: [
    MagicLinkService,
    IdentityCaptureService,
    ThreadService,
    MessageService,
    RateLimit,
    ImageAttachService,
    MessageBroadcaster,
    EmailNotifier,
    BotSuggestService,
    InactivityCloseHandler,
    InboxDigestHandler,
    AutoReplyService,
  ],
  exports: [
    MagicLinkService,
    IdentityCaptureService,
    ThreadService,
    MessageService,
    RateLimit,
    ImageAttachService,
    MessageBroadcaster,
    EmailNotifier,
    BotSuggestService,
    InactivityCloseHandler,
    InboxDigestHandler,
    AutoReplyService,
  ],
})
export class InboxModule {}
