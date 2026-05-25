import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BotController } from './bot.controller';
import { BotSynonymsService } from './bot.synonyms.service';
import { BotParserService } from './bot.parser.service';
import { BotSearchService } from './bot.search.service';
import { BotSizingService } from './bot.sizing.service';
import { BotFallbackService } from './fallback/bot.fallback.service';
import { InputSanitizer } from './fallback/input.sanitizer';
import { OutputFilter } from './fallback/output.filter';
import { QuotaGuard } from './fallback/quota.guard';
import { ResponseCache } from './fallback/response.cache';
import { KbFaqLoader } from './fallback/kb.faq.loader';
import { KbRetriever } from './fallback/kb.retriever';
import { PromptBuilder } from './fallback/prompt.builder';
import { CloudflareAiClient } from './fallback/cloudflare-ai.client';
import { AuditLog } from './fallback/audit.log';
import { PurgeAuditQueryPreviewHandler } from './fallback/purge.handler';

@Module({
  imports: [PrismaModule],
  controllers: [BotController],
  providers: [
    BotSynonymsService,
    BotParserService,
    BotSearchService,
    BotSizingService,
    BotFallbackService,
    InputSanitizer,
    OutputFilter,
    QuotaGuard,
    ResponseCache,
    KbFaqLoader,
    KbRetriever,
    PromptBuilder,
    CloudflareAiClient,
    AuditLog,
    PurgeAuditQueryPreviewHandler,
  ],
  exports: [
    BotSynonymsService,
    BotParserService,
    BotSearchService,
    BotSizingService,
    BotFallbackService,
  ],
})
export class BotModule {}
