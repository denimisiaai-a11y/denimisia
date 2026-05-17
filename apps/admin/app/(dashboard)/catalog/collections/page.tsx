'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
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
import { Checkbox, Field, TextArea, TextInput, slugify } from '@/components/form';
import { ManageCollectionModal } from './manage-collection-modal';

interface Collection {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly image: string | null;
  readonly isActive: boolean;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly products?: readonly { readonly productId: string }[];
  readonly _count?: { readonly products: number };
}

export default function CollectionsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [collections, setCollections] = useState<readonly Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Collection[]>('/collections', token);
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
      await adminFetch(`/collections/${confirmDeleteId}`, token, {
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
      title="Collections"
      description="Seasonal drops, featured edits, and curated launches."
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
              <CollectionRow key={c.id} collection={c} onDelete={requestDelete} onManage={() => setManageId(c.id)} />
            ))}
          </ul>
        )}
      </SurfaceCard>

      <CreateCollectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />

      <ManageCollectionModal
        open={manageId !== null}
        collectionId={manageId}
        onClose={() => setManageId(null)}
        onChanged={() => void load()}
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
  onManage,
}: {
  readonly collection: Collection;
  readonly onDelete: (id: string) => void;
  readonly onManage: () => void;
}) {
  const productCount =
    collection._count?.products ?? collection.products?.length ?? 0;

  return (
    <li
      onClick={onManage}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onManage(); } }}
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
            <StatusChip
              label={collection.isActive ? 'Active' : 'Draft'}
              tone={collection.isActive ? 'success' : 'neutral'}
            />
          </div>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
            /{collection.slug} · {productCount} products
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onManage();
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
  readonly onCreated: () => void;
}

function CreateCollectionModal({ open, onClose, onCreated }: CreateCollectionModalProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setDescription('');
      setIsActive(true);
      setStartDate('');
      setEndDate('');
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
      await adminFetch('/collections', token, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          isActive,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
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
      title="New Collection"
      description="Group products into a seasonal drop or curated edit."
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
            {submitting ? 'Creating…' : 'Create'}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Date" name="startDate">
            <TextInput
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End Date" name="endDate">
            <TextInput
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Checkbox
          label="Active — visible on storefront"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
