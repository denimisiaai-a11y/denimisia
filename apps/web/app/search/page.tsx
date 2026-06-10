'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  category: { name: string; slug: string } | null;
  variants: { id: string; size: string; color: string; price: string; stock: number }[];
}

function SearchPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Seed from ?q= so deep links (`/search?q=jeans`) and the navbar overlay's
  // recent-search pills actually populate the field. Prior version stayed
  // empty until the user typed, so clicking a recent search appeared to do
  // nothing.
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data.products ?? json.data ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Keep the URL in sync with the current query so results are shareable
  // and the browser back/forward buttons restore prior searches. router.replace
  // (not push) avoids polluting history with one entry per keystroke.
  useEffect(() => {
    const current = searchParams.get('q') ?? '';
    const next = query.trim();
    if (current === next) return;
    const url = next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname;
    router.replace(url, { scroll: false });
  }, [query, pathname, router, searchParams]);

  return (
    <div className="min-h-screen pt-24">
      {/* Search header */}
      <div className="mx-auto max-w-[1440px] px-6 py-12 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <div className="relative">
            <Search
              size={20}
              strokeWidth={1.5}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for products..."
              autoFocus
              className="w-full border-b-2 border-ink bg-transparent py-4 pl-12 pr-12 text-lg font-light text-ink outline-none placeholder:text-muted/60"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {hasSearched && (
            <p className="mt-4 text-sm text-muted">
              {isLoading
                ? 'Searching...'
                : results.length === 0
                  ? `No results for "${query}"`
                  : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
            </p>
          )}
        </div>
      </div>

      {/* Results grid */}
      {results.length > 0 && (
        <div className="mx-auto max-w-[1440px] px-6 pb-20 lg:px-12">
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {results.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="group block"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-muted-bg">
                  {product.images[0] && (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  <h3 className="text-sm font-medium text-ink">{product.name}</h3>
                  {product.category && (
                    <p className="text-xs text-muted">{product.category.name}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink">{formatPrice(Number(product.price))}</span>
                    {product.compareAtPrice && (
                      <span className="text-xs text-muted line-through">
                        {formatPrice(Number(product.compareAtPrice))}
                      </span>
                    )}
                  </div>
                  {product.variants.length > 0 && (
                    <p className="text-xs text-muted">
                      {new Set(product.variants.map((v) => v.color)).size} Colours
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasSearched && (
        <div className="mx-auto max-w-[1440px] px-6 pb-20 text-center lg:px-12">
          <p className="text-sm text-muted">Start typing to search products</p>
        </div>
      )}
    </div>
  );
}

// Suspense wrapper — useSearchParams suspends during prerender; the outer
// boundary lets Next.js stream the page shell while it resolves.
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-24" />}>
      <SearchPageInner />
    </Suspense>
  );
}
