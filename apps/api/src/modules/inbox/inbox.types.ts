import { MessageSender, ThreadStatus, ThreadCloseReason } from '@prisma/client';

export interface ImageRef {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export interface MessagePayload {
  body: string;
  images?: ImageRef[];
  inReplyToId?: string;
}

export interface ThreadView {
  id: string;
  status: ThreadStatus;
  closeReason: ThreadCloseReason | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  userId: string | null;
  openedAt: Date;
  lastMessageAt: Date;
}

export interface MessageView {
  id: string;
  sender: MessageSender;
  body: string;
  images: ImageRef[];
  inReplyToId: string | null;
  createdAt: Date;
}

export interface StartHandoffInput {
  name: string;
  email: string;
  phone: string;
  sessionId: string;
  contextSummary?: string;
  userId?: string;
}
