import { Body, Controller, Get, Post } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BotMessageDto, RecommendSizeDto } from './bot.dto';
import { BotParserService } from './bot.parser.service';
import { BotSearchService } from './bot.search.service';
import { BotSizingService } from './bot.sizing.service';
import { BotSynonymsService } from './bot.synonyms.service';
import { SIZING_FLOW_STEPS, VALID_FIT_PREFS } from './bot.constants';
import { BotMessageReply, BotContext } from './bot.types';

@Controller('bot')
export class BotController {
  constructor(
    private readonly parser: BotParserService,
    private readonly search: BotSearchService,
    private readonly sizing: BotSizingService,
    private readonly synonyms: BotSynonymsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('message')
  async message(@Body() dto: BotMessageDto): Promise<BotMessageReply> {
    const { text } = dto;
    const ctx = dto.context as BotContext;

    if (ctx.flow?.name === 'sizing') {
      return this.advanceSizingFlow(text, ctx);
    }

    const intent = this.parser.detectIntent(text);

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
        return {
          message: "I didn't catch that. Pick a category to start?",
          chips: [
            'Pants',
            'Shirts',
            'Jackets',
            "What's new",
            'Help me find my size',
          ],
          nextContext: ctx,
        };
      }

      const products = await this.search.searchBySlots(slots);
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

    return {
      message: 'I can help find products. For other questions, see contact.',
      chips: ['Pants', 'Shirts', 'Jackets'],
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
