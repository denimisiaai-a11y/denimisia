import type { HandoffMessage } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface OpenStreamOpts {
  threadId: string;
  token: string;
  lastMessageId?: string;
  onMessage: (m: HandoffMessage) => void;
  onError?: () => void;
}

export function openThreadStream(opts: OpenStreamOpts): () => void {
  let closed = false;
  let es: EventSource | null = null;
  let reconnectDelay = 1000;
  let lastSeen = opts.lastMessageId;

  const connect = (): void => {
    if (closed) return;
    const url = new URL(
      `${API_BASE}/inbox/handoff/threads/${opts.threadId}/stream`,
    );
    url.searchParams.set('token', opts.token);
    if (lastSeen) url.searchParams.set('lastMessageId', lastSeen);

    es = new EventSource(url.toString());
    es.addEventListener('message', (evt) => {
      try {
        const m = JSON.parse((evt as MessageEvent).data) as HandoffMessage;
        if (m && typeof m === 'object' && 'id' in m) {
          lastSeen = m.id;
          reconnectDelay = 1000;
          opts.onMessage(m);
        }
      } catch {
        // ignore malformed messages
      }
    });
    es.onerror = () => {
      es?.close();
      if (closed) return;
      opts.onError?.();
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    };
  };

  connect();
  return () => {
    closed = true;
    es?.close();
  };
}
