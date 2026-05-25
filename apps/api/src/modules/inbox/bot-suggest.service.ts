import { Injectable } from '@nestjs/common';
import { BotParserService } from '../bot/bot.parser.service';
import { BotSearchService } from '../bot/bot.search.service';

export interface SuggestOutput {
  body: string;
  note?: string;
}

@Injectable()
export class BotSuggestService {
  constructor(
    private readonly parser: BotParserService,
    private readonly search: BotSearchService,
  ) {}

  async suggest(customerMessage: string): Promise<SuggestOutput> {
    const intent = this.parser.detectIntent(customerMessage);
    if (intent === 'find') {
      const slots = await this.parser.extractSlots(customerMessage);
      const products = await this.search.searchBySlots(slots);
      if (products.length === 0) {
        return {
          body: "I couldn't find a match for that. Want me to suggest something similar?",
        };
      }
      const list = products
        .map((p) => `${p.name} - BDT ${p.price.toString()}`)
        .join('\n');
      return { body: `Here are some options:\n\n${list}` };
    }
    if (intent === 'whats_new') {
      const products = await this.search.findWhatsNew();
      if (products.length === 0) {
        return { body: 'New pieces are landing soon — check denimisiabd.com/new.' };
      }
      const list = products
        .map((p) => `- ${p.name}`)
        .join('\n');
      return { body: `Just landed:\n\n${list}` };
    }
    return { body: '', note: 'no draft available for this message' };
  }
}
