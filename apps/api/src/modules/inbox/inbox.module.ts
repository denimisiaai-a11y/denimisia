import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { BotModule } from '../bot/bot.module';
import { MagicLinkService } from './magic-link.service';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    BotModule,
    JwtModule.register({}),
  ],
  controllers: [],
  providers: [MagicLinkService],
  exports: [MagicLinkService],
})
export class InboxModule {}
