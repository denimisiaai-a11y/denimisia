'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, ArrowUpRight, TrendingUp, Clock } from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import {
  fetchPageSlots,
  pickSlot,
  resolveSlotUrl,
  type PageSlotRecord,
} from '@/lib/page-slots';
import {
  CATEGORY_IMAGES,
  resolveProductImage,
} from '@/lib/placeholder-images';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const RECENT_KEY = 'denimisia:recent-searches';
const MAX_RECENT = 5;
const MAX_RESULTS = 6;
const DEBOUNCE_MS = 220;

interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  images: string[];
  category: { name: string; slug: string } | null;
}

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const TRENDING: readonly string[] = [
  'Selvedge denim',
  'Slim fit',
  'Dark wash',
  'Womens tops',
  'Oversized jackets',
  'Raw indigo',
];

const POPULAR_CATEGORIES: ReadonlyArray<{
  label: string;
  href: string;
  image: string;
  /** Optional search.* slotKey — the overlay overlays the slot asset on `image`. */
  slotKey?: string;
}> = [
  {
    label: 'Denims',
    href: '/collections/denims',
    image: CATEGORY_IMAGES.denims,
    slotKey: 'category_denims',
  },
  {
    label: 'Tops',
    href: '/collections/tops',
    image: CATEGORY_IMAGES.tops,
    slotKey: 'category_tops',
  },
  {
    label: 'Jackets',
    href: '/collections/jackets',
    image: CATEGORY_IMAGES.jackets,
    slotKey: 'category_jackets',
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function pushRecent(term: string): string[] {
  if (typeof window === 'undefined' || !term.trim()) return [];
  const current = readRecent().filter((t) => t.toLowerCase() !== term.toLowerCase());
  const next = [term.trim(), ...current].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [searchSlots, setSearchSlots] = useState<readonly PageSlotRecord[]>(
    [],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchPageSlots('search')
      .then((slots) => {
        if (!cancelled) setSearchSlots(slots);
      })
      .catch(() => {
        // Search overlay falls back to hardcoded CATEGORY_IMAGES on error.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Focus input on open and refresh recent searches
  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open]);

  // Reset state when closed
  useEffect(() => {
    if (open) return;
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setCursor(0);
  }, [open]);

  // Click-outside to close (defer by a tick so the opening click doesn't close it)
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      const node = panelRef.current;
      if (!node) return;
      const target = e.target as Node | null;
      if (target && !node.contains(target)) onClose();
    };
    const t = window.setTimeout(
      () => document.addEventListener('mousedown', handle),
      0,
    );
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', handle);
    };
  }, [open, onClose]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API}/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        const list: SearchProduct[] =
          (json?.data?.products ?? json?.data ?? []) as SearchProduct[];
        setResults(list.slice(0, MAX_RESULTS));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setHasSearched(true);
        setCursor(0);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  const submit = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (!clean) return;
      pushRecent(clean);
      onClose();
      router.push(`/search?q=${encodeURIComponent(clean)}`);
    },
    [onClose, router],
  );

  // Keyboard navigation (Esc/arrows/enter)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (results.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => (c + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => (c - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' && document.activeElement === inputRef.current) {
        const picked = results[cursor];
        if (picked) {
          e.preventDefault();
          pushRecent(query.trim());
          onClose();
          router.push(`/products/${picked.slug}`);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, results, cursor, router, query]);

  const clearRecent = () => {
    try {
      window.localStorage.removeItem(RECENT_KEY);
    } catch {
      // ignore
    }
    setRecent([]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          key="search-panel"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="absolute left-0 top-full z-50 w-screen bg-paper shadow-sm"
          role="dialog"
          aria-label="Search Denimisia"
        >
          <div className="mx-auto max-w-[1440px] px-12 py-8">
            {/* Input row */}
            <div className="flex items-center gap-4 border-b border-ink/10 px-1 py-4 transition-colors focus-within:border-ink/40">
              <Search size={20} strokeWidth={1.5} className="shrink-0 text-ink/60" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results.length === 0) {
                    e.preventDefault();
                    submit(query);
                  }
                }}
                placeholder="Search denim, silhouettes, a vibe..."
                className="flex-1 bg-transparent font-serif text-2xl tracking-tight text-ink placeholder:text-ink/30 focus:outline-none md:text-[28px]"
                autoComplete="off"
                spellCheck={false}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  className="rounded-full p-1 text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
                  aria-label="Clear search"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              ) : (
                <kbd className="hidden select-none items-center gap-1 border border-ink/15 bg-ink/[0.03] px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wider text-ink/60 sm:inline-flex">
                  Esc
                </kbd>
              )}
            </div>

            {/* Body */}
            <div className="mt-8">
              {/* Empty state */}
              {query.trim().length < 2 && (
                <div className="grid gap-10 md:grid-cols-[1fr_1.1fr]">
                  {/* Left: trending + recent */}
                  <div className="space-y-8">
                    {recent.length > 0 && (
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                            <Clock size={12} strokeWidth={1.5} />
                            Recent
                          </div>
                          <button
                            type="button"
                            onClick={clearRecent}
                            className="text-[10px] uppercase tracking-[0.15em] text-ink/40 transition-colors hover:text-ink"
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {recent.map((term) => (
                            <button
                              key={term}
                              type="button"
                              onClick={() => submit(term)}
                              className="border border-ink/15 px-3 py-1.5 text-xs text-ink/80 transition-colors hover:border-ink hover:text-ink"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                        <TrendingUp size={12} strokeWidth={1.5} />
                        Trending searches
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TRENDING.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => submit(term)}
                            className="bg-ink/[0.04] px-3 py-1.5 text-xs text-ink/80 transition-colors hover:bg-ink hover:text-paper"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 text-[10px] uppercase tracking-[0.15em] text-ink/40">
                      <span className="mr-3">
                        <kbd className="mr-1 border border-ink/15 bg-paper px-1.5 py-0.5 font-sans">↑</kbd>
                        <kbd className="mr-1 border border-ink/15 bg-paper px-1.5 py-0.5 font-sans">↓</kbd>
                        Navigate
                      </span>
                      <span className="mr-3">
                        <kbd className="mr-1 border border-ink/15 bg-paper px-1.5 py-0.5 font-sans">↵</kbd>
                        Select
                      </span>
                      <span>
                        <kbd className="mr-1 border border-ink/15 bg-paper px-1.5 py-0.5 font-sans">Esc</kbd>
                        Close
                      </span>
                    </div>
                  </div>

                  {/* Right: popular categories */}
                  <div>
                    <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                      Shop by category
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {POPULAR_CATEGORIES.map((cat) => {
                        const slot = cat.slotKey
                          ? pickSlot(searchSlots, cat.slotKey)
                          : undefined;
                        const { src: catSrc } = resolveSlotUrl(slot, cat.image);
                        return (
                        <Link
                          key={cat.label}
                          href={cat.href}
                          onClick={onClose}
                          className="group relative block aspect-[4/5] overflow-hidden bg-ink/5"
                        >
                          <Image
                            data-slot-field="media"
                            data-slot={
                              cat.slotKey ? `search.${cat.slotKey}` : undefined
                            }
                            src={catSrc}
                            alt={slot?.altText ?? cat.label}
                            fill
                            sizes="(max-width: 768px) 33vw, 220px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-paper">
                            {cat.label}
                            <ArrowUpRight
                              size={12}
                              strokeWidth={2}
                              className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            />
                          </div>
                        </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Loading shimmer */}
              {query.trim().length >= 2 && loading && (
                <div>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 py-3">
                      <div className="h-14 w-14 animate-pulse bg-ink/[0.06]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 animate-pulse bg-ink/[0.06]" />
                        <div className="h-2.5 w-1/3 animate-pulse bg-ink/[0.04]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Results list */}
              {query.trim().length >= 2 && !loading && results.length > 0 && (
                <>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/50">
                    Products
                  </div>
                  <ul role="listbox" aria-label="Search results" className="divide-y divide-ink/10 border-y border-ink/10">
                    {results.map((p, i) => {
                      const img = resolveProductImage(p.images?.[0], p.slug, 200);
                      const active = i === cursor;
                      return (
                        <li key={p.id} role="option" aria-selected={active}>
                          <Link
                            href={`/products/${p.slug}`}
                            onMouseEnter={() => setCursor(i)}
                            onClick={() => {
                              pushRecent(query.trim());
                              onClose();
                            }}
                            className={cn(
                              'flex items-center gap-4 px-2 py-3 transition-colors',
                              active ? 'bg-ink/[0.04]' : 'hover:bg-ink/[0.03]',
                            )}
                          >
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-ink/5">
                              <Image
                                src={img}
                                alt={p.name}
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="truncate text-sm text-ink">{p.name}</p>
                              {p.category && (
                                <p className="text-[11px] uppercase tracking-wider text-ink/50">
                                  {p.category.name}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-sm font-medium text-ink">
                              {formatPrice(Number(p.price))}
                            </div>
                            <ArrowUpRight
                              size={14}
                              strokeWidth={1.5}
                              className={cn(
                                'shrink-0 transition-all',
                                active ? 'translate-x-0 text-ink' : '-translate-x-1 text-ink/30',
                              )}
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={() => submit(query)}
                    className="mt-4 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70 transition-colors hover:text-ink"
                  >
                    View all results for &ldquo;{query.trim()}&rdquo;
                    <ArrowUpRight size={14} strokeWidth={1.5} />
                  </button>
                </>
              )}

              {/* No results */}
              {query.trim().length >= 2 && !loading && hasSearched && results.length === 0 && (
                <div className="py-10 text-center">
                  <p className="font-serif text-xl text-ink">No matches for &ldquo;{query.trim()}&rdquo;</p>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-ink/60">
                    Try a broader term, or browse one of our curated collections below.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {TRENDING.slice(0, 4).map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="border border-ink/15 px-3 py-1.5 text-xs text-ink/80 transition-colors hover:border-ink hover:text-ink"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
