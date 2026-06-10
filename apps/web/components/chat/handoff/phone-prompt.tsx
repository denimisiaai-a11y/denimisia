'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useChatStore } from '../use-chat-store';

const BD_PHONE_RE = /^(\+?880|0)1[3-9]\d{8}$/;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
}

export function PhonePrompt() {
  const { data: session } = useSession();
  const sessionId = useChatStore((s) => s.context.sessionId);
  const setThreadActive = useChatStore((s) => s.setThreadActive);

  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    const cleaned = phone.replace(/[\s-]/g, '');
    if (!BD_PHONE_RE.test(cleaned)) {
      setError('Please use a Bangladesh phone number.');
      return;
    }
    const user = session?.user as SessionUser | undefined;
    if (!user?.name || !user?.email) {
      setError('Your account is missing a name or email. Please sign in again.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/inbox/handoff/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          phone: cleaned,
          sessionId,
          userId: user.id,
        }),
      });
      if (!res.ok) {
        setError('Could not start conversation.');
        return;
      }
      const data = (await res.json()) as { data?: { threadId: string; magicToken: string } } & {
        threadId?: string;
        magicToken?: string;
      };
      const payload = data.data ?? data;
      if (!payload.threadId || !payload.magicToken) {
        setError('Server returned an unexpected response.');
        return;
      }
      setThreadActive(payload.threadId, payload.magicToken);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 p-3">
      <p className="text-sm">Your phone number, please:</p>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="01XXXXXXXXX"
        autoFocus
        className="w-full rounded border border-border bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-ink px-3 py-2 text-sm text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Connecting…' : 'Continue'}
      </button>
    </form>
  );
}
