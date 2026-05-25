import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { BotModule } from '../bot/bot.module';
import { MagicLinkService } from './magic-link.service';
import { IdentityCaptureService } from './identity-capture.service';
import { ThreadService } from './thread.service';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    BotModule,
    JwtModule.register({}),
  ],
  controllers: [],
  providers: [MagicLinkService, IdentityCaptureService, ThreadService],
  exports: [MagicLinkService, IdentityCaptureService, ThreadService],
})
export class InboxModule {}
