'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ProductCard } from '@/components/ui/product-card';
import {
  CategoryFilters,
  type CategoryFiltersProps,
  type ProductTypeOption,
  type WashOption,
} from './category-filters';

export interface CategoryCard {
  id?: string;
  name: string;
  slug: string;
  price: number;
  // Optional active-campaign summary. When set, the card renders the
  // campaign final price as headline + strikethrough original price.
  activeCampaign?: {
    finalPrice: number;
    savingsPercent: number;
  } | null;
  image: string;
  hoverImage?: string;
  sizes?: string[];
  washes?: string[];
}

interface CategoryGridProps {
  products: CategoryCard[];
  productTypes?: ProductTypeOption[];
  productTypesHeading?: string;
  productTypeParam?: string;
  productTypeBasePath?: string;
  sizes?: string[];
  sizesHeading?: string;
  washes?: WashOption[];
  emptyLabel?: string;
  showFootnote?: boolean;
  footnote?: string;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'name_asc', label: 'A → Z' },
];

export function CategoryGrid({
  products,
  productTypes,
  productTypesHeading,
  productTypeParam,
  productTypeBasePath,
  sizes,
  sizesHeading,
  washes,
  emptyLabel = 'No pieces match your filters.',
  showFootnote,
  footnote,
  pageSize = DEFAULT_PAGE_SIZE,
}: CategoryGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const activeSizes = useMemo(
    () => searchParams.get('size')?.split(',').filter(Boolean) ?? [],
    [searchParams],
  );
  const activeColors = useMemo(
    () => searchParams.get('color')?.split(',').filter(Boolean) ?? [],
    [searchParams],
  );
  const activeMaxPrice = searchParams.get('maxPrice');
  const currentSort = searchParams.get('sort') ?? 'newest';

  const { priceMin, priceMax } = useMemo(() => {
    if (products.length === 0) return { priceMin: 0, priceMax: 5000 };
    let min = Infinity;
    let max = 0;
    for (const p of products) {
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }
    return {
      priceMin: Math.floor(min / 100) * 100,
      priceMax: Math.ceil(max / 100) * 100,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = products.slice();

    if (activeMaxPrice) {
      const cap = Number(activeMaxPrice);
      list = list.filter((p) => p.price <= cap);
    }
    if (activeSizes.length > 0) {
      list = list.filter((p) => p.sizes?.some((s) => activeSizes.includes(s)));
    }
    if (activeColors.length > 0) {
      list = list.filter((p) => p.washes?.some((c) => activeColors.includes(c)));
    }

    switch (currentSort) {
      case 'oldest':
        list.reverse();
        break;
      case 'price_asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'name_asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return list;
  }, [products, activeMaxPrice, activeSizes, activeColors, currentSort]);

  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const pageStart = (clampedPage - 1) * pageSize;
  const pagedProducts = filteredProducts.slice(pageStart, pageStart + pageSize);

  const goToPage = (target: number, scroll = true) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete('page');
    else params.set('page', String(target));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll });
  };

  const setSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    params.delete('page');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    setSortOpen(false);
  };

  const currentLabel = SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? 'Newest';
  const filterProps: CategoryFiltersProps = {
    productTypes,
    productTypesHeading,
    productTypeParam,
    productTypeBasePath,
    sizes,
    sizesHeading,
    washes,
    priceMin,
    priceMax,
  };

  return (
    <>
      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[320px] max-w-[85vw] overflow-y-auto bg-paper transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="pt-8">
          <CategoryFilters {...filterProps} isMobile onClose={() => setMobileOpen(false)} />
        </div>
      </div>

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
            {filteredProducts.length} piece{filteredProducts.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((p) => !p)}
            className="flex items-center gap-1 text-xs uppercase tracking-widest"
          >
            <span className="text-muted">Sort by:</span>
            <span className="font-semibold text-ink">{currentLabel}</span>
            <ChevronDown
              size={12}
              className={`text-ink transition-transform ${sortOpen ? 'rotate-180' : ''}`}
            />
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

      {/* Sidebar + Grid */}
      <div className="flex gap-8 xl:gap-10">
        <aside className="hidden w-64 flex-shrink-0 border-r border-muted/10 pr-6 lg:block xl:w-72">
          <CategoryFilters {...filterProps} />
        </aside>

        <div className="min-w-0 flex-grow">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <X size={20} className="text-muted" />
              <p className="text-sm text-muted">{emptyLabel}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-5 gap-y-14 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 xl:gap-x-8">
                {pagedProducts.map((product) => (
                  <ProductCard
                    key={product.slug}
                    productId={product.id}
                    name={product.name}
                    slug={product.slug}
                    price={product.activeCampaign ? product.activeCampaign.finalPrice : product.price}
                    originalPrice={product.activeCampaign ? product.price : undefined}
                    image={product.image}
                    hoverImage={product.hoverImage}
                    starBadge={
                      'showStarBadge' in product
                        ? Boolean(
                            (product as { showStarBadge?: boolean })
                              .showStarBadge,
                          )
                        : false
                    }
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-20 flex flex-col items-center gap-8">
                  {clampedPage < totalPages && (
                    <button
                      type="button"
                      onClick={() => goToPage(clampedPage + 1, false)}
                      className="border border-muted/30 px-12 py-4 text-xs font-semibold uppercase tracking-[0.3em] text-ink transition-all duration-500 hover:bg-ink hover:text-paper"
                    >
                      Load More Pieces
                    </button>
                  )}
                  <nav
                    aria-label="Pagination"
                    className="flex items-center gap-2 text-xs uppercase tracking-widest"
                  >
                    <button
                      type="button"
                      onClick={() => goToPage(clampedPage - 1)}
                      disabled={clampedPage <= 1}
                      className="flex h-9 w-9 items-center justify-center border border-muted/20 text-ink transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-30"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => goToPage(p)}
                        aria-current={p === clampedPage ? 'page' : undefined}
                        className={`flex h-9 min-w-[36px] items-center justify-center px-2 text-[11px] tracking-widest transition-colors ${
                          p === clampedPage
                            ? 'bg-ink text-paper'
                            : 'border border-muted/20 text-muted hover:border-ink hover:text-ink'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => goToPage(clampedPage + 1)}
                      disabled={clampedPage >= totalPages}
                      className="flex h-9 w-9 items-center justify-center border border-muted/20 text-ink transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-30"
                      aria-label="Next page"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </nav>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted/60">
                    Page {clampedPage} of {totalPages} — {filteredProducts.length} piece
                    {filteredProducts.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </>
          )}

          {showFootnote && footnote && (
            <p className="mt-12 text-center text-[11px] uppercase tracking-[0.15em] text-muted/60">
              {footnote}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
