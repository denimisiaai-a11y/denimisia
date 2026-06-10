import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BotContext, ChatMessage } from './chat.types';
import type { HandoffMessage } from './handoff/types';

const TTL_MS = 24 * 60 * 60 * 1000;

export type ThreadStatus =
  | 'idle'
  | 'collecting_identity'
  | 'collecting_phone'
  | 'active'
  | 'closed';

interface ChatState {
  open: boolean;
  messages: ChatMessage[];
  context: BotContext;
  lastUpdatedAt: number;

  // Handoff state
  threadId: string | null;
  threadToken: string | null;
  threadStatus: ThreadStatus;
  threadMessages: HandoffMessage[];

  setOpen: (open: boolean) => void;
  pushMessage: (msg: ChatMessage) => void;
  setContext: (ctx: BotContext) => void;
  reset: () => void;

  setThreadStatus: (status: ThreadStatus) => void;
  setThreadActive: (threadId: string, token: string) => void;
  appendThreadMessage: (msg: HandoffMessage) => void;
  setThreadMessages: (msgs: HandoffMessage[]) => void;
  endThread: () => void;
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

      threadId: null,
      threadToken: null,
      threadStatus: 'idle',
      threadMessages: [],

      setOpen: (open) => set({ open }),
      pushMessage: (msg) =>
        set({ messages: [...get().messages, msg], lastUpdatedAt: Date.now() }),
      setContext: (ctx) => set({ context: ctx, lastUpdatedAt: Date.now() }),
      reset: () =>
        set({
          messages: [],
          context: { sessionId: newSessionId() },
          lastUpdatedAt: Date.now(),
          threadId: null,
          threadToken: null,
          threadStatus: 'idle',
          threadMessages: [],
        }),

      setThreadStatus: (threadStatus) =>
        set({ threadStatus, lastUpdatedAt: Date.now() }),
      setThreadActive: (threadId, threadToken) =>
        set({
          threadId,
          threadToken,
          threadStatus: 'active',
          threadMessages: [],
          lastUpdatedAt: Date.now(),
        }),
      appendThreadMessage: (msg) => {
        const existing = get().threadMessages;
        // De-dupe by id — polling replays the same messages every tick
        if (existing.some((m) => m.id === msg.id)) return;
        set({
          threadMessages: [...existing, msg],
          lastUpdatedAt: Date.now(),
        });
      },
      setThreadMessages: (msgs) =>
        set({ threadMessages: msgs, lastUpdatedAt: Date.now() }),
      endThread: () =>
        set({
          threadId: null,
          threadToken: null,
          threadStatus: 'idle',
          threadMessages: [],
          lastUpdatedAt: Date.now(),
        }),
    }),
    {
      name: 'denimisia-chat',
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // TTL expired — wipe everything (active handoff is also abandoned
        // since 24h has passed with no activity).
        if (Date.now() - state.lastUpdatedAt > TTL_MS) {
          state.messages = [];
          state.context = { sessionId: newSessionId() };
          state.threadId = null;
          state.threadToken = null;
          state.threadStatus = 'idle';
          state.threadMessages = [];
          state.lastUpdatedAt = Date.now();
          return;
        }

        // Reset the bot conversation on every fresh page load / new tab
        // UNLESS there's an active human handoff. Customers expect each
        // visit to start fresh — seeing yesterday's bot Q&A on a returning
        // visit looks broken. Active handoffs (threadId set + status active)
        // MUST persist so the customer doesn't lose context with the support
        // agent on reload.
        const hasActiveHandoff =
          state.threadId !== null && state.threadStatus === 'active';

        if (!hasActiveHandoff) {
          state.messages = [];
          state.context = { sessionId: newSessionId() };
          state.threadStatus = 'idle';
          state.threadMessages = [];
          state.threadId = null;
          state.threadToken = null;
        }
      },
    },
  ),
);
