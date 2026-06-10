'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { X, ChevronRight } from 'lucide-react';
import { useEditModeUrlOnly } from '@/hooks/use-iframe-edit-mode';
import { cn } from '@/lib/utils';

const SUPPRESS_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/checkout'];
const DISMISS_KEY = 'denimisia:signup-sticker-dismissed';
const DISMISS_DAYS = 7;

export function SignupSticker() {
  const pathname = usePathname();
  const editMode = useEditModeUrlOnly();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) {
        setDismissed(false);
        return;
      }
      const stamp = Number(raw);
      const expired = Date.now() - stamp > DISMISS_DAYS * 24 * 60 * 60 * 1000;
      setDismissed(!expired);
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage may be unavailable (private browsing, quota exceeded);
      // the dismiss still applies for the current session via state.
    }
    setDismissed(true);
    setOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const trimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError('Enter a valid email address.');
        return;
      }
      setSubmitting(true);
      try {
        await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, source: 'signup-sticker' }),
        }).catch(() => null);
        setSubmitted(true);
        setTimeout(() => {
          dismiss();
        }, 2200);
      } finally {
        setSubmitting(false);
      }
    },
    [email, dismiss]
  );

  if (!mounted) return null;
  if (editMode) return null;
  if (dismissed) return null;
  if (pathname && SUPPRESS_ROUTES.some((r) => pathname.startsWith(r))) return null;

  return (
    <>
      {/* Vertical tab */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Get 20% off — sign up"
        className={cn(
          'group fixed left-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-3',
          'bg-ink px-2.5 py-10 text-paper shadow-lg transition-all duration-300',
          'hover:px-3 hover:shadow-xl',
          open && 'pointer-events-none opacity-0'
        )}
      >
        <ChevronRight className="h-3.5 w-3.5 opacity-80 transition-transform group-hover:translate-x-0.5" />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.25em]"
          style={{ writingMode: 'vertical-rl' }}
        >
          Get 20% Off
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signup-sticker-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-[520px] bg-paper shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-8 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted">
                Members Only
              </p>
              <h2
                id="signup-sticker-title"
                className="mt-4 font-serif text-3xl leading-[1.05] tracking-tight text-ink sm:text-4xl"
              >
                Get 20% off
                <br />
                your first order.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Sign up for Denimisia updates — first access to drops, members-only
                pricing, and free shipping on your first order.
              </p>

              {submitted ? (
                <div className="mt-8 border-l-2 border-ink bg-ink/[0.03] px-5 py-4">
                  <p className="text-sm font-medium text-ink">
                    You&apos;re on the list.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Your 20% code is on its way to {email.trim()}.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-8 space-y-3">
                  <label className="block">
                    <span className="sr-only">Email address</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoComplete="email"
                      disabled={submitting}
                      className={cn(
                        'w-full border border-ink/20 bg-paper px-4 py-3 text-sm text-ink',
                        'placeholder:text-muted/60 focus:border-ink focus:outline-none',
                        'disabled:opacity-50'
                      )}
                    />
                  </label>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={cn(
                      'w-full bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-paper',
                      'transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60'
                    )}
                  >
                    {submitting ? 'Claiming…' : 'Claim My 20% Off'}
                  </button>
                  <p className="pt-2 text-[11px] leading-relaxed text-muted/80">
                    By signing up, you agree to our{' '}
                    <a href="/privacy" className="underline underline-offset-2 hover:text-ink">
                      Privacy Policy
                    </a>
                    . Unsubscribe anytime.
                  </p>
                </form>
              )}

              <button
                type="button"
                onClick={dismiss}
                className="mt-6 text-[11px] uppercase tracking-[0.2em] text-muted/70 transition-colors hover:text-ink"
              >
                No thanks
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
