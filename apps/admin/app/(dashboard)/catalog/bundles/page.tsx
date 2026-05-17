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

interface BundleItem {
  readonly productId: string;
  readonly quantity: number;
  readonly product?: { readonly id: string; readonly name: string };
}

interface Bundle {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: number | string;
  readonly compareAtPrice?: number | string | null;
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
                      ৳{formatPrice(b.price)}
                    </p>
                    {b.compareAtPrice && (
                      <p className="text-[10px] text-secondary line-through">
                        ৳{formatPrice(b.compareAtPrice)}
                      </p>
                    )}
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

interface PickerProduct {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
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
  const [productIds, setProductIds] = useState<readonly string[]>([]);
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
      setProductIds([]);
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
    setProductIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
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
    if (productIds.length === 0) {
      setFormError('Pick at least one product for the bundle');
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
          productIds,
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
            placeholder="Save ৳500"
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
          label={`Products (${productIds.length} selected)`}
          name="products"
          required
        >
          <div className="space-y-2">
            <TextInput
              placeholder="Search products…"
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
                    const checked = productIds.includes(p.id);
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
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (bundle) {
      setName(bundle.name);
      setSlug(bundle.slug);
      setPrice(String(bundle.price ?? ''));
      setCompareAtPrice(
        bundle.compareAtPrice != null ? String(bundle.compareAtPrice) : '',
      );
      setIsActive(bundle.isActive);
      setFormError('');
    }
  }, [bundle]);

  const submit = async () => {
    if (!token || !bundle) return;
    if (!name.trim() || !slug.trim()) {
      setFormError('Name and slug are required');
      return;
    }
    const priceNumber = Number(price);
    if (!price || Number.isNaN(priceNumber)) {
      setFormError('Price must be a number');
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
          price: priceNumber,
          compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price" name="edit-bundle-price" required>
            <TextInput
              id="edit-bundle-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field label="Compare At Price" name="edit-bundle-compare">
            <TextInput
              id="edit-bundle-compare"
              type="number"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
            />
          </Field>
        </div>
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
