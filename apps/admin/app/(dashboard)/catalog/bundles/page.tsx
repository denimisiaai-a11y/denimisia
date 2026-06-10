'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  EmptyState,
  IconButton,
  PrimaryButton,
  SkeletonList,
  StatusChip,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';
import { Modal, ConfirmModal } from '@/components/modal';
import { Field, TextArea, TextInput, slugify } from '@/components/form';
import { ImageUploader } from '@/components/image-uploader';

interface BundleItem {
  readonly productId: string;
  readonly color: string;
  readonly product?: { readonly id: string; readonly name: string };
}

interface Bundle {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description?: string | null;
  readonly badgeText?: string;
  readonly bundlePrice: number | string;
  readonly availableSizes?: readonly string[];
  readonly image?: string | null;
  readonly isActive: boolean;
  readonly items?: readonly BundleItem[];
}

function formatPrice(v: number | string | null | undefined): string {
  if (v == null) return '—';
  return Number(v).toLocaleString('en-BD', { maximumFractionDigits: 0 });
}

export default function BundlesPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [bundles, setBundles] = useState<readonly Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Bundle[]>('/bundles', token);
      setBundles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bundles');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!token || !confirmDeleteId) return;
    setDeleting(true);
    try {
      await adminFetch(`/bundles/${confirmDeleteId}`, token, {
        method: 'DELETE',
      });
      setConfirmDeleteId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
      setConfirmDeleteId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageShell
      title="Bundles"
      description="Multi-piece looks sold as a single editorial package."
      breadcrumbs={[{ label: 'Catalog' }, { label: 'Bundles' }]}
      actions={
        <PrimaryButton icon="add" onClick={() => setModalOpen(true)}>
          New Bundle
        </PrimaryButton>
      }
    >
      {error && <Banner tone="error" message={error} />}

      <SurfaceCard>
        <SurfaceHeader>{loading ? 'Loading…' : `${bundles.length} Bundles`}</SurfaceHeader>

        {loading ? (
          <SkeletonList rowHeight={72} />
        ) : bundles.length === 0 ? (
          <EmptyState
            icon="widgets"
            label="No bundles yet"
            description="Bundle complementary pieces for a discounted look."
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {bundles.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between px-6 py-4 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
              >
                <div className="flex items-center gap-4">
                  <span
                    className="material-symbols-outlined text-secondary"
                    aria-hidden
                  >
                    widgets
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-body text-sm font-semibold text-on-surface">
                        {b.name}
                      </p>
                      <StatusChip
                        label={b.isActive ? 'Active' : 'Draft'}
                        tone={b.isActive ? 'success' : 'neutral'}
                      />
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
                      /{b.slug} · {b.items?.length ?? 0} items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-body text-sm font-semibold text-on-surface">
                      BDT {formatPrice(b.bundlePrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      icon="edit"
                      label="Edit"
                      onClick={() => setEditingBundle(b)}
                    />
                    <IconButton
                      icon="delete"
                      label="Delete"
                      tone="danger"
                      onClick={() => setConfirmDeleteId(b.id)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      <CreateBundleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />

      <EditBundleModal
        bundle={editingBundle}
        onClose={() => setEditingBundle(null)}
        onSaved={() => {
          setEditingBundle(null);
          void load();
        }}
      />

      <ConfirmModal
        open={confirmDeleteId !== null}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete bundle"
        message="Delete this bundle? This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />
    </PageShell>
  );
}

interface PickerVariant {
  readonly size: string;
  readonly color: string;
  readonly colorHex?: string | null;
}

interface PickerProduct {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly variants?: readonly PickerVariant[];
}

// Distinct (color, colorHex) tuples preserving first-seen order.
function distinctColors(
  variants: readonly PickerVariant[] | undefined,
): readonly { color: string; colorHex: string | null }[] {
  if (!variants) return [];
  const seen = new Map<string, { color: string; colorHex: string | null }>();
  for (const v of variants) {
    const color = (v.color ?? '').trim();
    if (!color || seen.has(color)) continue;
    seen.set(color, { color, colorHex: v.colorHex ?? null });
  }
  return Array.from(seen.values());
}

// Distinct sizes across a set of products, preserving each product's
// declared order. Useful for showing every size the bundle could ship in.
function unionSizes(products: readonly PickerProduct[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of products) {
    for (const v of p.variants ?? []) {
      const s = (v.size ?? '').trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

interface CreateBundleModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

function CreateBundleModal({ open, onClose, onCreated }: CreateBundleModalProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [badgeText, setBadgeText] = useState('Editorial');
  const [image, setImage] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [sizes, setSizes] = useState<readonly string[]>([]);
  const [items, setItems] = useState<
    readonly { productId: string; color: string }[]
  >([]);
  const [productPool, setProductPool] = useState<readonly PickerProduct[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setDescription('');
      setBadgeText('Editorial');
      setImage('');
      setBundlePrice('');
      setSizes([]);
      setItems([]);
      setProductQuery('');
      setFormError('');
      return;
    }
    if (!token) return;
    void (async () => {
      try {
        const data = await adminFetch<unknown>('/products?page=1&limit=100', token);
        const list: readonly PickerProduct[] = Array.isArray(data)
          ? (data as readonly PickerProduct[])
          : ((data as { readonly products?: readonly PickerProduct[] }).products ?? []);
        setProductPool(list);
      } catch {
        // pool is optional — submit still allows manual IDs via search
      }
    })();
  }, [open, token]);

  const toggle = (id: string) =>
    setItems((current) =>
      current.some((i) => i.productId === id)
        ? current.filter((i) => i.productId !== id)
        : [...current, { productId: id, color: '' }],
    );

  const setItemColor = (id: string, color: string) =>
    setItems((current) =>
      current.map((i) => (i.productId === id ? { ...i, color } : i)),
    );

  const productById = (id: string): PickerProduct | undefined =>
    productPool.find((p) => p.id === id);

  const productNameById = (id: string): string =>
    productById(id)?.name ?? id;

  const selectedProducts = items
    .map((i) => productById(i.productId))
    .filter((p): p is PickerProduct => Boolean(p));

  const sizeOptions = unionSizes(selectedProducts);

  // If a product gets unchecked, drop any sizes that no longer appear in the
  // remaining selection so the submitted list stays consistent.
  useEffect(() => {
    setSizes((current) =>
      current.filter((s) => sizeOptions.includes(s)),
    );
    // sizeOptions identity changes per render — depend on its serialization.
  }, [sizeOptions.join('|')]);

  const toggleSize = (size: string) =>
    setSizes((current) =>
      current.includes(size)
        ? current.filter((s) => s !== size)
        : [...current, size],
    );

  const filtered = productQuery
    ? productPool.filter((p) =>
        p.name.toLowerCase().includes(productQuery.toLowerCase()),
      )
    : productPool;

  const submit = async () => {
    if (!token) return;
    if (!name.trim() || !slug.trim() || !badgeText.trim()) {
      setFormError('Name, slug, and badge text are required');
      return;
    }
    const priceNumber = Number(bundlePrice);
    if (!bundlePrice || Number.isNaN(priceNumber) || priceNumber < 1) {
      setFormError('Bundle price must be a positive number in BDT');
      return;
    }
    if (items.length === 0) {
      setFormError('Pick at least one product for the bundle');
      return;
    }
    const sizesList = sizes.filter(Boolean);
    if (sizesList.length === 0) {
      setFormError(
        'Pick at least one available size from the selected products',
      );
      return;
    }
    const missingColor = items.find((i) => !i.color.trim());
    if (missingColor) {
      setFormError(
        `Color is required for every product (missing on "${productNameById(missingColor.productId)}")`,
      );
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await adminFetch('/bundles', token, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          badgeText: badgeText.trim(),
          image: image.trim() || undefined,
          bundlePrice: Math.round(priceNumber),
          availableSizes: sizesList,
          items: items.map((i) => ({
            productId: i.productId,
            color: i.color.trim(),
          })),
        }),
      });
      onCreated();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Bundle"
      description="Pair pieces into a single editorial package."
      width="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            Cancel
          </button>
          <PrimaryButton icon="check" onClick={submit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Bundle'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <Banner tone="error" message={formError} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" name="name" required>
            <TextInput
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              placeholder="Atelier Capsule"
            />
          </Field>
          <Field label="Slug" name="slug" required>
            <TextInput
              id="slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Badge Text" name="badgeText" required hint="Shown on card">
          <TextInput
            id="badgeText"
            value={badgeText}
            onChange={(e) => setBadgeText(e.target.value)}
            placeholder="Save BDT 500"
          />
        </Field>
        <Field label="Description" name="description">
          <TextArea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>
        <Field
          label="Bundle image"
          name="image"
          hint="Hero image rendered on the storefront bundle card and bundle detail page."
        >
          <ImageUploader
            value={image ? [image] : []}
            onChange={(urls) => setImage(urls[0] ?? '')}
            token={token}
            folder="bundles"
            maxFiles={1}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Bundle Price (BDT)"
            name="bundlePrice"
            required
            hint="Whole taka — no subunits."
          >
            <TextInput
              id="bundlePrice"
              type="number"
              min={1}
              step={1}
              value={bundlePrice}
              onChange={(e) => setBundlePrice(e.target.value)}
              placeholder="2500"
            />
          </Field>
          <Field
            label="Available Sizes"
            name="sizes"
            required
            hint={
              sizeOptions.length === 0
                ? 'Pick products first.'
                : 'Tap each size the bundle ships in.'
            }
          >
            {sizeOptions.length === 0 ? (
              <p className="rounded-sm border border-dashed border-outline-variant/30 px-3 py-2 text-[11px] uppercase tracking-[0.15em] text-secondary">
                No sizes yet
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((s) => {
                  const active = sizes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSize(s)}
                      className={
                        'rounded-sm border px-3 py-1 text-xs uppercase tracking-[0.2em] transition-colors duration-200 ' +
                        (active
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-outline-variant/30 bg-surface-container-low text-secondary hover:text-on-surface')
                      }
                      aria-pressed={active}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        </div>
        <Field
          label={`Products (${items.length} selected)`}
          name="products"
          required
          hint="Pick each product, then set the color the bundle ships in for that product."
        >
          <div className="space-y-3">
            {items.length > 0 && (
              <ul className="space-y-2 rounded-sm border border-outline-variant/30 bg-surface-container-low p-3">
                {items.map((item) => {
                  const product = productById(item.productId);
                  const colorOptions = distinctColors(product?.variants);
                  const activeHex =
                    colorOptions.find((c) => c.color === item.color)
                      ?.colorHex ?? null;
                  return (
                    <li
                      key={item.productId}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="flex-1 truncate font-semibold text-on-surface">
                        {productNameById(item.productId)}
                      </span>
                      {colorOptions.length === 0 ? (
                        <span className="w-40 text-right text-[10px] uppercase tracking-[0.15em] text-error">
                          No colors configured
                        </span>
                      ) : (
                        <div className="flex w-40 items-center gap-2">
                          {activeHex && (
                            <span
                              aria-hidden
                              className="h-4 w-4 shrink-0 rounded-full border border-outline-variant/30"
                              style={{ backgroundColor: activeHex }}
                            />
                          )}
                          <select
                            value={item.color}
                            onChange={(e) =>
                              setItemColor(item.productId, e.target.value)
                            }
                            className="w-full rounded-sm border border-outline-variant/30 bg-surface-container px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
                            aria-label={`Color for ${productNameById(item.productId)}`}
                          >
                            <option value="">Select color…</option>
                            {colorOptions.map((c) => (
                              <option key={c.color} value={c.color}>
                                {c.color}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggle(item.productId)}
                        className="text-[10px] uppercase tracking-[0.2em] text-secondary hover:text-error"
                        aria-label={`Remove ${productNameById(item.productId)}`}
                      >
                        remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <TextInput
              placeholder="Search products to add…"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto border border-outline-variant/30 bg-surface-container-low">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-[11px] uppercase tracking-[0.15em] text-secondary">
                  No products match
                </p>
              ) : (
                <ul className="divide-y divide-outline-variant/15">
                  {filtered.map((p) => {
                    const checked = items.some((i) => i.productId === p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => toggle(p.id)}
                          className={
                            'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors duration-200 ' +
                            (checked
                              ? 'bg-surface-container font-semibold text-on-surface'
                              : 'hover:bg-surface-container')
                          }
                        >
                          <span>{p.name}</span>
                          <span
                            className={
                              'material-symbols-outlined text-base ' +
                              (checked ? 'text-on-surface' : 'text-secondary/40')
                            }
                            aria-hidden
                          >
                            {checked ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

interface EditBundleModalProps {
  readonly bundle: Bundle | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

function EditBundleModal({ bundle, onClose, onSaved }: EditBundleModalProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [badgeText, setBadgeText] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [availableSizes, setAvailableSizes] = useState('');
  const [image, setImage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (bundle) {
      setName(bundle.name);
      setSlug(bundle.slug);
      setDescription(bundle.description ?? '');
      setBadgeText(bundle.badgeText ?? '');
      setBundlePrice(String(bundle.bundlePrice ?? ''));
      setAvailableSizes((bundle.availableSizes ?? []).join(', '));
      setImage(bundle.image ?? '');
      setIsActive(bundle.isActive);
      setFormError('');
    }
  }, [bundle]);

  const submit = async () => {
    if (!token || !bundle) return;
    if (!name.trim() || !slug.trim() || !badgeText.trim()) {
      setFormError('Name, slug, and badge text are required');
      return;
    }
    const priceNumber = Number(bundlePrice);
    if (!bundlePrice || Number.isNaN(priceNumber) || priceNumber < 1) {
      setFormError('Bundle price must be a positive number in BDT');
      return;
    }
    const sizesList = availableSizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (sizesList.length === 0) {
      setFormError(
        'Available sizes is required — comma-separated, e.g. "S, M, L"',
      );
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await adminFetch(`/bundles/${bundle.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          badgeText: badgeText.trim(),
          bundlePrice: Math.round(priceNumber),
          availableSizes: sizesList,
          image: image.trim() || null,
          isActive,
        }),
      });
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={bundle !== null}
      onClose={onClose}
      title="Edit Bundle"
      description="Update bundle details."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            Cancel
          </button>
          <PrimaryButton icon="check" onClick={submit} disabled={submitting}>
            {submitting ? 'Savingâ€¦' : 'Save'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <Banner tone="error" message={formError} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" name="edit-bundle-name" required>
            <TextInput
              id="edit-bundle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Slug" name="edit-bundle-slug" required>
            <TextInput
              id="edit-bundle-slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Badge Text" name="edit-bundle-badge" required hint="Shown on the bundle card.">
          <TextInput
            id="edit-bundle-badge"
            value={badgeText}
            onChange={(e) => setBadgeText(e.target.value)}
          />
        </Field>
        <Field label="Description" name="edit-bundle-description">
          <TextArea
            id="edit-bundle-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Bundle Price (BDT)"
            name="edit-bundle-price"
            required
            hint="Whole taka — no subunits."
          >
            <TextInput
              id="edit-bundle-price"
              type="number"
              min={1}
              step={1}
              value={bundlePrice}
              onChange={(e) => setBundlePrice(e.target.value)}
            />
          </Field>
          <Field
            label="Available Sizes"
            name="edit-bundle-sizes"
            required
            hint="Comma-separated."
          >
            <TextInput
              id="edit-bundle-sizes"
              value={availableSizes}
              onChange={(e) => setAvailableSizes(e.target.value)}
              placeholder="S, M, L"
            />
          </Field>
        </div>
        <Field
          label="Bundle image"
          name="edit-bundle-image"
          hint="Hero image rendered on the storefront bundle card and bundle detail page."
        >
          <ImageUploader
            value={image ? [image] : []}
            onChange={(urls) => setImage(urls[0] ?? '')}
            token={token}
            folder="bundles"
            maxFiles={1}
          />
        </Field>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="font-body text-sm text-on-surface">
            Active — visible on storefront
          </span>
        </label>
      </div>
    </Modal>
  );
}
