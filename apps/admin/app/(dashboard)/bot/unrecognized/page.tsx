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

interface FallbackRow {
  id: string;
  sessionId: string;
  userId: string | null;
  queryPreview: string | null;
  success: boolean;
  errorCode: string | null;
  outputFiltered: boolean;
  injectionFlagged: boolean;
  retrievedSources: unknown;
  createdAt: string;
}

type Tab = 'unrecognized' | 'fallback';

export default function BotUnrecognizedPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [tab, setTab] = useState<Tab>('unrecognized');
  const [rows, setRows] = useState<Row[]>([]);
  const [fallbackRows, setFallbackRows] = useState<FallbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      if (tab === 'unrecognized') {
        const data = await adminFetch<Row[]>(
          '/bot/admin/unrecognized?limit=200',
          token,
        );
        setRows(data);
      } else {
        const data = await adminFetch<FallbackRow[]>(
          '/bot/admin/fallback/recent?limit=200',
          token,
        );
        setFallbackRows(data);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load',
      );
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

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
            synonyms to improve recall. The Fallback tab shows LLM-handled
            queries (post-parser) for review and policy tuning.
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

      <div className="mb-6 flex gap-3 border-b border-outline-variant/15">
        <button
          type="button"
          onClick={() => setTab('unrecognized')}
          className={
            'px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 ease-editorial ' +
            (tab === 'unrecognized'
              ? 'text-on-surface border-b-2 border-on-surface -mb-px'
              : 'text-secondary hover:text-on-surface')
          }
        >
          Unrecognized
        </button>
        <button
          type="button"
          onClick={() => setTab('fallback')}
          className={
            'px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 ease-editorial ' +
            (tab === 'fallback'
              ? 'text-on-surface border-b-2 border-on-surface -mb-px'
              : 'text-secondary hover:text-on-surface')
          }
        >
          Fallback (LLM)
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
        ) : tab === 'unrecognized' ? (
          rows.length === 0 ? (
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
          )
        ) : fallbackRows.length === 0 ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
            No fallback calls yet. The LLM fallback only runs when
            BOT_LLM_FALLBACK_ENABLED is true on the API.
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
                    Query
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Status
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Flags
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Session
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {fallbackRows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-surface-container-low/40 transition-colors duration-300 ease-editorial"
                  >
                    <td className="px-5 py-3 text-[11px] tracking-wide text-secondary">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-on-surface max-w-[400px] truncate">
                      {r.queryPreview ? (
                        <>&ldquo;{r.queryPreview}&rdquo;</>
                      ) : (
                        <span className="text-secondary">[purged]</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[11px] tracking-wide">
                      {r.success ? (
                        <span className="text-primary">OK</span>
                      ) : (
                        <span className="text-error">{r.errorCode ?? 'error'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[11px] tracking-wide text-secondary">
                      {r.outputFiltered && (
                        <span className="mr-2 inline-flex items-center text-error">
                          PII
                        </span>
                      )}
                      {r.injectionFlagged && (
                        <span className="mr-2 inline-flex items-center text-error">
                          injection
                        </span>
                      )}
                      {!r.outputFiltered && !r.injectionFlagged && '—'}
                    </td>
                    <td className="px-5 py-3 text-[11px] font-mono text-secondary">
                      {r.sessionId.slice(0, 8)}
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
