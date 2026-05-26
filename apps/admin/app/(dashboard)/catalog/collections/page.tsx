'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  EmptyState,
  PrimaryButton,
  SkeletonList,
  StatusChip,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';
import { Modal, ConfirmModal } from '@/components/modal';
import { Field, TextInput, slugify } from '@/components/form';

type CollectionType = 'DROP' | 'EDIT' | 'AUTO' | 'PROMO';

interface Collection {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly image: string | null;
  readonly type?: CollectionType;
  readonly isActive: boolean;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly products?: readonly { readonly productId: string }[];
  readonly _count?: { readonly products: number };
}

const TYPE_TONE: Record<CollectionType, 'success' | 'info' | 'neutral' | 'warning'> = {
  DROP: 'info',
  EDIT: 'neutral',
  AUTO: 'success',
  PROMO: 'warning',
};

function computeStatus(c: Collection): { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' } {
  if (!c.isActive) return { label: 'Hidden', tone: 'warning' };
  const now = Date.now();
  if (c.startDate && new Date(c.startDate).getTime() > now) return { label: 'Scheduled', tone: 'info' };
  if (c.endDate && new Date(c.endDate).getTime() < now) return { label: 'Ended', tone: 'neutral' };
  return { label: 'Live', tone: 'success' };
}

export default function CollectionsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [collections, setCollections] = useState<readonly Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Collection[]>('/collections/admin/all', token);
      setCollections(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestDelete = (id: string) => setConfirmDeleteId(id);

  const confirmDelete = async () => {
    if (!token || !confirmDeleteId) return;
    setDeleting(true);
    try {
      await adminFetch(`/collections/${confirmDeleteId}`, token, { method: 'DELETE' });
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
      title="Collections"
      description="Seasonal drops, curated edits, automated rails, and promotional groupings."
      breadcrumbs={[{ label: 'Catalog' }, { label: 'Collections' }]}
      actions={
        <PrimaryButton icon="add" onClick={() => setModalOpen(true)}>
          New Collection
        </PrimaryButton>
      }
    >
      {error && <Banner tone="error" message={error} />}

      <SurfaceCard>
        <SurfaceHeader>
          {loading ? 'Loading…' : `${collections.length} Collections`}
        </SurfaceHeader>

        {loading ? (
          <SkeletonList rowHeight={80} />
        ) : collections.length === 0 ? (
          <EmptyState
            icon="collections_bookmark"
            label="No collections yet"
            description="Launch a new seasonal drop or curated edit."
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {collections.map((c) => (
              <CollectionRow
                key={c.id}
                collection={c}
                onDelete={requestDelete}
                onOpenEditor={() => router.push(`/catalog/collections/${c.id}`)}
              />
            ))}
          </ul>
        )}
      </SurfaceCard>

      <CreateCollectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => {
          setModalOpen(false);
          router.push(`/catalog/collections/${id}`);
        }}
      />

      <ConfirmModal
        open={confirmDeleteId !== null}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete collection"
        message="Delete this collection? This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />
    </PageShell>
  );
}

function CollectionRow({
  collection,
  onDelete,
  onOpenEditor,
}: {
  readonly collection: Collection;
  readonly onDelete: (id: string) => void;
  readonly onOpenEditor: () => void;
}) {
  const productCount = collection._count?.products ?? collection.products?.length ?? 0;
  const status = computeStatus(collection);
  const collectionType: CollectionType = collection.type ?? 'EDIT';

  return (
    <li
      onClick={onOpenEditor}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenEditor();
        }
      }}
      className="flex cursor-pointer items-center justify-between px-6 py-4 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden bg-surface-container">
          {collection.image ? (
            <Image
              src={collection.image}
              alt={collection.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <span className="material-symbols-outlined flex h-full items-center justify-center text-secondary">
              collections_bookmark
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-body text-sm font-semibold text-on-surface">
              {collection.name}
            </p>
            <StatusChip label={collectionType} tone={TYPE_TONE[collectionType]} />
            <StatusChip label={status.label} tone={status.tone} />
          </div>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
            /{collection.slug} · {productCount} products
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={`https://denimisiabd.com/collections/${collection.slug}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label="View on storefront"
          className="flex h-8 w-8 items-center justify-center text-secondary transition-colors duration-300 ease-editorial hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            open_in_new
          </span>
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEditor();
          }}
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center text-secondary transition-colors duration-300 ease-editorial hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            edit
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(collection.id);
          }}
          aria-label="Delete"
          className="flex h-8 w-8 items-center justify-center text-secondary transition-colors duration-300 ease-editorial hover:text-primary"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>
            delete
          </span>
        </button>
      </div>
    </li>
  );
}

interface CreateCollectionModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (id: string) => void;
}

function CreateCollectionModal({ open, onClose, onCreated }: CreateCollectionModalProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<CollectionType>('EDIT');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setType('EDIT');
      setFormError('');
    }
  }, [open]);

  const submit = async () => {
    if (!token) return;
    if (!name.trim() || !slug.trim()) {
      setFormError('Name and slug are required');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const created = await adminFetch<{ id: string }>('/collections', token, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          type,
        }),
      });
      onCreated(created.id);
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
      title="New Collection"
      description="Pick a name and type. Configure everything else on the next screen."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            Cancel
          </button>
          <PrimaryButton icon="arrow_forward" onClick={submit} disabled={submitting}>
            {submitting ? 'Creating…' : 'Create & Configure'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <Banner tone="error" message={formError} />}
        <Field label="Name" name="name" required>
          <TextInput
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(slugify(e.target.value));
            }}
            placeholder="Spring '26"
          />
        </Field>
        <Field label="Slug" name="slug" required>
          <TextInput
            id="slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="spring-26"
          />
        </Field>
        <Field
          label="Type"
          name="type"
          required
        >
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as CollectionType)}
            className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
          >
            <option value="DROP">DROP — time-bound campaign (Spring '26, Eid)</option>
            <option value="EDIT">EDIT — evergreen style (Baggy Fit, Wide Leg)</option>
            <option value="AUTO">AUTO — rule-driven (Bestsellers, New Arrivals)</option>
            <option value="PROMO">PROMO — discount-linked (B2G1, Flash Sale)</option>
          </select>
        </Field>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
          You'll set hero images, products, schedule, SEO on the next screen.
        </p>
      </div>
    </Modal>
  );
}
