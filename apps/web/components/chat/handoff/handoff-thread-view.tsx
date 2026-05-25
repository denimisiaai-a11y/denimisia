'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../use-chat-store';
import { openThreadStream } from './handoff-sse-client';
import type { HandoffMessage } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export function HandoffThreadView() {
  const threadId = useChatStore((s) => s.threadId);
  const token = useChatStore((s) => s.threadToken);
  const messages = useChatStore((s) => s.threadMessages);
  const append = useChatStore((s) => s.appendThreadMessage);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to the SSE stream
  useEffect(() => {
    if (!threadId || !token) return;
    const close = openThreadStream({
      threadId,
      token,
      lastMessageId: messages.at(-1)?.id,
      onMessage: (m) => append(m),
      onError: () => {
        /* swallow; auto-reconnects */
      },
    });
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, token]);

  // Initial fetch of any existing messages
  useEffect(() => {
    if (!threadId || !token) return;
    void (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/inbox/handoff/threads/${threadId}/messages`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { data?: HandoffMessage[] };
        const list = data.data ?? (data as unknown as HandoffMessage[]);
        if (Array.isArray(list)) {
          for (const m of list) append(m);
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (): Promise<void> => {
    if (!threadId || !token || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/inbox/handoff/threads/${threadId}/messages`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ body: draft.trim() }),
        },
      );
      if (!res.ok) {
        setError(res.status === 429 ? 'Slow down a bit.' : 'Could not send.');
        return;
      }
      setDraft('');
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
