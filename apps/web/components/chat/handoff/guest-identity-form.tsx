'use client';

import { useState } from 'react';
import { useChatStore } from '../use-chat-store';

const BD_PHONE_RE = /^(\+?880|0)1[3-9]\d{8}$/;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export function GuestIdentityForm() {
  const setThreadActive = useChatStore((s) => s.setThreadActive);
  const setThreadStatus = useChatStore((s) => s.setThreadStatus);
  const sessionId = useChatStore((s) => s.context.sessionId);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email.');
      return;
    }
    const cleanedPhone = phone.replace(/[\s-]/g, '');
    if (!BD_PHONE_RE.test(cleanedPhone)) {
      setError('Please use a Bangladesh phone number (+880 or 01-prefix).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/inbox/handoff/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanedPhone,
          sessionId,
          honeypot,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Could not start' }));
        setError(typeof data?.message === 'string' ? data.message : 'Could not start a conversation.');
        return;
      }
      const data = (await res.json()) as { data?: { threadId: string; magicToken: string } } & {
        threadId?: string;
        magicToken?: string;
      };
      const payload = data.data ?? data;
      const threadId = payload.threadId;
      const magicToken = payload.magicToken;
      if (!threadId || !magicToken) {
        setError('Server returned an unexpected response.');
        return;
      }
      setThreadActive(threadId, magicToken);
      setThreadStatus('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a conversation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 p-3">
      <p className="text-sm">Quick — your name, email, and phone:</p>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border border-border bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
        autoFocus
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded border border-border bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
      />
      <input
        type="tel"
        placeholder="01XXXXXXXXX"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded border border-border bg-paper px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
      />
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <p className="text-xs text-muted">We usually reply within a few hours.</p>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-ink px-3 py-2 text-sm text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Connecting…' : 'Connect to support'}
      </button>
    </form>
  );
}
