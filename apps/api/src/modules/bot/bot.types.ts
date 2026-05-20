import { ProductType } from '@prisma/client';

export type BotIntent = 'find' | 'whats_new' | 'sizing' | 'unknown';

export interface ParsedSlots {
  type?: ProductType;
  color?: string;
  size?: string;
  tags: Array<{ dimension: string; value: string }>;
}

export interface BotContext {
  sessionId: string;
  gender?: 'M' | 'F' | null;
  flow?: {
    name: 'sizing';
    step: string;
    type: ProductType;
    collected: Record<string, number | string>;
  };
}

export interface BotMessageReply {
  message: string;
  products?: unknown[];
  chips?: string[];
  input?: 'text' | 'numeric';
  nextContext: BotContext;
}
