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

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    BotModule,
    MediaModule,
    JwtModule.register({}),
  ],
  controllers: [],
  providers: [
    MagicLinkService,
    IdentityCaptureService,
    ThreadService,
    MessageService,
    RateLimit,
    ImageAttachService,
    MessageBroadcaster,
  ],
  exports: [
    MagicLinkService,
    IdentityCaptureService,
    ThreadService,
    MessageService,
    RateLimit,
    ImageAttachService,
    MessageBroadcaster,
  ],
})
export class InboxModule {}
