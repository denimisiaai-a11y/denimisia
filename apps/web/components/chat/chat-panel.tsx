'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { sendBotMessage } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { useChatStore } from './use-chat-store';
import { GuestIdentityForm } from './handoff/guest-identity-form';
import { PhonePrompt } from './handoff/phone-prompt';
import { HandoffThreadView } from './handoff/handoff-thread-view';

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const GREETING_CHIPS = ['Pants', 'Shirts', 'Jackets', "What's new", 'Help me find my size'];

interface SessionUser {
  id?: string;
  email?: string | null;
  phone?: string | null;
}

const HANDOFF_CHIP_RE = /^(leave a message|talk to support|yes,?\s*connect me)$/i;

export function ChatPanel() {
  const { data: session } = useSession();
  const messages = useChatStore((s) => s.messages);
  const pushMessage = useChatStore((s) => s.pushMessage);
  const context = useChatStore((s) => s.context);
  const setContext = useChatStore((s) => s.setContext);
  const setOpen = useChatStore((s) => s.setOpen);
  const threadStatus = useChatStore((s) => s.threadStatus);
  const setThreadStatus = useChatStore((s) => s.setThreadStatus);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // When the user opts into the handoff, decide whether to skip the identity
  // form (logged-in user with phone on file) or which form to show.
  function startHandoff(): void {
    const user = session?.user as SessionUser | undefined;
    if (user?.email) {
      if (user.phone) {
        // Phone on file — go straight to active by hitting start endpoint via PhonePrompt with prefilled phone.
        // Simpler path: still use PhonePrompt with the existing phone prefilled so user can confirm.
        setThreadStatus('collecting_phone');
      } else {
        setThreadStatus('collecting_phone');
      }
    } else {
      setThreadStatus('collecting_identity');
    }
  }

  useEffect(() => {
    if (messages.length === 0) {
      pushMessage({
        id: genId(),
        role: 'bot',
        text: 'Looking for something? Tell me what you want, or tap a category.',
        ts: Date.now(),
        chips: GREETING_CHIPS,
      });
    }
  }, [messages.length, pushMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleChip(label: string): void {
    if (HANDOFF_CHIP_RE.test(label.trim())) {
      startHandoff();
      return;
    }
    void send(label);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    // If the user manually types a handoff phrase, route to the form.
    if (HANDOFF_CHIP_RE.test(trimmed)) {
      pushMessage({ id: genId(), role: 'user', text: trimmed, ts: Date.now() });
      setInput('');
      startHandoff();
      return;
    }
    setSending(true);
    pushMessage({ id: genId(), role: 'user', text: trimmed, ts: Date.now() });
    setInput('');
    try {
      const reply = await sendBotMessage(trimmed, context);
      setContext(reply.nextContext);
      pushMessage({
        id: genId(),
        role: 'bot',
        text: reply.message,
        ts: Date.now(),
        products: reply.products?.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: typeof p.price === 'string' ? Number(p.price) : p.price,
          images: p.images,
        })),
        chips: reply.chips,
        inputHint: reply.input,
      });
      if (
        (reply as { action?: string }).action === 'offer_handoff' ||
        reply.chips?.some((c) => HANDOFF_CHIP_RE.test(c))
      ) {
        // Surface the entry chip but don't auto-open the form — let the user click.
        // The chip click handler picks it up.
      }
    } catch {
      pushMessage({
        id: genId(),
        role: 'bot',
        text: 'Sorry, something went wrong. Try again?',
        ts: Date.now(),
        chips: ['Pants', 'Shirts', 'Jackets'],
      });
    } finally {
      setSending(false);
    }
  }

  const lastInputHint = [...messages].reverse().find((m) => m.role === 'bot')?.inputHint;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-border bg-paper shadow-2xl">
      <header className="flex items-center justify-between border-b border-border p-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-ink">
          Product finder
        </h2>
        <button
          type="button"
          onClick={() => {
            // If the user closes the chat while still on one of the identity-
            // collection forms (no thread created yet), treat it as a cancel —
            // otherwise the form re-appears every time they re-open the chat.
            if (
              threadStatus === 'collecting_identity' ||
              threadStatus === 'collecting_phone'
            ) {
              setThreadStatus('idle');
            }
            setOpen(false);
          }}
          aria-label="Close"
          className="rounded-full p-1 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {threadStatus === 'collecting_identity' ? (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <button
            type="button"
            onClick={() => setThreadStatus('idle')}
            className="self-start px-3 pt-2 text-xs text-ink/60 hover:text-ink"
          >
            ← Back to chat
          </button>
          <GuestIdentityForm />
        </div>
      ) : threadStatus === 'collecting_phone' ? (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <button
            type="button"
            onClick={() => setThreadStatus('idle')}
            className="self-start px-3 pt-2 text-xs text-ink/60 hover:text-ink"
          >
            ← Back to chat
          </button>
          <PhonePrompt />
        </div>
      ) : threadStatus === 'active' ? (
        <HandoffThreadView />
      ) : (
      <>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'}
          >
            <div
              className={
                m.role === 'user'
                  ? 'inline-block max-w-[85%] rounded-lg bg-ink px-3 py-2 text-sm text-paper'
                  : 'inline-block max-w-[85%] rounded-lg bg-muted-bg px-3 py-2 text-sm text-ink'
              }
            >
              {m.text}
            </div>

            {m.products && m.products.length > 0 ? (
              <ul className="mt-2 w-full space-y-2">
                {m.products.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 rounded border border-border p-2 transition-colors hover:bg-muted-bg/60"
                    >
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="h-16 w-16 flex-shrink-0 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-16 w-16 flex-shrink-0 rounded bg-muted-bg" />
                      )}
                      <div className="flex min-w-0 flex-col justify-center">
                        <div className="truncate text-xs font-medium text-ink">{p.name}</div>
                        <div className="mt-0.5 text-xs text-muted">{formatPrice(p.price)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {m.chips && m.chips.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {m.chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleChip(c)}
                    disabled={sending}
                    className="rounded-full border border-border px-3 py-1 text-xs text-ink transition-colors hover:bg-muted-bg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-border p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a product, size, colour…"
          inputMode={lastInputHint === 'numeric' ? 'decimal' : 'text'}
          aria-label="Message"
          className="flex-1 rounded border border-border bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded bg-ink px-3 py-1.5 text-sm text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
      <button
        type="button"
        onClick={startHandoff}
        className="border-t border-border bg-muted-bg/40 px-3 py-2 text-[11px] uppercase tracking-widest text-muted transition-colors hover:bg-muted-bg"
      >
        Talk to support
      </button>
      </>
      )}
    </div>
  );
}
