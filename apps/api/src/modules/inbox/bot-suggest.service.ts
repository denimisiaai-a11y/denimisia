import { Injectable } from '@nestjs/common';
import { BotFallbackService } from '../bot/fallback/bot.fallback.service';

export interface SuggestOutput {
  body: string;
  note?: string;
}

@Injectable()
export class BotSuggestService {
  constructor(private readonly fallback: BotFallbackService) {}

  async suggest(customerMessage: string): Promise<SuggestOutput> {
    // Use the LLM fallback so answers are grounded against the FAQ and
    // product taxonomy instead of dumb keyword-based catalog dumps.
    // (Same LLM that handles the customer-facing chatbot unknown-intent path.)
    const out = await this.fallback.answer({
      message: customerMessage,
      sessionId: `admin-suggest`,
    });
    return { body: out.message };
  }
}
