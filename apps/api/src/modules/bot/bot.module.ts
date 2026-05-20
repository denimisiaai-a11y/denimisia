import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BotSynonymsService } from './bot.synonyms.service';
import { BotParserService } from './bot.parser.service';
import { BotSearchService } from './bot.search.service';
import { BotSizingService } from './bot.sizing.service';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [BotSynonymsService, BotParserService, BotSearchService, BotSizingService],
  exports: [BotSynonymsService, BotParserService, BotSearchService, BotSizingService],
})
export class BotModule {}
