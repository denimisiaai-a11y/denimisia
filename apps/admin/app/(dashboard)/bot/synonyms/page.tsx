'use client';

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';

/**
 * Dimensions the bot recognizes today. Keep this in sync with the parser
 * service. New dimensions should be added here AND wired into the parser
 * before they appear as synonyms — otherwise admins create dead aliases.
 */
const DIMENSIONS = [
  'category',
  'color',
  'silhouette',
  'sleeve',
  'neckline',
  'closure',
  'warmth',
  'rise',
  'wash',
  'season',
  'occasion',
  'material',
  'pattern',
] as const;

interface Synonym {
  id: string;
  dimension: string;
  canonical: string;
  aliases: string[];
}

export default function BotSynonymsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const searchParams = useSearchParams();
  const prefill = searchParams?.get('prefill') ?? '';

  const [rows, setRows] = useState<Synonym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const [form, setForm] = useState({
    dimension: 'color',
    canonical: '',
    aliases: '',
  });

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Synonym[]>('/bot/admin/synonyms', token);
      setRows(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load synonyms');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Pre-fill the alias field from the "Add as synonym" link on the
  // unrecognized-queries page. We can't guess the canonical, but the raw
  // text lands in aliases ready for the admin to retype the canonical.
  useEffect(() => {
    if (prefill) {
      setForm((prev) => ({ ...prev, aliases: prefill }));
    }
  }, [prefill]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const canonical = form.canonical.trim().toLowerCase();
    if (!canonical) {
      setError('Canonical is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await adminFetch('/bot/admin/synonyms', token, {
        method: 'POST',
        body: JSON.stringify({
          dimension: form.dimension,
          canonical,
          aliases: form.aliases
            .split(',')
            .map((a) => a.trim().toLowerCase())
            .filter(Boolean),
        }),
      });
      setForm({ dimension: form.dimension, canonical: '', aliases: '' });
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save synonym');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this synonym?')) {
      return;
    }
    setDeletingId(id);
    try {
      await adminFetch(`/bot/admin/synonyms/${id}`, token, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const visibleRows = filter
    ? rows.filter((r) => {
        const q = filter.trim().toLowerCase();
        return (
          r.canonical.toLowerCase().includes(q) ||
          r.dimension.toLowerCase().includes(q) ||
          r.aliases.some((a) => a.toLowerCase().includes(q))
        );
      })
    : rows;

  return (
    <div>
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            Chat Bot · Vocabulary
          </p>
          <h2 className="mt-2 font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Synonyms
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Map customer wording to canonical attribute values. The bot uses
            these to translate queries like &ldquo;noir&rdquo; into
            &ldquo;black&rdquo;.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <Banner tone="error" message={error} />
        </div>
      )}

      <section className="mb-8 bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
          Add or update
        </p>
        <form
          onSubmit={submit}
          className="grid grid-cols-1 md:grid-cols-[180px_1fr_2fr_auto] items-end gap-5"
        >
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
              Dimension
            </span>
            <select
              value={form.dimension}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dimension: e.target.value }))
              }
              className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
            >
              {DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
              Canonical <span className="text-primary">*</span>
            </span>
            <input
              type="text"
              value={form.canonical}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, canonical: e.target.value }))
              }
              required
              placeholder="e.g. black"
              className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
              Aliases (comma-separated)
            </span>
            <input
              type="text"
              value={form.aliases}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, aliases: e.target.value }))
              }
              placeholder="noir, jet, onyx"
              className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-widest text-on-primary transition-opacity duration-300 ease-editorial hover:opacity-90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden>
              save
            </span>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </form>
      </section>

      <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            All synonyms
          </p>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0 md:w-64"
          />
        </div>

        {loading ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
            Loading…
          </p>
        ) : visibleRows.length === 0 ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">
            No synonyms yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Dimension
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Canonical
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Aliases
                  </th>
                  <th
                    className="px-5 py-3 text-right border-b border-outline-variant/10"
                    aria-hidden
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {visibleRows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-surface-container-low/40 transition-colors duration-300 ease-editorial"
                  >
                    <td className="px-5 py-3 text-sm text-secondary">
                      {r.dimension}
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-on-surface">
                      {r.canonical}
                    </td>
                    <td className="px-5 py-3 text-[11px] tracking-wide text-secondary">
                      {r.aliases.join(', ')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void remove(r.id)}
                        disabled={deletingId === r.id}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary disabled:opacity-40 transition-colors duration-300 ease-editorial"
                      >
                        <span
                          className="material-symbols-outlined text-sm"
                          aria-hidden
                        >
                          delete
                        </span>
                        {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
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
