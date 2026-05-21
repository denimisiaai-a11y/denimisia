export type Role = 'bot' | 'user';

export interface BotProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  ts: number;
  products?: BotProductCard[];
  chips?: string[];
  inputHint?: 'text' | 'numeric';
}

export interface BotContext {
  sessionId: string;
  gender?: 'M' | 'F' | null;
  flow?: {
    name: 'sizing';
    step: string;
    type: 'PANTS' | 'SHIRTS' | 'JACKETS';
    collected: Record<string, number | string>;
  };
}
