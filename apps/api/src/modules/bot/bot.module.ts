import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BotSynonymsService } from './bot.synonyms.service';
import { BotParserService } from './bot.parser.service';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [BotSynonymsService, BotParserService],
  exports: [BotSynonymsService, BotParserService],
})
export class BotModule {}
