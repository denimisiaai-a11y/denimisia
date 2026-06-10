'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import type { FacetsResponse } from '@/lib/api';
import { formatPrice } from '@/lib/utils';

/* ── Placeholder wash swatches ─────────────────────────────────────────────── */
const WASH_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Raw', hex: '#00143a' },
  { label: 'Indigo', hex: '#3a5b8a' },
  { label: 'Vintage', hex: '#aeb9ca' },
  { label: 'Black', hex: '#1b1b1b' },
];

/* ── Placeholder waist sizes ───────────────────────────────────────────────── */
const WAIST_SIZES = ['22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42'];

interface CollectionFiltersProps {
  facets: FacetsResponse;
  isMobile?: boolean;
  onClose?: () => void;
}

export function CollectionFilters({ facets, isMobile, onClose }: CollectionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ── Read active filters from URL ──────────────────────────────────────── */
  const activeCategories = searchParams.get('category')?.split(',').filter(Boolean) ?? [];
  const activeSizes = searchParams.get('size')?.split(',').filter(Boolean) ?? [];
  const activeColors = searchParams.get('color')?.split(',').filter(Boolean) ?? [];
  const activeMinPrice = searchParams.get('minPrice') ?? '';
  const activeMaxPrice = searchParams.get('maxPrice') ?? '';

  /* ── Section collapse state ────────────────────────────────────────────── */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    price: true,
    type: true,
    waist: true,
    wash: true,
  });

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  /* ── Price slider local state ──────────────────────────────────────────── */
  const priceMin = facets.price.min;
  const priceMax = facets.price.max || 25000;
  const [localMax, setLocalMax] = useState(activeMaxPrice ? Number(activeMaxPrice) : priceMax);

  /* ── URL update helper ─────────────────────────────────────────────────── */
  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`/shop?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
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
    router.push('/shop', { scroll: false });
  };

  const hasActive =
    activeCategories.length > 0 ||
    activeSizes.length > 0 ||
    activeColors.length > 0 ||
    activeMinPrice !== '' ||
    activeMaxPrice !== '';

  /* ── Section heading ───────────────────────────────────────────────────── */
  const SectionHead = ({ label, sectionKey }: { label: string; sectionKey: string }) => (
    <button
      type="button"
      onClick={() => toggle(sectionKey)}
      className="flex w-full items-center justify-between pb-6"
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink">
        {label}
      </h3>
      {openSections[sectionKey] ? (
        <ChevronUp size={14} className="text-muted" />
      ) : (
        <ChevronDown size={14} className="text-muted" />
      )}
    </button>
  );

  /* ── Checkbox item ─────────────────────────────────────────────────────── */
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
              checked
                ? 'border-ink bg-ink'
                : 'border-muted/30 group-hover:border-ink'
            }`}
          >
            {checked && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
      {/* Mobile header */}
      {isMobile && (
        <div className="flex items-center justify-between border-b border-muted/10 px-0 pb-6 pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-ink">
            Filters
          </h2>
          <button type="button" onClick={onClose} aria-label="Close filters">
            <X size={20} className="text-ink" />
          </button>
        </div>
      )}

      {/* Clear all */}
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
        {/* ── Price ─────────────────────────────────────────────────────────── */}
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
                  onMouseUp={() => updateParams('maxPrice', localMax < priceMax ? String(localMax) : '')}
                  onTouchEnd={() => updateParams('maxPrice', localMax < priceMax ? String(localMax) : '')}
                  className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[2px] [&::-webkit-slider-runnable-track]:bg-muted/20 [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
                />
                <div
                  className="pointer-events-none absolute left-0 top-[9px] h-[2px] bg-ink"
                  style={{ width: `${((localMax - priceMin) / (priceMax - priceMin)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-muted/10" />

        {/* ── Product Type ──────────────────────────────────────────────────── */}
        <div>
          <SectionHead label="Product type" sectionKey="type" />
          {openSections.type && (
            <ul className="space-y-3">
              {facets.categories.map((cat) => (
                <CheckItem
                  key={cat.slug}
                  label={cat.name}
                  count={cat.count}
                  checked={activeCategories.includes(cat.slug)}
                  onChange={() => toggleArrayParam('category', cat.slug, activeCategories)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="h-px bg-muted/10" />

        {/* ── Waist ─────────────────────────────────────────────────────────── */}
        <div>
          <SectionHead label="Waist" sectionKey="waist" />
          {openSections.waist && (
            <ul className="space-y-3">
              {WAIST_SIZES.map((size) => {
                const facet = facets.sizes.find((s) => s.value === size);
                return (
                  <CheckItem
                    key={size}
                    label={size}
                    count={facet?.count}
                    checked={activeSizes.includes(size)}
                    onChange={() => toggleArrayParam('size', size, activeSizes)}
                  />
                );
              })}
            </ul>
          )}
        </div>

        <div className="h-px bg-muted/10" />

        {/* ── Wash ──────────────────────────────────────────────────────────── */}
        <div>
          <SectionHead label="Wash" sectionKey="wash" />
          {openSections.wash && (
            <div className="flex flex-wrap gap-4">
              {WASH_SWATCHES.map((wash) => {
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
