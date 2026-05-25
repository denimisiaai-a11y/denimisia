'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';

interface Thread {
  id: string;
  status: 'OPEN' | 'CLOSED';
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  openedAt: string;
  lastMessageAt: string;
}

type Tab = 'OPEN' | 'CLOSED';

export default function InboxPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [tab, setTab] = useState<Tab>('OPEN');
  const [rows, setRows] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Thread[]>(
        `/inbox/admin/threads?status=${tab}`,
        token,
      );
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load threads');
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
            Customer Conversations
          </p>
          <h2 className="mt-2 font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Inbox
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Customer messages routed from the storefront chat bubble. Reply
            here to keep the conversation in their open chat panel.
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
            className={'material-symbols-outlined text-sm ' + (loading ? 'animate-spin' : '')}
            aria-hidden
          >
            refresh
          </span>
          Refresh
        </button>
      </div>

      <div className="mb-6 flex gap-3 border-b border-outline-variant/15">
        {(['OPEN', 'CLOSED'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              'px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition-colors duration-300 ease-editorial ' +
              (tab === t
                ? 'text-on-surface border-b-2 border-on-surface -mb-px'
                : 'text-secondary hover:text-on-surface')
            }
          >
            {t === 'OPEN' ? 'Open' : 'Closed'}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-6">
          <Banner tone="error" message={error} />
        </div>
      ) : null}

      <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        {loading ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
            No {tab.toLowerCase()} conversations yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Customer
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Last activity
                  </th>
                  <th className="px-5 py-3 text-right border-b border-outline-variant/10" aria-hidden />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-surface-container-low/40 transition-colors duration-300 ease-editorial"
                  >
                    <td className="px-5 py-3 text-sm font-medium text-on-surface">{t.guestName}</td>
                    <td className="px-5 py-3 text-[11px] tracking-wide text-secondary">
                      {t.guestEmail}
                      <br />
                      <span className="font-mono">{t.guestPhone}</span>
                    </td>
                    <td className="px-5 py-3 text-[11px] tracking-wide text-secondary">
                      {new Date(t.lastMessageAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/inbox/${t.id}`}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
                      >
                        Open
                        <span className="material-symbols-outlined text-sm" aria-hidden>
                          arrow_forward
                        </span>
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
