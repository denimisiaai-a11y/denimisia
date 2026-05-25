import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [PrismaModule, EmailModule, BotModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class InboxModule {}
