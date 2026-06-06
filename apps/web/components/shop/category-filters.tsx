'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export interface ProductTypeOption {
  slug: string;
  label: string;
  count?: number;
  href?: string;
  active?: boolean;
}

export interface WashOption {
  label: string;
  hex: string;
}

export interface CategoryFiltersProps {
  productTypes?: ProductTypeOption[];
  productTypesHeading?: string;
  // When set (e.g. "types"), Product Type options render as multi-select
  // checkboxes that toggle this comma-separated URL param, instead of the
  // default single-select href navigation used on the [subtype] pages.
  productTypeParam?: string;
  // When set, toggling a Product Type checkbox navigates to this path with the
  // param (e.g. "/shop/women?fits=cargo,flare") instead of toggling in place.
  // Used on the single [category] pages so selecting a second category jumps to
  // the multi-select listing. The active set is read from the option `active`
  // flags rather than the URL (the canonical page has no param).
  productTypeBasePath?: string;
  sizes?: string[];
  sizesHeading?: string;
  washes?: WashOption[];
  priceMin: number;
  priceMax: number;
  isMobile?: boolean;
  onClose?: () => void;
}

const DEFAULT_WASHES: WashOption[] = [
  { label: 'Raw', hex: '#00143a' },
  { label: 'Indigo', hex: '#3a5b8a' },
  { label: 'Vintage', hex: '#aeb9ca' },
  { label: 'Black', hex: '#1b1b1b' },
];

export function CategoryFilters({
  productTypes,
  productTypesHeading = 'Product type',
  productTypeParam,
  productTypeBasePath,
  sizes = [],
  sizesHeading = 'Size',
  washes = DEFAULT_WASHES,
  priceMin,
  priceMax,
  isMobile,
  onClose,
}: CategoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSizes = searchParams.get('size')?.split(',').filter(Boolean) ?? [];
  const activeColors = searchParams.get('color')?.split(',').filter(Boolean) ?? [];
  // In basePath mode (single [category] page) the active set comes from the
  // option `active` flags, since the canonical URL carries no param. Otherwise
  // (listing page) it comes from the URL param.
  const activeTypes = productTypeParam
    ? productTypeBasePath
      ? (productTypes ?? []).filter((o) => o.active).map((o) => o.slug)
      : searchParams.get(productTypeParam)?.split(',').filter(Boolean) ?? []
    : [];
  const activeMaxPrice = searchParams.get('maxPrice') ?? '';

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    price: true,
    type: true,
    size: true,
    wash: true,
  });

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const [localMax, setLocalMax] = useState(
    activeMaxPrice ? Number(activeMaxPrice) : priceMax,
  );

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete('page');
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const toggleArrayParam = useCallback(
    (key: string, item: string, current: string[]) => {
      const next = current.includes(item)
        ? current.filter((v) => v !== item)
        : [...current, item];
      updateParams(key, next.join(','));
    },
    [updateParams],
  );

  const clearAll = () => {
    router.push(pathname, { scroll: false });
    setLocalMax(priceMax);
  };

  const hasActive = useMemo(
    () =>
      activeSizes.length > 0 ||
      activeColors.length > 0 ||
      activeTypes.length > 0 ||
      activeMaxPrice !== '',
    [activeSizes, activeColors, activeTypes, activeMaxPrice],
  );

  const SectionHead = ({ label, sectionKey }: { label: string; sectionKey: string }) => (
    <button
      type="button"
      onClick={() => toggle(sectionKey)}
      className="flex w-full items-center justify-between pb-6"
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink">{label}</h3>
      {openSections[sectionKey] ? (
        <ChevronUp size={14} className="text-muted" />
      ) : (
        <ChevronDown size={14} className="text-muted" />
      )}
    </button>
  );

  const CheckItem = ({
    label,
    count,
    checked,
    onChange,
  }: {
    label: string;
    count?: number;
    checked: boolean;
    onChange: () => void;
  }) => (
    <li>
      <button
        type="button"
        onClick={onChange}
        className="group flex w-full items-center justify-between py-1"
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${
              checked ? 'border-ink bg-ink' : 'border-muted/30 group-hover:border-ink'
            }`}
          >
            {checked && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path
                  d="M1 4L3.5 6.5L9 1"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <span
            className={`text-[11px] uppercase tracking-widest transition-colors ${
              checked ? 'font-medium text-ink' : 'text-muted group-hover:text-ink'
            }`}
          >
            {label}
          </span>
        </div>
        {count !== undefined && (
          <span className="text-[10px] font-light text-muted/50">({count})</span>
        )}
      </button>
    </li>
  );

  return (
    <div className={isMobile ? 'px-6 pb-10' : ''}>
      {isMobile && (
        <div className="flex items-center justify-between border-b border-muted/10 px-0 pb-6 pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-ink">Filters</h2>
          <button type="button" onClick={onClose} aria-label="Close filters">
            <X size={20} className="text-ink" />
          </button>
        </div>
      )}

      {hasActive && (
        <button
          type="button"
          onClick={clearAll}
          className="mb-8 mt-4 text-[10px] uppercase tracking-widest text-muted underline underline-offset-4 hover:text-ink"
        >
          Clear all filters
        </button>
      )}

      <div className="space-y-10">
        {/* Price */}
        <div>
          <SectionHead label="Price" sectionKey="price" />
          {openSections.price && (
            <div className="space-y-4">
              <div className="flex justify-between text-[11px] font-medium tracking-wide text-ink">
                <span>{formatPrice(priceMin)}</span>
                <span>{formatPrice(localMax)}</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={priceMin}
                  max={priceMax}
                  value={localMax}
                  onChange={(e) => setLocalMax(Number(e.target.value))}
                  onMouseUp={() =>
                    updateParams('maxPrice', localMax < priceMax ? String(localMax) : '')
                  }
                  onTouchEnd={() =>
                    updateParams('maxPrice', localMax < priceMax ? String(localMax) : '')
                  }
                  className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[2px] [&::-webkit-slider-runnable-track]:bg-muted/20 [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
                />
                <div
                  className="pointer-events-none absolute left-0 top-[9px] h-[2px] bg-ink"
                  style={{
                    width: `${
                      priceMax > priceMin
                        ? ((localMax - priceMin) / (priceMax - priceMin)) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {productTypes && productTypes.length > 0 && (
          <>
            <div className="h-px bg-muted/10" />
            <div>
              <SectionHead label={productTypesHeading} sectionKey="type" />
              {openSections.type && (
                <ul className="space-y-3">
                  {productTypes.map((opt) => {
                    const label = (
                      <span
                        className={`text-[11px] uppercase tracking-widest transition-colors ${
                          opt.active
                            ? 'font-medium text-ink'
                            : 'text-muted group-hover:text-ink'
                        }`}
                      >
                        {opt.label}
                      </span>
                    );
                    const countNode =
                      opt.count !== undefined ? (
                        <span className="text-[10px] font-light text-muted/50">({opt.count})</span>
                      ) : null;
                    const dot = (
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded-sm border transition-colors ${
                          opt.active
                            ? 'border-ink bg-ink'
                            : 'border-muted/30 group-hover:border-ink'
                        }`}
                      >
                        {opt.active && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path
                              d="M1 4L3.5 6.5L9 1"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                    );

                    if (opt.href) {
                      return (
                        <li key={opt.slug}>
                          <Link
                            href={opt.href}
                            className="group flex w-full items-center justify-between py-1"
                          >
                            <div className="flex items-center gap-3">
                              {dot}
                              {label}
                            </div>
                            {countNode}
                          </Link>
                        </li>
                      );
                    }
                    return (
                      <CheckItem
                        key={opt.slug}
                        label={opt.label}
                        count={opt.count}
                        checked={
                          productTypeParam
                            ? activeTypes.includes(opt.slug)
                            : opt.active ?? false
                        }
                        onChange={() => {
                          if (!productTypeParam) return;
                          const next = activeTypes.includes(opt.slug)
                            ? activeTypes.filter((v) => v !== opt.slug)
                            : [...activeTypes, opt.slug];
                          if (productTypeBasePath) {
                            const query = next.length
                              ? `?${productTypeParam}=${next.join(',')}`
                              : '';
                            router.push(`${productTypeBasePath}${query}`, {
                              scroll: false,
                            });
                          } else {
                            updateParams(productTypeParam, next.join(','));
                          }
                        }}
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {sizes.length > 0 && (
          <>
            <div className="h-px bg-muted/10" />
            <div>
              <SectionHead label={sizesHeading} sectionKey="size" />
              {openSections.size && (
                <ul className="space-y-3">
                  {sizes.map((size) => (
                    <CheckItem
                      key={size}
                      label={size}
                      checked={activeSizes.includes(size)}
                      onChange={() => toggleArrayParam('size', size, activeSizes)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="h-px bg-muted/10" />

        <div>
          <SectionHead label="Wash" sectionKey="wash" />
          {openSections.wash && (
            <div className="flex flex-wrap gap-4">
              {washes.map((wash) => {
                const isActive = activeColors.includes(wash.label);
                return (
                  <button
                    key={wash.label}
                    type="button"
                    onClick={() => toggleArrayParam('color', wash.label, activeColors)}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className={`h-10 w-10 rounded-full transition-all ${
                        isActive
                          ? 'ring-1 ring-ink ring-offset-2'
                          : 'hover:ring-1 hover:ring-muted/30 hover:ring-offset-2'
                      }`}
                      style={{ backgroundColor: wash.hex }}
                    />
                    <span
                      className={`text-[9px] uppercase tracking-widest ${
                        isActive ? 'font-medium text-ink' : 'text-muted'
                      }`}
                    >
                      {wash.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
