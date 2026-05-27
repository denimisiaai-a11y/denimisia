'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { ProductCard } from '@/components/ui/product-card';
import { priceWithCampaign } from '@/lib/utils';
import { CollectionFilters } from './collection-filters';
import { MobileFilterDrawer } from './mobile-filter-drawer';
import type { Product, FacetsResponse } from '@/lib/api';
import { resolveProductImage } from '@/lib/placeholder-images';

interface ShopContentProps {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  facets: FacetsResponse;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'name_asc', label: 'A → Z' },
];

export function ShopContent({ products, total, page, totalPages, facets }: ShopContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const currentSort = searchParams.get('sort') ?? 'newest';
  const currentLabel = SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? 'Newest';

  const setSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    params.delete('page');
    router.push(`/shop?${params.toString()}`, { scroll: false });
    setSortOpen(false);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(p));
    }
    router.push(`/shop?${params.toString()}`);
  };

  return (
    <>
      <MobileFilterDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} facets={facets} />

      {/* Utility bar */}
      <div className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-ink lg:hidden"
          >
            <SlidersHorizontal size={14} />
            Filters
          </button>
          <span className="hidden text-xs uppercase tracking-widest text-muted lg:inline">
            {total} piece{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((p) => !p)}
            className="flex items-center gap-1 text-xs uppercase tracking-widest"
          >
            <span className="text-muted">Sort by:</span>
            <span className="font-semibold text-ink">{currentLabel}</span>
            <ChevronDown size={12} className={`text-ink transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
          </button>
          {sortOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} />
              <ul className="absolute right-0 top-8 z-40 min-w-[180px] border border-muted/10 bg-paper py-2 shadow-lg">
                {SORT_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => setSort(opt.value)}
                      className={`w-full px-4 py-2 text-left text-[11px] uppercase tracking-widest transition-colors hover:bg-ink/5 ${
                        currentSort === opt.value ? 'font-semibold text-ink' : 'text-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Main: sidebar + grid */}
      <div className="flex gap-12">
        {/* Desktop sidebar */}
        <aside className="hidden w-[302px] flex-shrink-0 border-r border-muted/10 pr-8 lg:block">
          <CollectionFilters facets={facets} />
        </aside>

        {/* Product grid */}
        <div className="min-w-0 flex-grow">
          {products.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted">
              No products match your filters.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 xl:gap-x-6">
                {products.map((product) => {
                  const colors = new Set(product.variants.map((v) => v.color));
                  const { price: displayPrice, originalPrice } = priceWithCampaign(product);
                  return (
                    <ProductCard
                      key={product.slug}
                      productId={product.id}
                      name={product.name}
                      slug={product.slug}
                      price={displayPrice}
                      originalPrice={originalPrice}
                      image={resolveProductImage(product.images[0], product.slug)}
                      hoverImage={product.images[1]}
                      colourCount={colors.size || undefined}
                      starBadge={Boolean(product.showStarBadge)}
                    />
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-20 flex flex-col items-center gap-6">
                  {page < totalPages && (
                    <button
                      type="button"
                      onClick={() => goToPage(page + 1)}
                      className="border border-muted/30 px-12 py-4 text-xs font-semibold uppercase tracking-[0.3em] text-ink transition-all duration-500 hover:bg-ink hover:text-paper"
                    >
                      Load More Pieces
                    </button>
                  )}
                  <div className="flex gap-3">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <span
                        key={i}
                        className={`h-[1px] w-10 ${i + 1 <= page ? 'bg-ink' : 'bg-muted/30'}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
