import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BotMessageDto, RecommendSizeDto } from './bot.dto';
import { BotParserService } from './bot.parser.service';
import { BotSearchService } from './bot.search.service';
import { BotSizingService } from './bot.sizing.service';
import { BotSynonymsService } from './bot.synonyms.service';
import { BotFallbackService } from './fallback/bot.fallback.service';
import { PurgeAuditQueryPreviewHandler } from './fallback/purge.handler';
import { SIZING_FLOW_STEPS, VALID_FIT_PREFS } from './bot.constants';
import { BotMessageReply, BotContext } from './bot.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('bot')
export class BotController {
  constructor(
    private readonly parser: BotParserService,
    private readonly search: BotSearchService,
    private readonly sizing: BotSizingService,
    private readonly synonyms: BotSynonymsService,
    private readonly fallback: BotFallbackService,
    private readonly purgeHandler: PurgeAuditQueryPreviewHandler,
    private readonly prisma: PrismaService,
  ) {}

  @Post('message')
  async message(@Body() dto: BotMessageDto): Promise<BotMessageReply> {
    const { text } = dto;
    let ctx = dto.context as BotContext;

    // Escape from the sizing flow if the user typed something that clearly
    // is not a valid answer for the current step (e.g. they got curious and
    // asked an unrelated question). Without this, the flow traps the user
    // because every subsequent message routes through advanceSizingFlow.
    if (ctx.flow?.name === 'sizing') {
      if (this.looksLikeSizingAnswer(text, ctx.flow.step)) {
        return this.advanceSizingFlow(text, ctx);
      }
      ctx = { ...ctx, flow: undefined };
    }

    const intent = this.parser.detectIntent(text);

    if (intent === 'talk_to_support') {
      return {
        message: 'Got it. Let me connect you to our team.',
        chips: ['Leave a message'],
        action: 'offer_handoff',
        nextContext: { ...ctx, unknownStreak: 0 },
      };
    }

    if (intent === 'sizing') {
      return this.startSizingFlow(ctx);
    }

    if (intent === 'whats_new') {
      const products = await this.search.findWhatsNew();
      return {
        message: products.length
          ? "Here's what's new:"
          : 'No new arrivals right now.',
        products,
        chips: ['Pants', 'Shirts', 'Jackets'],
        nextContext: ctx,
      };
    }

    if (intent === 'find') {
      const slots = await this.parser.extractSlots(text);
      const contradictions = this.parser.detectContradictions(slots);
      if (contradictions.length > 0) {
        const c = contradictions[0];
        return {
          message: `Did you mean ${c.values.join(' or ')}?`,
          chips: c.values,
          nextContext: ctx,
        };
      }

      const hasAnySlot =
        slots.type !== undefined ||
        slots.color !== undefined ||
        slots.size !== undefined ||
        slots.tags.length > 0;

      if (!hasAnySlot) {
        await this.prisma.botUnrecognizedQuery.create({
          data: { text, sessionId: ctx.sessionId, gender: ctx.gender ?? null },
        });
        const fb = await this.fallback.answer({
          message: text,
          sessionId: ctx.sessionId,
          userId: undefined,
        });
        return {
          message: fb.message,
          chips: fb.chips,
          nextContext: ctx,
        };
      }

      const products = await this.search.searchBySlots(slots);

      // The rule-based parser is greedy and sometimes extracts spurious
      // slots from natural-language questions (e.g. "what's your policy"
      // extracts size:S from the apostrophe-s). When the search yields
      // nothing AND the input reads like a question, route to the LLM
      // fallback so the user gets a real answer instead of the misleading
      // "No matches in stock" reply.
      if (products.length === 0 && this.looksLikeQuestion(text)) {
        await this.prisma.botUnrecognizedQuery.create({
          data: { text, sessionId: ctx.sessionId, gender: ctx.gender ?? null },
        });
        const fb = await this.fallback.answer({
          message: text,
          sessionId: ctx.sessionId,
          userId: undefined,
        });
        return {
          message: fb.message,
          chips: fb.chips,
          nextContext: ctx,
        };
      }

      const echo = formatSlotEcho(slots);
      return {
        message: products.length
          ? `Got it: ${echo}. Found ${products.length} matches:`
          : `Got it: ${echo}. No matches in stock right now.`,
        products,
        chips: products.length
          ? ['See all matches', 'Different color', 'Different size']
          : ['Try different colour', 'Try different size'],
        nextContext: ctx,
      };
    }

    await this.prisma.botUnrecognizedQuery.create({
      data: { text, sessionId: ctx.sessionId, gender: ctx.gender ?? null },
    });
    const fb = await this.fallback.answer({
      message: text,
      sessionId: ctx.sessionId,
      userId: undefined,
    });
    return {
      message: fb.message,
      chips: fb.chips,
      nextContext: ctx,
    };
  }

  @Post('recommend-size')
  async recommendSize(@Body() dto: RecommendSizeDto) {
    return this.sizing.recommend({
      type: dto.type,
      measurements: dto.measurements,
      fitPref: dto.fitPref as
        | 'slim'
        | 'regular'
        | 'baggy'
        | 'fitted'
        | 'oversized',
    });
  }

  @Get('synonyms')
  async listSynonyms() {
    return {
      categories: await this.synonyms.allForDimension('category'),
      colors: await this.synonyms.allForDimension('color'),
      silhouettes: await this.synonyms.allForDimension('silhouette'),
    };
  }

  // ── Admin: synonym CRUD ──────────────────────────────────────────────
  // Authenticated admin/super-admin only. Mutations invalidate the
  // in-memory synonym cache so the parser picks up changes on the next
  // request without a process restart.

  @Get('admin/synonyms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  async listAllSynonyms() {
    return this.prisma.botSynonym.findMany({
      orderBy: [{ dimension: 'asc' }, { canonical: 'asc' }],
    });
  }

  @Post('admin/synonyms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  async createSynonym(
    @Body() body: { dimension: string; canonical: string; aliases: string[] },
  ) {
    const row = await this.prisma.botSynonym.upsert({
      where: {
        dimension_canonical: {
          dimension: body.dimension,
          canonical: body.canonical,
        },
      },
      create: body,
      update: { aliases: body.aliases },
    });
    this.synonyms.invalidate();
    return row;
  }

  @Delete('admin/synonyms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  async deleteSynonym(@Param('id') id: string) {
    await this.prisma.botSynonym.delete({ where: { id } });
    this.synonyms.invalidate();
    return { ok: true };
  }

  // ── Admin: unrecognized-query log + fit-data coverage ────────────────

  @Get('admin/unrecognized')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  async listUnrecognized(@Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit ?? 50), 1), 500);
    return this.prisma.botUnrecognizedQuery.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  @Get('admin/fallback/recent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  async listRecentFallbacks(@Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    return this.prisma.botLlmAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        sessionId: true,
        userId: true,
        queryPreview: true,
        success: true,
        errorCode: true,
        outputFiltered: true,
        injectionFlagged: true,
        retrievedSources: true,
        createdAt: true,
      },
    });
  }

  @Post('admin/fallback/purge-old-previews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  async purgeOldFallbackPreviews() {
    return this.purgeHandler.run({});
  }

  @Get('admin/fit-data-coverage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  async fitDataCoverage() {
    const baseWhere = { isActive: true, deletedAt: null } as const;
    const total = await this.prisma.product.count({ where: baseWhere });
    const missingType = await this.prisma.product.count({
      where: { ...baseWhere, type: null },
    });
    const missingTags = await this.prisma.product.count({
      where: {
        ...baseWhere,
        type: { not: null },
        productTags: { none: {} },
      },
    });
    const missingCharts = await this.prisma.product.count({
      where: {
        ...baseWhere,
        type: { not: null },
        sizeCharts: { none: {} },
      },
    });
    const missingFitLandmarks = await this.prisma.product.count({
      where: {
        ...baseWhere,
        type: { not: null },
        fitLandmarks: { equals: Prisma.DbNull },
      },
    });
    return {
      total,
      missingType,
      missingTags,
      missingCharts,
      missingFitLandmarks,
    };
  }

  // Heuristic: the message reads like a natural-language question or an
  // FAQ-style query rather than a product filter. Used to short-circuit the
  // rule-based parser when it would produce nonsense slot extractions, and
  // to escape from active flows when the user changes topic.
  private looksLikeQuestion(text: string): boolean {
    const t = text.toLowerCase().trim();
    if (t.endsWith('?')) return true;
    if (/^(what|how|when|where|why|who|do|does|is|are|can|could|should|will|would|may|might|i mean)\b/.test(t)) {
      return true;
    }
    if (
      /\b(policy|policies|return|returns|refund|refunds|payment|pay|cod|shipping|ship|delivery|deliver|contact|hours|address|email|phone|warranty|exchange|exchanges|track|tracking|order|orders)\b/.test(t)
    ) {
      return true;
    }
    return false;
  }

  // Whether the user's input plausibly answers the current sizing-flow step.
  // For the 'type' step we accept the three product categories; for numeric
  // steps we accept a number; for the fit-preference step we accept the
  // known preference labels. Anything else means the user has changed topic.
  private looksLikeSizingAnswer(text: string, step: string): boolean {
    const t = text.toLowerCase().trim();
    if (step === 'type') {
      return /^(pants?|shirts?|jackets?)$/.test(t);
    }
    if (['waist', 'inseam', 'chest', 'length', 'hip', 'shoulder'].includes(step)) {
      return /^\d+(\.\d+)?$/.test(t);
    }
    if (step === 'fitPref' || step === 'fit_pref') {
      return /^(slim|regular|baggy|fitted|oversized)$/.test(t);
    }
    return true; // unknown step — be permissive
  }

  private startSizingFlow(context: BotContext): BotMessageReply {
    return {
      message: 'What are you shopping for?',
      chips: ['Pants', 'Shirts', 'Jackets'],
      nextContext: {
        ...context,
        flow: { name: 'sizing', step: 'type', type: 'PANTS', collected: {} },
      },
    };
  }

  private async advanceSizingFlow(
    text: string,
    context: BotContext,
  ): Promise<BotMessageReply> {
    const flow = context.flow!;
    const step = flow.step;
    const newCollected = { ...flow.collected };

    if (step === 'type') {
      const t = text.trim().toUpperCase() as ProductType;
      const isValid = ['PANTS', 'SHIRTS', 'JACKETS'].includes(t);
      if (!isValid) {
        return {
          message: 'Pick one: Pants, Shirts, or Jackets.',
          chips: ['Pants', 'Shirts', 'Jackets'],
          nextContext: context,
        };
      }
      const steps = SIZING_FLOW_STEPS[t];
      const firstStep = steps[0];
      return {
        message: this.promptForStep(firstStep),
        input: firstStep === 'fitPref' ? 'text' : 'numeric',
        chips: firstStep === 'fitPref' ? this.fitPrefChips(t) : ['Skip'],
        nextContext: {
          ...context,
          flow: { name: 'sizing', step: firstStep, type: t, collected: {} },
        },
      };
    }

    if (step !== 'fitPref') {
      const num = Number(text.replace(/[^\d.]/g, ''));
      if (!Number.isNaN(num) && num > 0) newCollected[step] = num;
    } else {
      const raw = text.toLowerCase();
      newCollected.fitPref = VALID_FIT_PREFS.has(raw) ? raw : 'regular';
    }

    const steps = SIZING_FLOW_STEPS[flow.type];
    const idx = steps.indexOf(step);
    const nextStep = steps[idx + 1];

    if (nextStep) {
      return {
        message: this.promptForStep(nextStep),
        input: nextStep === 'fitPref' ? 'text' : 'numeric',
        chips: nextStep === 'fitPref' ? this.fitPrefChips(flow.type) : ['Skip'],
        nextContext: {
          ...context,
          flow: {
            name: 'sizing',
            step: nextStep,
            type: flow.type,
            collected: newCollected,
          },
        },
      };
    }

    const measurementOnly: Record<string, number> = {};
    for (const [k, v] of Object.entries(newCollected)) {
      if (typeof v === 'number') measurementOnly[k] = v;
    }
    const result = await this.sizing.recommend({
      type: flow.type,
      measurements: measurementOnly,
      fitPref: ((newCollected.fitPref as string) ?? 'regular') as
        | 'slim'
        | 'regular'
        | 'baggy'
        | 'fitted'
        | 'oversized',
    });

    if (!result.recommendedSize) {
      return {
        message: "I couldn't find a match — try a different category.",
        chips: ['Pants', 'Shirts', 'Jackets'],
        nextContext: { ...context, flow: undefined },
      };
    }

    const altText = result.alternativeSize
      ? ` Or **${result.alternativeSize}** for a different fit.`
      : '';
    return {
      message: `You're likely a size **${result.recommendedSize}**.${altText} Here's what's available:`,
      products: result.products,
      chips: ['See all matches', 'Start over'],
      nextContext: { ...context, flow: undefined },
    };
  }

  private promptForStep(step: string): string {
    const prompts: Record<string, string> = {
      waist: "What's your waist measurement?",
      hip: "What's your hip measurement?",
      inseam: "What's your inseam?",
      chest: "What's your chest measurement?",
      shoulder: "What's your shoulder measurement?",
      sleeve: "What's your sleeve length?",
      fitPref: 'How do you like it to fit?',
    };
    return prompts[step] ?? `Please provide ${step}.`;
  }

  private fitPrefChips(type: ProductType): string[] {
    if (type === 'PANTS') return ['slim', 'regular', 'baggy'];
    return ['fitted', 'regular', 'oversized'];
  }
}

function formatSlotEcho(slots: {
  color?: string;
  size?: string;
  type?: string;
  tags: Array<{ value: string }>;
}): string {
  const parts: string[] = [];
  if (slots.color) parts.push(slots.color);
  if (slots.tags.length) parts.push(...slots.tags.map((t) => t.value));
  if (slots.size) parts.push(`size ${slots.size}`);
  if (slots.type) parts.push(slots.type.toLowerCase());
  return parts.join(' · ');
}
