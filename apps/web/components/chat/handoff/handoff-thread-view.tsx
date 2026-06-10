'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatStore } from '../use-chat-store';
import type { HandoffMessage } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
const POLL_MS = 1500;
const POST_SEND_FAST_POLLS_MS = [600, 1500, 2800];

export function HandoffThreadView() {
  const threadId = useChatStore((s) => s.threadId);
  const token = useChatStore((s) => s.threadToken);
  const messages = useChatStore((s) => s.threadMessages);
  const append = useChatStore((s) => s.appendThreadMessage);
  const setThreadMessages = useChatStore((s) => s.setThreadMessages);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(
    async (opts: { keepRecentOptimistic?: boolean }) => {
      if (!threadId || !token) return;
      try {
        const res = await fetch(
          `${API_BASE}/inbox/handoff/threads/${threadId}/messages?t=${Date.now()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { data?: HandoffMessage[] };
        const list = data.data ?? (data as unknown as HandoffMessage[]);
        if (!Array.isArray(list)) return;
        if (!opts.keepRecentOptimistic) {
          // On first mount: drop ALL optimistic-only messages so we don't
          // resurrect ghosts from a previous session.
          setThreadMessages(list);
          return;
        }
        // Subsequent polls: keep recent tmps (last 10s) that haven't been
        // echoed back yet, so the user's just-sent bubble stays put.
        const tmps = useChatStore
          .getState()
          .threadMessages.filter((m) => {
            if (!m.id.startsWith('tmp-')) return false;
            const ts = parseInt(m.id.slice(4), 10);
            if (Number.isNaN(ts) || Date.now() - ts > 10_000) return false;
            return !list.some(
              (real) => real.body === m.body && real.sender === m.sender,
            );
          });
        setThreadMessages([...list, ...tmps]);
      } catch {
        /* ignore */
      }
    },
    [threadId, token, setThreadMessages],
  );

  // Initial fetch on mount (replace everything) + poll every 3s while open.
  useEffect(() => {
    if (!threadId || !token) return;
    void fetchMessages({ keepRecentOptimistic: false });
    const handle = setInterval(() => {
      if (document.visibilityState === 'visible')
        void fetchMessages({ keepRecentOptimistic: true });
    }, POLL_MS);
    return () => clearInterval(handle);
  }, [threadId, token, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (): Promise<void> => {
    if (!threadId || !token || !draft.trim() || sending) return;
    const text = draft.trim();
    const tempId = `tmp-${Date.now()}`;
    setSending(true);
    setError(null);
    // Optimistic: show the user's message immediately so they see it land.
    // The SSE echo will arrive later — we de-dupe in the SSE handler below.
    append({
      id: tempId,
      sender: 'CUSTOMER',
      body: text,
      images: null,
      inReplyToId: null,
      createdAt: new Date().toISOString(),
    });
    setDraft('');
    try {
      const res = await fetch(
        `${API_BASE}/inbox/handoff/threads/${threadId}/messages`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ body: text }),
        },
      );
      if (!res.ok) {
        setError(res.status === 429 ? 'Slow down a bit.' : 'Could not send.');
      } else {
        // Burst-poll for ~3 seconds to catch the bot's auto-reply ASAP
        // without waiting for the regular polling cadence to tick.
        for (const delay of POST_SEND_FAST_POLLS_MS) {
          setTimeout(() => {
            void fetchMessages({ keepRecentOptimistic: true });
          }, delay);
        }
      }
    } catch {
      setError('Could not send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <p className="text-center text-xs text-muted">
          You&rsquo;re talking to our team. We usually reply within a few hours.
        </p>
        {messages.map((m) => {
          const isAdminSide = m.sender === 'ADMIN' || m.sender === 'BOT';
          return (
            <div key={m.id} className={isAdminSide ? 'text-left' : 'text-right'}>
              <div
                className={
                  'inline-block max-w-[85%] rounded px-3 py-2 text-sm ' +
                  (isAdminSide ? 'bg-muted-bg text-ink' : 'bg-ink text-paper')
                }
              >
                {m.body}
              </div>
              <div className="mt-0.5 text-[10px] text-muted">
                {isAdminSide ? 'Support' : 'You'}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error ? (
        <p className="border-t border-border px-3 py-1 text-xs text-red-600">{error}</p>
      ) : null}
      <div className="flex gap-2 border-t border-border p-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type a message…"
          className="flex-1 rounded border border-border bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !draft.trim()}
          className="rounded bg-ink px-3 py-1.5 text-sm text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
