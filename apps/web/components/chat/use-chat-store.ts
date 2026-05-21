import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BotContext, ChatMessage } from './chat.types';

const TTL_MS = 24 * 60 * 60 * 1000;

interface ChatState {
  open: boolean;
  messages: ChatMessage[];
  context: BotContext;
  lastUpdatedAt: number;
  setOpen: (open: boolean) => void;
  pushMessage: (msg: ChatMessage) => void;
  setContext: (ctx: BotContext) => void;
  reset: () => void;
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      open: false,
      messages: [],
      context: { sessionId: newSessionId() },
      lastUpdatedAt: Date.now(),
      setOpen: (open) => set({ open }),
      pushMessage: (msg) =>
        set({ messages: [...get().messages, msg], lastUpdatedAt: Date.now() }),
      setContext: (ctx) => set({ context: ctx, lastUpdatedAt: Date.now() }),
      reset: () =>
        set({
          messages: [],
          context: { sessionId: newSessionId() },
          lastUpdatedAt: Date.now(),
        }),
    }),
    {
      name: 'denimisia-chat',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Date.now() - state.lastUpdatedAt > TTL_MS) {
          state.messages = [];
          state.context = { sessionId: newSessionId() };
          state.lastUpdatedAt = Date.now();
        }
      },
    },
  ),
);
