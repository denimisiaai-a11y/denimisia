export interface HandoffImageRef {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export type HandoffMessageSender = 'CUSTOMER' | 'ADMIN' | 'BOT';

export interface HandoffMessage {
  id: string;
  sender: HandoffMessageSender;
  body: string;
  images: HandoffImageRef[] | null;
  inReplyToId: string | null;
  createdAt: string;
}
