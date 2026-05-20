'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';

interface Row {
  id: string;
  text: string;
  sessionId: string;
  gender: string | null;
  createdAt: string;
}

export default function BotUnrecognizedPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Row[]>(
        '/bot/admin/unrecognized?limit=200',
        token,
      );
      setRows(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load unrecognized queries',
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div>
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            Chat Bot · Recall Gaps
          </p>
          <h2 className="mt-2 font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Unrecognized queries
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Customer messages the bot could not parse. Add the common ones as
            synonyms to improve recall.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={loading}
          aria-label="Refresh"
          className="inline-flex items-center gap-2 bg-surface-container-highest px-5 py-2 text-xs font-semibold uppercase tracking-widest text-on-surface border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial disabled:opacity-50"
        >
          <span
            className={
              'material-symbols-outlined text-sm ' +
              (loading ? 'animate-spin' : '')
            }
            aria-hidden
          >
            refresh
          </span>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6">
          <Banner tone="error" message={error} />
        </div>
      )}

      <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        {loading ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
            No unrecognized queries yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Time
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Text
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Session
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Gender
                  </th>
                  <th
                    className="px-5 py-3 text-right border-b border-outline-variant/10"
                    aria-hidden
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-surface-container-low/40 transition-colors duration-300 ease-editorial"
                  >
                    <td className="px-5 py-3 text-[11px] tracking-wide text-secondary">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-on-surface">
                      &ldquo;{r.text}&rdquo;
                    </td>
                    <td className="px-5 py-3 text-[11px] font-mono text-secondary">
                      {r.sessionId.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3 text-[11px] tracking-wide text-secondary">
                      {r.gender ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/bot/synonyms?prefill=${encodeURIComponent(r.text)}`}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
                      >
                        <span
                          className="material-symbols-outlined text-sm"
                          aria-hidden
                        >
                          add
                        </span>
                        Add as synonym
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
