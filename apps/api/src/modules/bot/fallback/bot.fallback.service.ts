import { Injectable } from '@nestjs/common';
import { InputSanitizer } from './input.sanitizer';
import { QuotaGuard } from './quota.guard';
import { ResponseCache } from './response.cache';
import { KbRetriever, RetrievedContext } from './kb.retriever';
import { PromptBuilder } from './prompt.builder';
import { CloudflareAiClient } from './cloudflare-ai.client';
import { OutputFilter } from './output.filter';
import { AuditLog } from './audit.log';

export interface FallbackInput {
  message: string;
  sessionId: string;
  userId?: string;
}

export interface FallbackOutput {
  message: string;
  chips: string[];
}

const CANNED =
  "I can't help with that one. Try /track-order to check on an order, or leave a message for our team.";
const CANNED_CHIPS = ['Track my order', 'Leave a message'];
const MODEL = '@cf/meta/llama-3.1-8b-instruct';
const NEURONS_PER_CALL = 11;

const isFlagEnabled = (): boolean => process.env.BOT_LLM_FALLBACK_ENABLED === 'true';

@Injectable()
export class BotFallbackService {
  constructor(
    private readonly sanitizer: InputSanitizer,
    private readonly quota: QuotaGuard,
    private readonly cache: ResponseCache,
    private readonly retriever: KbRetriever,
    private readonly prompt: PromptBuilder,
    private readonly cf: CloudflareAiClient,
    private readonly filter: OutputFilter,
    private readonly audit: AuditLog,
  ) {}

  async answer(input: FallbackInput): Promise<FallbackOutput> {
    if (!isFlagEnabled()) {
      return { message: CANNED, chips: CANNED_CHIPS };
    }

    const sanitized = this.sanitizer.scrub(input.message);
    if (sanitized.severity === 'high') {
      await this.safeAudit(input, '', '', {}, false, 'injection_flagged', false, true);
      return { message: CANNED, chips: CANNED_CHIPS };
    }

    const cached = await this.cache.get(sanitized.text);
    if (cached) {
      await this.safeAudit(input, sanitized.text, cached, { cache: true }, true, undefined, false, false);
      return { message: cached, chips: this.deriveChips({ faqChunks: [], products: [], userOrders: [] }) };
    }

    const quotaOk = await this.quota.check();
    if (!quotaOk) {
      await this.safeAudit(input, sanitized.text, '', {}, false, 'quota_exhausted', false, false);
      return { message: CANNED, chips: CANNED_CHIPS };
    }

    let ctx: RetrievedContext;
    let promptParts: { system: string; user: string };
    let reply: string;
    try {
      ctx = await this.retriever.retrieve(sanitized.text, { userId: input.userId });
      promptParts = this.prompt.compose(sanitized.text, ctx);
      reply = await this.cf.run(MODEL, promptParts.system, promptParts.user);
    } catch (_err) {
      await this.safeAudit(input, sanitized.text, '', {}, false, 'upstream_error', false, false);
      return { message: CANNED, chips: CANNED_CHIPS };
    }

    if (!reply || reply.length < 10 || reply.length > 800) {
      await this.safeAudit(input, sanitized.text, reply ?? '', {}, false, 'invalid_output', false, false);
      return { message: CANNED, chips: CANNED_CHIPS };
    }

    const filtered = this.filter.scrub(reply);
    if (filtered.patternCount >= 2) {
      await this.safeAudit(input, sanitized.text, reply, {}, false, 'pii_leak_suspected', true, false);
      return { message: CANNED, chips: CANNED_CHIPS };
    }

    await this.quota.recordUsage(NEURONS_PER_CALL);
    await this.cache.set(sanitized.text, filtered.filtered, {
      faqHeadings: ctx.faqChunks.map((c) => c.heading),
      productIds: ctx.products.map((p) => p.id),
      orderNumbers: ctx.userOrders.map((o) => o.orderNumber),
    });
    await this.safeAudit(
      input,
      `${promptParts.system}\n${promptParts.user}`,
      filtered.filtered,
      {
        faqHeadings: ctx.faqChunks.map((c) => c.heading),
        productIds: ctx.products.map((p) => p.id),
        orderNumbers: ctx.userOrders.map((o) => o.orderNumber),
      },
      true,
      undefined,
      filtered.hadStripping,
      false,
    );

    return { message: filtered.filtered, chips: this.deriveChips(ctx) };
  }

  private deriveChips(ctx: RetrievedContext): string[] {
    const chips: string[] = [];
    if (ctx.userOrders.length > 0) chips.push('Track my order');
    if (ctx.products.length > 0) chips.push(`See ${ctx.products[0].name}`);
    chips.push('Leave a message');
    return Array.from(new Set(chips)).slice(0, 3);
  }

  private async safeAudit(
    input: FallbackInput,
    promptRaw: string,
    replyRaw: string,
    retrievedSources: object,
    success: boolean,
    errorCode: string | undefined,
    outputFiltered: boolean,
    injectionFlagged: boolean,
  ): Promise<void> {
    try {
      await this.audit.write({
        sessionId: input.sessionId,
        userId: input.userId,
        queryPreview: input.message,
        promptRaw,
        replyRaw,
        retrievedSources,
        success,
        errorCode,
        outputFiltered,
        injectionFlagged,
      });
    } catch {
      // audit failure never surfaces to the user
    }
  }
}
