import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BotSynonymsService } from './bot.synonyms.service';
import { BotParserService } from './bot.parser.service';
import { BotSearchService } from './bot.search.service';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [BotSynonymsService, BotParserService, BotSearchService],
  exports: [BotSynonymsService, BotParserService, BotSearchService],
})
export class BotModule {}
