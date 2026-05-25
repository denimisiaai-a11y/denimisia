'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch, adminPost } from '@/lib/api';
import { Banner } from '@/components/admin-ui';

interface Message {
  id: string;
  sender: 'CUSTOMER' | 'ADMIN' | 'BOT';
  body: string;
  createdAt: string;
}

interface ThreadDetail {
  id: string;
  status: 'OPEN' | 'CLOSED';
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  openedAt: string;
  lastMessageAt: string;
  consecutiveAdminMessages: number;
  customerLastSeenAt: string | null;
  botPausedUntil: string | null;
  messages: Message[];
}

export default function InboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<ThreadDetail>(`/inbox/admin/threads/${id}`, token);
      setThread(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages?.length]);

  // Poll every 5s when window has focus — simpler than SSE for this admin
  // surface (Render free tier hibernate makes SSE more flaky than polling
  // here, and admin doesn't need sub-second latency).
  useEffect(() => {
    const handle = setInterval(() => {
      if (document.hasFocus()) void reload();
    }, 5000);
    return () => clearInterval(handle);
  }, [reload]);

  const pausedUntilTs = thread?.botPausedUntil
    ? new Date(thread.botPausedUntil).getTime()
    : 0;
  useEffect(() => {
    if (!pausedUntilTs) {
      setPauseRemaining(0);
      return;
    }
    const tick = (): void => {
      const r = Math.max(0, pausedUntilTs - Date.now());
      setPauseRemaining(r);
    };
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [pausedUntilTs]);

  if (!thread && loading) {
    return <p className="p-6 text-sm text-secondary">Loading…</p>;
  }
  if (!thread) {
    return (
      <div className="p-6">
        <Banner tone="error" message={error || 'Thread not found'} />
        <Link href="/inbox" className="mt-4 inline-block text-sm underline">
          Back to inbox
        </Link>
      </div>
    );
  }

  const send = async (): Promise<void> => {
    if (!draft.trim() || sending || !token) return;
    setSending(true);
    try {
      await adminPost(`/inbox/admin/threads/${id}/messages`, { body: draft.trim() }, token);
      setDraft('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const close = async (): Promise<void> => {
    if (!token) return;
    await adminPost(`/inbox/admin/threads/${id}/close`, {}, token);
    await reload();
  };

  const reopen = async (): Promise<void> => {
    if (!token) return;
    await adminPost(`/inbox/admin/threads/${id}/reopen`, {}, token);
    await reload();
  };

  const pauseBot = async (): Promise<void> => {
    if (!token) return;
    await adminPost(`/inbox/admin/threads/${id}/pause-bot`, { minutes: 5 }, token);
    await reload();
  };

  const resumeBot = async (): Promise<void> => {
    if (!token) return;
    await adminPost(`/inbox/admin/threads/${id}/resume-bot`, {}, token);
    await reload();
  };

  const isBotPaused = pauseRemaining > 0;
  const remainingLabel =
    pauseRemaining > 0
      ? `${Math.floor(pauseRemaining / 60_000)}:${String(Math.floor((pauseRemaining % 60_000) / 1000)).padStart(2, '0')}`
      : '';

  const botReply = async (customerMessage: string): Promise<void> => {
    if (!token) return;
    setError('');
    try {
      await adminPost<{ id: string; body: string }>(
        `/inbox/admin/threads/${id}/bot-reply`,
        { customerMessage },
        token,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bot reply failed');
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <header className="flex items-center justify-between border-b border-outline-variant/15 p-4">
        <div>
          <Link
            href="/inbox"
            className="mb-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-secondary hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden>
              arrow_back
            </span>
            Inbox
          </Link>
          <h1 className="font-headline text-2xl font-semibold uppercase tracking-[0.1em] text-on-surface">
            {thread.guestName}
          </h1>
          <p className="text-[11px] text-secondary">
            {thread.guestEmail} · <span className="font-mono">{thread.guestPhone}</span>
          </p>
        </div>
        <div className="space-x-2">
          {thread.status === 'OPEN' ? (
            <>
              {isBotPaused ? (
                <button
                  type="button"
                  onClick={() => void resumeBot()}
                  className="rounded bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700 hover:bg-amber-500/25"
                  title="Bot is paused — click to resume now"
                >
                  Bot paused · {remainingLabel} · resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void pauseBot()}
                  className="rounded bg-surface-container-highest px-3 py-1 text-xs font-semibold uppercase tracking-widest text-on-surface hover:bg-surface-container-high"
                  title="Pause the bot for 5 minutes so you can handle this thread"
                >
                  Pause bot (5 min)
                </button>
              )}
              <button
                type="button"
                onClick={() => void close()}
                className="rounded bg-surface-container-highest px-3 py-1 text-xs font-semibold uppercase tracking-widest text-on-surface hover:bg-surface-container-high"
              >
                Mark resolved
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void reopen()}
              className="rounded bg-surface-container-highest px-3 py-1 text-xs font-semibold uppercase tracking-widest text-on-surface hover:bg-surface-container-high"
            >
              Reopen
            </button>
          )}
        </div>
      </header>

      {error ? (
        <div className="border-b border-outline-variant/15 p-3">
          <Banner tone="error" message={error} />
        </div>
      ) : null}

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {thread.messages.map((m) => {
          const isAdminSide = m.sender === 'ADMIN' || m.sender === 'BOT';
          return (
            <div key={m.id} className={isAdminSide ? 'text-right' : 'text-left'}>
              <div
                className={
                  'inline-block max-w-[70%] rounded px-3 py-2 text-sm ' +
                  (isAdminSide
                    ? 'bg-on-surface text-surface-container-lowest'
                    : 'bg-surface-container-highest text-on-surface')
                }
              >
                {m.body}
              </div>
              <div className="mt-1 text-[10px] text-secondary">
                {isAdminSide ? (m.sender === 'BOT' ? 'Bot' : 'You') : thread.guestName} ·{' '}
                {new Date(m.createdAt).toLocaleTimeString()}
              </div>
              {!isAdminSide ? (
                <button
                  type="button"
                  onClick={() => void botReply(m.body)}
                  className="ml-1 text-[10px] uppercase tracking-widest text-secondary underline hover:text-primary"
                >
                  Let bot reply
                </button>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-outline-variant/15 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Type a reply…"
          className="w-full rounded border border-outline-variant/30 bg-surface-container-lowest p-2 text-sm text-on-surface outline-none focus:border-on-surface"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            className="rounded bg-on-surface px-4 py-2 text-xs font-semibold uppercase tracking-widest text-surface-container-lowest transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
