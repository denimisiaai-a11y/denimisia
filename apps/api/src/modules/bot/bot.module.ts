import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BotSynonymsService } from './bot.synonyms.service';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [BotSynonymsService],
  exports: [BotSynonymsService],
})
export class BotModule {}
