import { Injectable } from '@nestjs/common';
import { RetrievedContext } from './kb.retriever';

const SYSTEM = `You are the Denimisia shopping assistant for a Bangladesh denim and apparel brand. Answer in 1 to 3 short sentences, warm, no emojis. Only use facts from KNOWN. If you cannot answer from KNOWN, say so briefly and suggest the customer leave a message for the team.`;

@Injectable()
export class PromptBuilder {
  compose(userMessage: string, ctx: RetrievedContext): { system: string; user: string } {
    const lines: string[] = ['KNOWN:'];

    for (const c of ctx.faqChunks) {
      lines.push(`[FAQ:${c.heading}] ${c.body}`);
    }

    if (ctx.products.length > 0) {
      const names = ctx.products.map((p) => p.name).join(', ');
      lines.push(`[PRODUCT_SEARCH] Found: ${names}.`);
    } else {
      lines.push('[PRODUCT_SEARCH] No products matched.');
    }

    for (const o of ctx.userOrders) {
      const date = o.createdAt.toISOString().slice(0, 10);
      lines.push(
        `[USER_ORDER] Order ${o.orderNumber} (placed ${date}) is currently ${o.status}. Track at denimisiabd.com/track-order.`,
      );
    }

    lines.push('', `USER: ${userMessage}`);
    return { system: SYSTEM, user: lines.join('\n') };
  }
}
