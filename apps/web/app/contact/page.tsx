'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Mail, MapPin, Phone, Clock } from 'lucide-react';

type Subject = 'order' | 'product' | 'return' | 'wholesale' | 'other';

interface ContactForm {
  name: string;
  email: string;
  subject: Subject | '';
  message: string;
  website: string;
}

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'error'; message: string };

const INITIAL_FORM: ContactForm = {
  name: '',
  email: '',
  subject: '',
  message: '',
  website: '',
};

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(INITIAL_FORM);
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' });

  const update =
    <K extends keyof ContactForm>(field: K) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value } as ContactForm));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submit.status === 'submitting') return;

    setSubmit({ status: 'submitting' });
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setSubmit({
          status: 'error',
          message: data.error ?? 'Could not send your message. Please try again.',
        });
        return;
      }

      setSubmit({ status: 'success' });
      setForm(INITIAL_FORM);
    } catch {
      setSubmit({
        status: 'error',
        message: 'Network error. Please check your connection and try again.',
      });
    }
  };

  if (submit.status === 'success') {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-ink text-paper">
          <Check size={28} strokeWidth={2} />
        </div>
        <span className="mb-3 text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-secondary)]">
          Received
        </span>
        <h1 className="mb-4 text-3xl font-black uppercase tracking-tight text-ink md:text-4xl">
          Your message is in.
        </h1>
        <p className="mb-10 max-w-md text-sm leading-relaxed text-[var(--color-secondary)]">
          Thank you for reaching out. We reply within one business day — often faster. In the
          meantime, feel free to keep browsing.
        </p>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row">
          <Link
            href="/"
            className="bg-ink px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-85"
          >
            Back to Homepage
          </Link>
          <button
            type="button"
            onClick={() => setSubmit({ status: 'idle' })}
            className="border border-ink/20 px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-ink transition-colors hover:bg-[var(--color-surface-low)]"
          >
            Send Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-28 md:px-12">
      <header className="mx-auto mb-20 max-w-3xl text-center">
        <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-secondary)]">
          Get in Touch
        </span>
        <h1 className="mb-6 text-4xl font-black uppercase leading-[0.95] tracking-tight text-ink md:text-6xl">
          Contact Us
        </h1>
        <p className="text-sm leading-relaxed text-[var(--color-secondary)] md:text-base">
          Questions, feedback, or wholesale inquiries — we&apos;d love to hear from you.
          Expect a reply within one business day.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_minmax(0,1.4fr)] lg:gap-20">
        <aside className="space-y-8 text-sm text-[var(--color-secondary)]">
          <div>
            <div className="mb-3 flex items-center gap-2 text-ink">
              <Mail size={14} strokeWidth={1.75} />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Email</span>
            </div>
            <a
              href="mailto:hello@denimisia.com"
              className="block text-base text-ink underline-offset-4 hover:underline"
            >
              hello@denimisia.com
            </a>
            <p className="mt-1 text-xs text-[var(--color-secondary)]">For all general enquiries</p>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-ink">
              <Phone size={14} strokeWidth={1.75} />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Phone</span>
            </div>
            <p className="text-base text-ink">+880 1XXX-XXXXXX</p>
            <p className="mt-1 text-xs">Bangladesh Standard Time</p>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-ink">
              <MapPin size={14} strokeWidth={1.75} />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Studio</span>
            </div>
            <p className="text-base text-ink">Dhaka, Bangladesh</p>
            <p className="mt-1 text-xs">By appointment only</p>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-ink">
              <Clock size={14} strokeWidth={1.75} />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Hours</span>
            </div>
            <p className="text-base text-ink">Sat – Thu · 10am – 8pm</p>
            <p className="mt-1 text-xs">Closed Fridays</p>
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Honeypot — hidden from humans, must remain empty. */}
          <div aria-hidden className="pointer-events-none absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={update('website')}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={form.name}
                onChange={update('name')}
                className="w-full border border-ink/20 bg-transparent px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-ink"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={update('email')}
                className="w-full border border-ink/20 bg-transparent px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-ink"
              />
            </div>
          </div>

          <div>
            <label htmlFor="subject" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
              Subject
            </label>
            <select
              id="subject"
              required
              value={form.subject}
              onChange={update('subject')}
              className="w-full appearance-none border border-ink/20 bg-transparent px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-ink"
            >
              <option value="" disabled>
                Select a topic
              </option>
              <option value="order">Order Inquiry</option>
              <option value="product">Product Question</option>
              <option value="return">Return / Exchange</option>
              <option value="wholesale">Wholesale</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="message" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-ink">
              Message
            </label>
            <textarea
              id="message"
              required
              rows={6}
              minLength={10}
              maxLength={4000}
              value={form.message}
              onChange={update('message')}
              className="w-full resize-none border border-ink/20 bg-transparent px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-ink"
            />
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-secondary)]">
              {form.message.length} / 4000
            </p>
          </div>

          {submit.status === 'error' && (
            <p role="alert" className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800">
              {submit.message}
            </p>
          )}

          <button
            type="submit"
            disabled={submit.status === 'submitting'}
            className="inline-flex w-full items-center justify-center gap-3 bg-ink py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-paper transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submit.status === 'submitting' ? (
              <>
                <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                Sending…
              </>
            ) : (
              <>Send Message</>
            )}
          </button>
          <p className="text-center text-[10px] uppercase tracking-[0.25em] text-[var(--color-secondary)]">
            Replies usually within 24 hours
          </p>
        </form>
      </div>
    </div>
  );
}
