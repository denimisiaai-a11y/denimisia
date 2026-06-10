'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { ConfirmModal } from '@/components/modal';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  category?: { id: string; name: string };
  images?: string[];
  isActive: boolean;
  isFeatured: boolean;
  status?: string;
  type?: string | null;
  productTags?: { dimension: string; value: string }[];
  sizeCharts?: { sizeKey: string; dimension: string }[];
  variants?: { id: string; stock: number }[];
  createdAt: string;
}

type MissingFilter = 'type' | 'tags' | 'charts' | 'fitLandmarks';

function isMissingFilter(value: string | null): value is MissingFilter {
  return (
    value === 'type' ||
    value === 'tags' ||
    value === 'charts' ||
    value === 'fitLandmarks'
  );
}

const MISSING_FILTER_LABELS: Record<MissingFilter, string> = {
  type: 'missing Type',
  tags: 'missing attribute tags',
  charts: 'missing size charts',
  fitLandmarks: 'missing fit landmarks',
};

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

function formatBdt(value: number): string {
  return value.toLocaleString('en-BD');
}

export default function ProductsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const searchParams = useSearchParams();
  const missingRaw = searchParams.get('missing');
  const missing: MissingFilter | null = isMissingFilter(missingRaw)
    ? missingRaw
    : null;

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const limit = 20;

  // Backfill click-through filter from the dashboard's Fit Data Coverage card.
  // Applied client-side over the already-fetched page since the API doesn't
  // accept a `missing=` filter yet — adequate for v1 since the missing
  // counts are surfaced on the dashboard widget. When all three counts are
  // zero, the admin won't land here anyway.
  const filteredProducts = useMemo(() => {
    if (!missing) return products;
    return products.filter((p) => {
      if (missing === 'type') return !p.type;
      if (missing === 'tags')
        return !!p.type && (!p.productTags || p.productTags.length === 0);
      if (missing === 'charts')
        return !!p.type && (!p.sizeCharts || p.sizeCharts.length === 0);
      if (missing === 'fitLandmarks')
        return (
          !!p.type &&
          (p as unknown as { fitLandmarks?: unknown }).fitLandmarks == null
        );
      return true;
    });
  }, [products, missing]);

  const displayedTotal = missing ? filteredProducts.length : total;
  const totalPages = Math.max(1, Math.ceil(displayedTotal / limit));

  // When `missing` is active, paginate the filtered list in-memory. When the
  // filter is off, the API already returned a single page, so render as-is.
  const pagedProducts = useMemo(() => {
    if (!missing) return products;
    const start = (page - 1) * limit;
    return filteredProducts.slice(start, start + limit);
  }, [missing, filteredProducts, products, page, limit]);

  const fetchProducts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      // When a `missing=` filter is active we paginate client-side over the
      // filtered subset, so request a wide page (API caps at 200) instead of
      // the visible page slice. Without this, server pagination would skip
      // candidates that the client filter would have kept.
      const requestLimit = missing ? 200 : limit;
      const requestPage = missing ? 1 : page;
      const query = new URLSearchParams({
        page: String(requestPage),
        limit: String(requestLimit),
        ...(search ? { search } : {}),
      });
      // Admin endpoint returns active AND inactive (but never soft-deleted).
      const data = await adminFetch<ProductsResponse>(
        `/products/admin/all?${query.toString()}`,
        token,
      );
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, missing]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset to page 1 whenever the missing-filter toggles so the user lands
  // on a populated first page instead of an empty out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [missing]);

  const handleConfirmDelete = async () => {
    if (!token || !confirmDelete) return;
    const { id } = confirmDelete;
    setDeletingId(id);
    try {
      await adminFetch(`/products/${id}`, token, { method: 'DELETE' });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setTotal((prev) => prev - 1);
      setConfirmDelete(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (product: Product) => {
    if (!token) return;
    const nextActive = !product.isActive;
    setTogglingId(product.id);
    // Optimistic update — flip locally first, roll back if the API rejects.
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, isActive: nextActive } : p,
      ),
    );
    try {
      await adminFetch(`/products/${product.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
    } catch (err: unknown) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, isActive: product.isActive } : p,
        ),
      );
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setTogglingId(null);
    }
  };

  const getTotalStock = (product: Product): number => {
    if (!product.variants || product.variants.length === 0) return 0;
    return product.variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  };

  return (
    <div>
      {/* Hero Header */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Products
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Manage the catalogue of tailored garments — {displayedTotal} product
            {displayedTotal === 1 ? '' : 's'}
            {missing ? ` ${MISSING_FILTER_LABELS[missing]}` : ''}.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/products/new"
            className="inline-flex items-center bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest text-on-primary transition-opacity duration-300 ease-editorial hover:opacity-90"
          >
            <span
              className="material-symbols-outlined mr-2 align-middle text-base"
              aria-hidden
            >
              add
            </span>
            Add Product
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8 bg-surface-container-lowest p-6 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        <label className="block">
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
            Search Archive
          </span>
          <div className="flex items-center gap-3 border-b border-outline-variant/25 focus-within:border-primary transition-colors duration-300 ease-editorial">
            <span
              className="material-symbols-outlined text-secondary"
              aria-hidden
            >
              search
            </span>
            <input
              type="text"
              placeholder="Filter by name or SKU — comma-separated, e.g. 20007, 2121"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full border-0 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:outline-none focus:ring-0"
            />
          </div>
        </label>
      </div>

      {/* Backfill filter banner (from dashboard Fit Data Coverage card) */}
      {missing && (
        <div className="mb-6 flex items-center justify-between border border-outline-variant/15 bg-surface-container-low px-5 py-3">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-secondary"
              aria-hidden
            >
              filter_alt
            </span>
            <p className="text-xs font-medium tracking-wide text-on-surface">
              Filter:{' '}
              <span className="font-semibold">
                {MISSING_FILTER_LABELS[missing]}
              </span>
            </p>
          </div>
          <Link
            href="/products"
            className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
          >
            Clear
          </Link>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 border border-outline-variant/15 bg-surface-container-low px-5 py-4">
          <div className="flex items-start gap-3">
            <span
              className="material-symbols-outlined text-secondary"
              aria-hidden
            >
              error
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Unable to Load
              </p>
              <p className="mt-1 font-body text-sm text-on-surface">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-lowest shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Garment
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Category
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Price
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Stock
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                  Status
                </th>
                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-xs font-semibold uppercase tracking-widest text-secondary"
                  >
                    Loading archive...
                  </td>
                </tr>
              ) : pagedProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-xs font-semibold uppercase tracking-widest text-secondary"
                  >
                    No garments found.
                  </td>
                </tr>
              ) : (
                pagedProducts.map((product) => {
                  const stock = getTotalStock(product);
                  const firstImage = product.images?.[0];
                  const stockTone =
                    stock === 0
                      ? 'text-[#c62828] dark:text-[#ff8a80]'
                      : stock < 10
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-on-surface';
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-surface-container-low/40 transition-colors duration-300 ease-editorial"
                    >
                      {/* Garment */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="relative h-16 w-12 flex-shrink-0 bg-surface-container-high overflow-hidden border border-outline-variant/15">
                            {firstImage ? (
                              <Image
                                src={firstImage}
                                alt={product.name}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-secondary">
                                <span
                                  className="material-symbols-outlined text-lg"
                                  aria-hidden
                                >
                                  checkroom
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-on-surface">
                              {product.name}
                            </p>
                            <p className="mt-1 text-[10px] font-medium tracking-widest text-secondary uppercase">
                              {product.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-5 text-sm text-on-surface">
                        {product.category?.name ?? (
                          <span className="text-secondary">—</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-6 py-5">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-on-surface">
                            <span className="text-secondary">BDT </span>
                            {formatBdt(product.price)}
                          </span>
                          {product.compareAtPrice ? (
                            <span className="text-[10px] text-secondary line-through">
                              BDT {formatBdt(product.compareAtPrice)}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Stock */}
                      <td className="px-6 py-5">
                        <span className={`text-sm font-semibold ${stockTone}`}>
                          {stock}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {product.isActive ? (
                            <span className="inline-block bg-inverse-surface px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-inverse-on-surface">
                              Active
                            </span>
                          ) : (
                            <span className="inline-block bg-surface-container-high px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-secondary border border-outline-variant/30">
                              Inactive
                            </span>
                          )}
                          {product.isFeatured && (
                            <span className="inline-block bg-primary px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-on-primary">
                              Featured
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(product)}
                            disabled={togglingId === product.id}
                            title={
                              product.isActive
                                ? 'Hide from storefront (keep data)'
                                : 'Show on storefront'
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface hover:text-primary transition-colors duration-300 ease-editorial disabled:opacity-40"
                          >
                            <span
                              className="material-symbols-outlined text-sm"
                              aria-hidden
                            >
                              {product.isActive ? 'visibility_off' : 'visibility'}
                            </span>
                            {togglingId === product.id
                              ? 'Saving'
                              : product.isActive
                                ? 'Disable'
                                : 'Enable'}
                          </button>
                          <Link
                            href={`/products/${product.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface hover:text-primary transition-colors duration-300 ease-editorial"
                          >
                            <span
                              className="material-symbols-outlined text-sm"
                              aria-hidden
                            >
                              edit
                            </span>
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({
                                id: product.id,
                                name: product.name,
                              })
                            }
                            disabled={deletingId === product.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-error transition-colors duration-300 ease-editorial disabled:opacity-40"
                          >
                            <span
                              className="material-symbols-outlined text-sm"
                              aria-hidden
                            >
                              delete
                            </span>
                            {deletingId === product.id ? 'Removing' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-5 border-t border-outline-variant/10">
            <p className="text-xs font-medium uppercase tracking-wider text-secondary">
              Showing {(page - 1) * limit + 1}–
              {Math.min(page * limit, displayedTotal)} of {displayedTotal}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 flex items-center justify-center border border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-secondary hover:bg-surface-container transition-colors duration-300 ease-editorial disabled:opacity-40"
              >
                Previous
              </button>
              {(() => {
                const startPage = Math.max(
                  1,
                  Math.min(page - 2, totalPages - 4),
                );
                const endPage = Math.min(totalPages, startPage + 4);
                const pages: number[] = [];
                for (let p = startPage; p <= endPage; p++) pages.push(p);
                return pages.map((pageNum) => {
                  const active = page === pageNum;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`h-8 w-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ease-editorial ${
                        active
                          ? 'bg-inverse-surface text-inverse-on-surface'
                          : 'border border-outline-variant/20 text-secondary hover:bg-surface-container'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 flex items-center justify-center border border-outline-variant/20 text-[10px] font-bold uppercase tracking-widest text-secondary hover:bg-surface-container transition-colors duration-300 ease-editorial disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete !== null}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete product"
        message={
          confirmDelete
            ? `Delete "${confirmDelete.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deletingId !== null}
      />
    </div>
  );
}
