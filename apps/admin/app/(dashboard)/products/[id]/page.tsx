'use client';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';
import { ConfirmModal } from '@/components/modal';
import { ImageUploader } from '@/components/image-uploader';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Variant {
  id: string;
  size?: string;
  color?: string;
  colorHex?: string | null;
  stock: number;
  price?: number;
  sku?: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  categoryId?: string;
  category?: Category;
  tags?: string[];
  isFeatured: boolean;
  images?: string[];
  variants?: Variant[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function formatBdt(value: number): string {
  return value.toLocaleString('en-BD');
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Product form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  // Variant state
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newVariant, setNewVariant] = useState({
    size: '',
    color: '',
    colorHex: '',
    stock: '',
    price: '',
    sku: '',
  });
  const [addingVariant, setAddingVariant] = useState(false);

  const fetchProduct = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const product = await adminFetch<Product>(
        `/products/admin/${productId}`,
        token,
      );
      setName(product.name);
      setSlug(product.slug);
      setDescription(product.description ?? '');
      setPrice(String(product.price));
      setCompareAtPrice(
        product.compareAtPrice ? String(product.compareAtPrice) : '',
      );
      setCategoryId(product.categoryId ?? product.category?.id ?? '');
      setTags((product.tags ?? []).join(', '));
      setIsFeatured(product.isFeatured);
      setImages(product.images ?? []);
      setVariants(product.variants ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load product';
      if (message.includes('404')) {
        notFound();
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token, productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    if (!token) return;
    setCategoriesError('');
    adminFetch<Category[] | { categories: Category[] }>('/categories', token)
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.categories ?? []);
        setCategories(list);
      })
      .catch((err: unknown) => {
        setCategoriesError(
          err instanceof Error ? err.message : 'Failed to load categories',
        );
      });
  }, [token]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');

    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const body = {
        name,
        slug: slug || slugify(name),
        description,
        price: Number(price),
        ...(compareAtPrice
          ? { compareAtPrice: Number(compareAtPrice) }
          : { compareAtPrice: null }),
        ...(categoryId ? { categoryId } : {}),
        tags: tagList,
        isFeatured,
        images,
      };

      await adminFetch(`/products/${productId}`, token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      router.push('/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      await adminFetch(`/products/${productId}`, token, { method: 'DELETE' });
      setConfirmDeleteOpen(false);
      router.push('/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddVariant = async () => {
    if (!token) return;
    setAddingVariant(true);
    try {
      const body = {
        size: newVariant.size || undefined,
        color: newVariant.color || undefined,
        colorHex: newVariant.colorHex.trim() || undefined,
        stock: Number(newVariant.stock) || 0,
        price: newVariant.price ? Number(newVariant.price) : undefined,
        sku: newVariant.sku || undefined,
      };

      const created = await adminFetch<Variant>(
        `/products/${productId}/variants`,
        token,
        { method: 'POST', body: JSON.stringify(body) },
      );
      setVariants((prev) => [...prev, created]);
      setNewVariant({
        size: '',
        color: '',
        colorHex: '',
        stock: '',
        price: '',
        sku: '',
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add variant');
    } finally {
      setAddingVariant(false);
    }
  };

  const [confirmVariantDeleteId, setConfirmVariantDeleteId] = useState<
    string | null
  >(null);
  const [deletingVariant, setDeletingVariant] = useState(false);

  const handleDeleteVariant = async () => {
    if (!token || !confirmVariantDeleteId) return;
    const variantId = confirmVariantDeleteId;
    setDeletingVariant(true);
    try {
      await adminFetch(`/products/${productId}/variants/${variantId}`, token, {
        method: 'DELETE',
      });
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
      setConfirmVariantDeleteId(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete variant',
      );
      setConfirmVariantDeleteId(null);
    } finally {
      setDeletingVariant(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
          Loading garment archive...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Hero Header */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            Atelier · Edit Entry
          </p>
          <h2 className="mt-2 font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            {name || 'Untitled Garment'}
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Revise piece details, variants, and storefront placement.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/products')}
            className="inline-flex items-center gap-2 bg-surface-container-highest px-6 py-2 text-xs font-semibold uppercase tracking-widest text-on-surface border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
          >
            <span
              className="material-symbols-outlined text-sm"
              aria-hidden
            >
              arrow_back
            </span>
            Back
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="inline-flex items-center gap-2 bg-[#c62828] px-6 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-opacity duration-300 ease-editorial hover:opacity-90"
          >
            <span
              className="material-symbols-outlined text-sm"
              aria-hidden
            >
              delete
            </span>
            Delete
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <Banner tone="error" message={error} />}
      {categoriesError && (
        <Banner tone="error" message={categoriesError} />
      )}

      <form
        onSubmit={handleUpdate}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Main Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Basic Info */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                I · Identity
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                draft
              </span>
            </header>

            <div className="grid gap-6">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Product Name <span className="text-primary">*</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Slug
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0 font-mono"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Description
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0 resize-y"
                />
              </label>
            </div>
          </section>

          {/* Pricing */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                II · Pricing
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                payments
              </span>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Price (BDT) <span className="text-primary">*</span>
                </span>
                <div className="flex items-center gap-2 border-b border-outline-variant/25 focus-within:border-primary transition-colors duration-300 ease-editorial">
                  <span className="text-sm text-secondary">&#2547;</span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    min="0"
                    step="1"
                    className="w-full border-0 bg-transparent py-2 text-sm text-on-surface focus:outline-none focus:ring-0"
                  />
                </div>
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Compare At Price
                </span>
                <div className="flex items-center gap-2 border-b border-outline-variant/25 focus-within:border-primary transition-colors duration-300 ease-editorial">
                  <span className="text-sm text-secondary">&#2547;</span>
                  <input
                    type="number"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    min="0"
                    step="1"
                    className="w-full border-0 bg-transparent py-2 text-sm text-on-surface focus:outline-none focus:ring-0"
                  />
                </div>
              </label>
            </div>
          </section>

          {/* Images */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                III · Imagery
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                image
              </span>
            </header>

            <ImageUploader
              value={images}
              onChange={setImages}
              token={token}
              folder="products"
              maxFiles={12}
            />
            <p className="mt-4 text-[10px] tracking-wide text-secondary">
              First image is used as the product cover. Hover a thumbnail to
              reorder or remove.
            </p>
          </section>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Organization */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                IV · Taxonomy
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                category
              </span>
            </header>

            <div className="grid gap-6">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Category
                </span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Tags
                </span>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="casual, summer, slim-fit"
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                />
              </label>
            </div>
          </section>

          {/* Featured toggle — prominent */}
          <section
            className={`p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)] transition-colors duration-300 ease-editorial ${
              isFeatured
                ? 'bg-inverse-surface text-inverse-on-surface'
                : 'bg-surface-container-lowest text-on-surface'
            }`}
          >
            <header className="mb-6 flex items-center justify-between">
              <p
                className={`text-[10px] font-bold uppercase tracking-[0.3em] ${
                  isFeatured ? 'text-inverse-on-surface/80' : 'text-secondary'
                }`}
              >
                V · Placement
              </p>
              <span
                className={`material-symbols-outlined ${
                  isFeatured ? 'text-inverse-on-surface' : 'text-secondary'
                }`}
                aria-hidden
              >
                {isFeatured ? 'star' : 'star_outline'}
              </span>
            </header>

            <button
              type="button"
              role="switch"
              aria-checked={isFeatured}
              onClick={() => setIsFeatured((v) => !v)}
              className="w-full flex items-start justify-between gap-4 text-left"
            >
              <div>
                <p className="font-headline text-lg font-semibold uppercase tracking-[0.15em]">
                  Best Sellers
                </p>
                <p
                  className={`mt-2 text-[11px] tracking-wide ${
                    isFeatured
                      ? 'text-inverse-on-surface/70'
                      : 'text-secondary'
                  }`}
                >
                  Toggle on to surface this garment on the Denimisia homepage
                  &ldquo;Best Sellers&rdquo; tab. The storefront reads this
                  flag directly.
                </p>
                <p
                  className={`mt-3 text-[10px] font-bold uppercase tracking-[0.2em] ${
                    isFeatured
                      ? 'text-inverse-on-surface'
                      : 'text-secondary'
                  }`}
                >
                  {isFeatured ? 'Featured · Live on Storefront' : 'Not Featured'}
                </p>
              </div>
              <span
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center transition-colors duration-300 ease-editorial ${
                  isFeatured
                    ? 'bg-on-primary'
                    : 'bg-surface-container-high'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform transition-transform duration-300 ease-editorial ${
                    isFeatured
                      ? 'translate-x-6 bg-primary'
                      : 'translate-x-1 bg-on-surface'
                  }`}
                />
              </span>
            </button>
          </section>

          {/* Submit */}
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-widest text-on-primary transition-opacity duration-300 ease-editorial hover:opacity-90 disabled:opacity-50"
            >
              <span
                className="material-symbols-outlined text-sm"
                aria-hidden
              >
                save
              </span>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/products')}
              className="w-full inline-flex items-center justify-center bg-surface-container-highest px-6 py-3 text-xs font-semibold uppercase tracking-widest text-on-surface border border-outline-variant/15 hover:bg-surface-container-high transition-colors duration-300 ease-editorial"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      {/* Variants Section */}
      <section className="mt-12 bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
              VI · Variants
            </p>
            <h3 className="mt-2 font-headline text-2xl font-semibold uppercase tracking-[0.15em] text-on-surface">
              Sizing & Colorways
            </h3>
            <p className="mt-2 text-[11px] tracking-wide text-secondary">
              {variants.length}{' '}
              {variants.length === 1 ? 'variant' : 'variants'} archived.
            </p>
          </div>
          <span
            className="material-symbols-outlined text-secondary"
            aria-hidden
          >
            inventory_2
          </span>
        </header>

        {/* Existing variants table */}
        {variants.length > 0 && (
          <div className="mb-8 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Size
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Color
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Stock
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    Price
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10">
                    SKU
                  </th>
                  <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary border-b border-outline-variant/10 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {variants.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-surface-container-low/40 transition-colors duration-300 ease-editorial"
                  >
                    <td className="px-5 py-4 text-sm font-semibold text-on-surface">
                      {v.size ?? (
                        <span className="text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface">
                      <span className="inline-flex items-center gap-2">
                        {v.colorHex && (
                          <span
                            aria-hidden
                            className="inline-block h-3.5 w-3.5 rounded-full border border-outline-variant/30"
                            style={{ backgroundColor: v.colorHex }}
                            title={v.colorHex}
                          />
                        )}
                        {v.color ?? (
                          <span className="text-secondary">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-on-surface">
                        {v.stock}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-on-surface">
                      {v.price != null ? (
                        <>
                          <span className="text-secondary">&#2547;</span>
                          {formatBdt(v.price)}
                        </>
                      ) : (
                        <span className="text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[11px] font-mono tracking-tight text-secondary">
                      {v.sku ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setConfirmVariantDeleteId(v.id)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-primary transition-colors duration-300 ease-editorial"
                      >
                        <span
                          className="material-symbols-outlined text-sm"
                          aria-hidden
                        >
                          delete
                        </span>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add variant form */}
        <div className="bg-surface-container-low/50 p-6">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
              Add Variant
            </p>
            <span
              className="material-symbols-outlined text-secondary"
              aria-hidden
            >
              add_circle
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Size
              </span>
              <input
                type="text"
                value={newVariant.size}
                onChange={(e) =>
                  setNewVariant((prev) => ({ ...prev, size: e.target.value }))
                }
                placeholder="M, L, XL"
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Color
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newVariant.color}
                  onChange={(e) =>
                    setNewVariant((prev) => ({ ...prev, color: e.target.value }))
                  }
                  placeholder="Indigo"
                  className="flex-1 border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                />
                <input
                  type="color"
                  value={newVariant.colorHex || '#cccccc'}
                  onChange={(e) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      colorHex: e.target.value,
                    }))
                  }
                  className="h-7 w-7 cursor-pointer rounded-full border border-outline-variant/30 bg-transparent p-0"
                  aria-label="Pick hex color for swatch"
                  title="Hex shown as the solid PDP swatch when set"
                />
              </div>
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Stock
              </span>
              <input
                type="number"
                value={newVariant.stock}
                onChange={(e) =>
                  setNewVariant((prev) => ({ ...prev, stock: e.target.value }))
                }
                min="0"
                placeholder="0"
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                Price
              </span>
              <div className="flex items-center gap-2 border-b border-outline-variant/25 focus-within:border-primary transition-colors duration-300 ease-editorial">
                <span className="text-sm text-secondary">&#2547;</span>
                <input
                  type="number"
                  value={newVariant.price}
                  onChange={(e) =>
                    setNewVariant((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                  min="0"
                  placeholder="Override"
                  className="w-full border-0 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:outline-none focus:ring-0"
                />
              </div>
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                SKU
              </span>
              <input
                type="text"
                value={newVariant.sku}
                onChange={(e) =>
                  setNewVariant((prev) => ({ ...prev, sku: e.target.value }))
                }
                placeholder="DEN-001"
                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0 font-mono"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleAddVariant}
            disabled={addingVariant}
            className="mt-6 inline-flex items-center gap-2 bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-widest text-on-primary transition-opacity duration-300 ease-editorial hover:opacity-90 disabled:opacity-50"
          >
            <span
              className="material-symbols-outlined text-sm"
              aria-hidden
            >
              add
            </span>
            {addingVariant ? 'Adding...' : 'Add Variant'}
          </button>
        </div>
      </section>

      <ConfirmModal
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteProduct}
        title="Delete product"
        message="Delete this product? This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />

      <ConfirmModal
        open={confirmVariantDeleteId !== null}
        onCancel={() => setConfirmVariantDeleteId(null)}
        onConfirm={handleDeleteVariant}
        title="Delete variant"
        message="Delete this variant? This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deletingVariant}
      />
    </div>
  );
}
