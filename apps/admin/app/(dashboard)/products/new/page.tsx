'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Banner } from '@/components/admin-ui';
import { ImageUploader } from '@/components/image-uploader';
import { PlacementToggle } from '@/components/placement-toggle';
import { RichTextEditor } from '@/components/rich-text-editor';
import {
  VariantsBuilder,
  buildVariantsFromBuilder,
  type SizeEntry,
  type VariantsBuilderValue,
} from '@/components/variants-builder';
import {
  TypeAttributeFields,
  type TagPair,
} from '@/components/products/type-attribute-fields';
import {
  SizeAndFitEditor,
  type ChartRow,
} from '@/components/products/size-and-fit-editor';
import type { FitLandmarks } from '@repo/fit-engine';
import {
  PRODUCT_TYPES,
  TYPE_ATTRIBUTES,
  UNIVERSAL_ATTRIBUTES,
  type ProductType,
} from '@/lib/product-taxonomy';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface PickerProduct {
  id: string;
  name: string;
  slug: string;
  images: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export default function NewProductPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTrending, setIsTrending] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [showStarBadge, setShowStarBadge] = useState(false);

  // Product type drives the conditional attribute panel below. Required —
  // the API rejects products without `type` when required tag dimensions
  // can't be enforced, so the form gates submit on this.
  const [type, setType] = useState<ProductType | null>(null);
  const [productTags, setProductTags] = useState<TagPair[]>([]);
  const [sizeCharts, setSizeCharts] = useState<ChartRow[]>([]);
  const [fitLandmarks, setFitLandmarks] = useState<FitLandmarks | null>(null);

  // Bundle composer: when enabled, the form also creates a ProductBundle on
  // submit, containing this product + the picked products.
  const [bundleEnabled, setBundleEnabled] = useState(false);
  const [bundleName, setBundleName] = useState('');
  const [bundleBadgeText, setBundleBadgeText] = useState('BUNDLE');
  const [bundleProductIds, setBundleProductIds] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);

  // Main / primary variant — captured right inside the imagery section so
  // simple single-variant products don't require the variants matrix below.
  // One color with one-or-more sizes, each size carrying its own stock.
  // On submit these become variants #1..#N; the matrix adds beyond that.
  const [mainColor, setMainColor] = useState('');
  const [mainColorHex, setMainColorHex] = useState('');
  const [mainSizes, setMainSizes] = useState<SizeEntry[]>(() => [
    { id: crypto.randomUUID(), label: '', stock: 0 },
  ]);

  const addMainSize = () =>
    setMainSizes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: '', stock: 0 },
    ]);

  const updateMainSize = (id: string, patch: Partial<SizeEntry>) =>
    setMainSizes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );

  const removeMainSize = (id: string) =>
    setMainSizes((prev) => prev.filter((s) => s.id !== id));

  const [variants, setVariants] = useState<VariantsBuilderValue>({
    colors: [],
  });

  // Lazy-loaded list of existing products for the bundle picker. Fetched
  // once the admin opens the bundle composer so the new-product page stays
  // fast for the common case of single-product entry.
  const [pickerProducts, setPickerProducts] = useState<PickerProduct[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    if (!bundleEnabled || !token || pickerProducts.length > 0) return;
    setPickerLoading(true);
    setPickerError('');
    adminFetch<{ products: PickerProduct[] }>(
      '/products/admin/all?limit=200',
      token,
    )
      .then((data) => setPickerProducts(data.products ?? []))
      .catch((err: unknown) => {
        setPickerError(
          err instanceof Error ? err.message : 'Failed to load products',
        );
      })
      .finally(() => setPickerLoading(false));
  }, [bundleEnabled, token, pickerProducts.length]);

  useEffect(() => {
    if (!token) return;
    setCategoriesLoading(true);
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
      })
      .finally(() => {
        setCategoriesLoading(false);
      });
  }, [token]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(name));
    }
  }, [name, slugEdited]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // Client-side check: required attribute dimensions must each have at
    // least one selected value. The server enforces the same rule via
    // BadRequestException; this is purely UX so the admin sees an inline
    // message before round-tripping.
    if (!type) {
      setError('Type is required.');
      return;
    }
    const missingDims: string[] = [];
    const universalSpec = UNIVERSAL_ATTRIBUTES as unknown as Record<
      string,
      { required: boolean }
    >;
    for (const [dim, spec] of Object.entries(universalSpec)) {
      if (spec.required && !productTags.some((t) => t.dimension === dim)) {
        missingDims.push(dim);
      }
    }
    for (const [dim, spec] of Object.entries(TYPE_ATTRIBUTES[type])) {
      if (spec.required && !productTags.some((t) => t.dimension === dim)) {
        missingDims.push(dim);
      }
    }
    if (missingDims.length > 0) {
      setError(`Missing required attributes: ${missingDims.join(', ')}.`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const finalSlug = slug || slugify(name);
      const additionalVariants = buildVariantsFromBuilder(
        { slug: finalSlug },
        variants,
      );

      // Main variant: one row per (mainColor, size) using the same SKU format
      // as the matrix so the API's uniqueness check applies uniformly. Empty
      // size labels are silently skipped, so a half-filled draft row doesn't
      // brick submit.
      const trimmedMainColor = mainColor.trim();
      const mainVariants = trimmedMainColor
        ? mainSizes
            .filter((s) => s.label.trim().length > 0)
            .map((s) => {
              const trimmedSize = s.label.trim();
              const slugCode = finalSlug
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 4)
                .padEnd(2, 'X');
              const colorCode = trimmedMainColor
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 3)
                .padEnd(2, 'X');
              const sizeCode = trimmedSize.replace(/[^A-Za-z0-9]/g, '');
              return {
                sku: `${slugCode}-${colorCode}-${sizeCode}`,
                size: trimmedSize,
                color: trimmedMainColor,
                ...(mainColorHex.trim() ? { colorHex: mainColorHex.trim() } : {}),
                stock: s.stock,
              };
            })
        : [];

      const generatedVariants = [...mainVariants, ...additionalVariants];

      // Zero-stock guard. The form silently defaults every new variant row
      // to stock=0, which is how 171 phantom-zero variants ended up in the
      // catalog on 2026-05-24. Force the admin to acknowledge before saving
      // any variant at 0 so it never happens by accident again.
      const zeroVariants = generatedVariants.filter((v) => v.stock === 0).length;
      if (zeroVariants > 0) {
        const proceed = window.confirm(
          `${zeroVariants} of ${generatedVariants.length} variants will be saved with stock = 0.\n\n` +
            `Customers can't buy a variant at 0 stock until you restock it.\n\n` +
            `Save anyway?`,
        );
        if (!proceed) {
          setSubmitting(false);
          return;
        }
      }

      // Inline bundle: when enabled, the API creates the product AND the
      // bundle in a single $transaction so a failed bundle never leaves an
      // orphan product behind.
      const inlineBundle =
        bundleEnabled && bundleName.trim()
          ? {
              name: bundleName.trim(),
              slug: slugify(bundleName.trim()),
              badgeText: bundleBadgeText.trim() || 'BUNDLE',
              additionalProductIds: bundleProductIds,
            }
          : undefined;

      const body = {
        name,
        slug: finalSlug,
        description,
        price: Number(price),
        ...(compareAtPrice ? { compareAtPrice: Number(compareAtPrice) } : {}),
        ...(categoryId ? { categoryId } : {}),
        tags: tagList,
        isFeatured,
        isTrending,
        isNewArrival,
        showStarBadge,
        images,
        type,
        productTags,
        ...(sizeCharts.length > 0 ? { sizeCharts } : {}),
        ...(fitLandmarks ? { fitLandmarks } : {}),
        ...(generatedVariants.length > 0
          ? { variants: generatedVariants }
          : {}),
        ...(inlineBundle ? { bundle: inlineBundle } : {}),
      };

      await adminFetch('/products', token, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      router.push('/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hero Header */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            Atelier · New Entry
          </p>
          <h2 className="mt-2 font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Compose Garment
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            Draft a new piece for the Denimisia archive.
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
            Cancel
          </button>
        </div>
      </div>

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
                Unable to Save
              </p>
              <p className="mt-1 font-body text-sm text-on-surface">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
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
                  placeholder="e.g. Slim Fit Denim Jeans"
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
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugEdited(true);
                  }}
                  placeholder="auto-generated-from-name"
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0 font-mono"
                />
              </label>

              <div className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Description
                </span>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe the piece. Use the toolbar for bold, headings, bullet lists, and links."
                />
                <p className="mt-1.5 text-[11px] text-secondary">
                  Use headings (H2/H3) for sections, bullet lists for spec
                  details, and bold/italic for emphasis. Formatting renders
                  exactly the same on the storefront.
                </p>
              </div>
            </div>
          </section>

          {/* Type + Attributes — drives the product-finder bot */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                I·b · Attributes
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                tune
              </span>
            </header>

            <div className="grid gap-6">
              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Type <span className="text-primary">*</span>
                </span>
                <select
                  value={type ?? ''}
                  onChange={(e) =>
                    setType((e.target.value || null) as ProductType | null)
                  }
                  required
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
                >
                  <option value="" disabled>
                    Select type
                  </option>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <TypeAttributeFields
                type={type}
                selected={productTags}
                onChange={setProductTags}
              />

              <div className="border-t border-outline-variant/20 pt-6">
                <SizeAndFitEditor
                  type={type}
                  variantSizes={Array.from(
                    new Set(
                      [
                        ...mainSizes.map((s) => s.label.trim()),
                        ...variants.colors.flatMap((c) =>
                          c.sizes.map((sz) => sz.label.trim()),
                        ),
                      ].filter((s): s is string => Boolean(s)),
                    ),
                  )}
                  chartValue={sizeCharts}
                  onChartChange={setSizeCharts}
                  fitLandmarks={fitLandmarks}
                  onFitChange={setFitLandmarks}
                />
              </div>
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
                  <span className="text-sm text-secondary">BDT </span>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    min="0"
                    step="1"
                    placeholder="0"
                    className="w-full border-0 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:outline-none focus:ring-0"
                  />
                </div>
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                  Compare At Price
                </span>
                <div className="flex items-center gap-2 border-b border-outline-variant/25 focus-within:border-primary transition-colors duration-300 ease-editorial">
                  <span className="text-sm text-secondary">BDT </span>
                  <input
                    type="number"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    min="0"
                    step="1"
                    placeholder="0"
                    className="w-full border-0 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:outline-none focus:ring-0"
                  />
                </div>
              </label>
            </div>
          </section>

          {/* Images + main variant */}
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
              First image is used as the product cover. Hover a thumbnail to reorder or remove.
            </p>

            {/* Main variant: the primary color/size/stock for this product.
                For simple products this is everything you need — the variants
                matrix below is optional, for additional combinations. */}
            <div className="mt-10 border-t border-outline-variant/20 pt-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                Main variant
              </p>
              <p className="mb-5 text-[10px] tracking-wide text-secondary">
                The default color and its sizes for this product. Each size
                holds its own stock count. Required for the product to be
                purchasable. Use section IV below for additional colors.
              </p>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                    Color name <span className="text-primary">*</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={mainColor}
                      onChange={(e) => setMainColor(e.target.value)}
                      placeholder="e.g. Indigo, Off White, Charcoal"
                      className="flex-1 border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                    />
                    <label
                      className="inline-flex items-center gap-2"
                      title="Optional hex (preview swatch when no per-color photos)"
                    >
                      <input
                        type="color"
                        value={mainColorHex || '#cccccc'}
                        onChange={(e) => setMainColorHex(e.target.value)}
                        className="h-7 w-7 cursor-pointer rounded-full border border-outline-variant/30 bg-transparent p-0"
                        aria-label="Pick hex color"
                      />
                      <input
                        type="text"
                        value={mainColorHex}
                        onChange={(e) => setMainColorHex(e.target.value)}
                        placeholder="#1B1B1B"
                        maxLength={7}
                        className="w-20 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-xs text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0 font-mono"
                      />
                    </label>
                  </div>
                </label>

                <div className="md:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                      Sizes &amp; stock <span className="text-primary">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={addMainSize}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface hover:text-primary transition-colors"
                    >
                      <span
                        className="material-symbols-outlined text-sm"
                        aria-hidden
                      >
                        add
                      </span>
                      Add size
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-3 pb-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                        Size
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                        Stock
                      </span>
                      <span className="w-6" aria-hidden />
                    </div>

                    {mainSizes.map((sz, sizeIdx) => (
                      <div
                        key={sz.id}
                        className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border border-outline-variant/20 bg-surface-container/30 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary w-6">
                            {String(sizeIdx + 1).padStart(2, '0')}
                          </span>
                          <input
                            type="text"
                            value={sz.label}
                            onChange={(e) =>
                              updateMainSize(sz.id, { label: e.target.value })
                            }
                            placeholder="e.g. 28 or M"
                            aria-label={`Size label ${sizeIdx + 1}`}
                            className="flex-1 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                          />
                        </div>

                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={sz.stock}
                          onChange={(e) =>
                            updateMainSize(sz.id, {
                              stock: Math.max(
                                0,
                                parseInt(e.target.value || '0', 10),
                              ),
                            })
                          }
                          placeholder="0"
                          aria-label={`Stock for size ${sz.label || 'unnamed'}`}
                          className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-1 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                        />

                        <button
                          type="button"
                          onClick={() => removeMainSize(sz.id)}
                          disabled={mainSizes.length === 1}
                          aria-label={`Remove size ${sz.label || 'unnamed'}`}
                          className="h-6 w-6 inline-flex items-center justify-center text-secondary hover:text-error disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <span
                            className="material-symbols-outlined text-sm"
                            aria-hidden
                          >
                            close
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Variants */}
          <VariantsBuilder
            value={variants}
            onChange={setVariants}
            token={token}
            seedSizes={mainSizes
              .map((s) => s.label.trim())
              .filter((label) => label.length > 0)}
          />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Organization */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                V · Taxonomy
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
                  disabled={categoriesLoading}
                  className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0 disabled:opacity-60"
                >
                  <option value="">
                    {categoriesLoading
                      ? 'Loading categories...'
                      : 'Select a category'}
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {categoriesLoading && (
                  <p className="mt-2 text-[10px] tracking-wide text-secondary">
                    Loading categoriesâ€¦
                  </p>
                )}
                {categoriesError && (
                  <div className="mt-3">
                    <Banner tone="error" message={categoriesError} />
                  </div>
                )}
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
                <p className="mt-2 text-[10px] tracking-wide text-secondary">
                  Comma-separated.
                </p>
              </label>
            </div>
          </section>

          {/* Placement */}
          <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
            <header className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
                VI · Placement
              </p>
              <span
                className="material-symbols-outlined text-secondary"
                aria-hidden
              >
                star
              </span>
            </header>

            <div className="space-y-5">
              <PlacementToggle
                label="Feature on Storefront"
                description='Surfaces this piece on the homepage "Best Sellers" tab.'
                checked={isFeatured}
                onChange={setIsFeatured}
              />
              <PlacementToggle
                label="Trending"
                description="Adds this piece to the Trending row on the homepage."
                checked={isTrending}
                onChange={setIsTrending}
              />
              <PlacementToggle
                label="New Arrival"
                description="Pins this piece into the New Arrivals section."
                checked={isNewArrival}
                onChange={setIsNewArrival}
              />
              <PlacementToggle
                label="Star Badge on Card"
                description="Renders a ★ badge over this product's card in any list."
                checked={showStarBadge}
                onChange={setShowStarBadge}
              />
              <PlacementToggle
                label="Create a Bundle"
                description="Bundles this product with others you pick below."
                checked={bundleEnabled}
                onChange={setBundleEnabled}
              />

              {bundleEnabled && (
                <div className="mt-2 border border-outline-variant/20 bg-surface-container/30 p-4">
                  <label className="block mb-4">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                      Bundle name <span className="text-primary">*</span>
                    </span>
                    <input
                      type="text"
                      value={bundleName}
                      onChange={(e) => setBundleName(e.target.value)}
                      placeholder="e.g. Summer Essentials"
                      className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                    />
                  </label>

                  <label className="block mb-4">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mb-2">
                      Badge text
                    </span>
                    <input
                      type="text"
                      value={bundleBadgeText}
                      onChange={(e) => setBundleBadgeText(e.target.value)}
                      placeholder="BUNDLE"
                      maxLength={20}
                      className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                    />
                  </label>

                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                      Include these products{' '}
                      <span className="font-normal normal-case tracking-wide">
                        ({bundleProductIds.length} selected)
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setPickerProducts([])}
                      disabled={pickerLoading}
                      title="Re-fetch the product list to pick up anything created since you opened this panel."
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-on-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span
                        className="material-symbols-outlined text-sm"
                        aria-hidden
                      >
                        refresh
                      </span>
                      Refresh
                    </button>
                  </div>
                  <input
                    type="search"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search products…"
                    className="mb-2 w-full border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                  />

                  {pickerLoading ? (
                    <p className="text-[11px] text-secondary py-4 text-center">
                      Loading products…
                    </p>
                  ) : pickerError ? (
                    <p className="text-[11px] text-error py-4 text-center">
                      {pickerError}
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto border border-outline-variant/15">
                      {pickerProducts
                        .filter((p) =>
                          pickerSearch.trim()
                            ? p.name
                                .toLowerCase()
                                .includes(pickerSearch.trim().toLowerCase())
                            : true,
                        )
                        .map((p) => {
                          const checked = bundleProductIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className="flex items-center gap-3 px-3 py-2 border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container-high/40 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setBundleProductIds((prev) =>
                                    e.target.checked
                                      ? [...prev, p.id]
                                      : prev.filter((id) => id !== p.id),
                                  );
                                }}
                                className="h-4 w-4"
                              />
                              <span className="text-sm text-on-surface flex-1 truncate">
                                {p.name}
                              </span>
                            </label>
                          );
                        })}
                      {pickerProducts.length === 0 && (
                        <p className="text-[11px] text-secondary py-4 text-center">
                          No existing products to bundle with.
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-3 text-[10px] tracking-wide text-secondary">
                    This product is included automatically. The bundle is
                    created right after the product saves.
                  </p>
                </div>
              )}
            </div>
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
                check
              </span>
              {submitting ? 'Creating...' : 'Create Product'}
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
    </div>
  );
}

