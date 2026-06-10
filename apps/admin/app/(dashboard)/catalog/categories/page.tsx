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
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';
import { Modal, ConfirmModal } from '@/components/modal';
import { Field, Select, TextArea, TextInput, slugify } from '@/components/form';
import { ImageUploader } from '@/components/image-uploader';

interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly image: string | null;
  readonly parentId: string | null;
  readonly _count?: { readonly products: number };
}

export default function CategoriesPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Category[]>('/categories', token);
      setCategories(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
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
      await adminFetch(`/categories/${confirmDeleteId}`, token, {
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

  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  return (
    <PageShell
      title="Categories"
      description="Organize the catalog into an editorial taxonomy."
      breadcrumbs={[{ label: 'Catalog' }, { label: 'Categories' }]}
      actions={
        <PrimaryButton icon="add" onClick={() => setModalOpen(true)}>
          New Category
        </PrimaryButton>
      }
    >
      {error && <Banner tone="error" message={error} />}

      <SurfaceCard>
        <SurfaceHeader>{loading ? 'Loading…' : `${categories.length} Total`}</SurfaceHeader>

        {loading ? (
          <SkeletonList />
        ) : roots.length === 0 ? (
          <EmptyState
            icon="category"
            label="No categories yet"
            description="Create a root category to start building the taxonomy."
            action={
              <PrimaryButton icon="add" onClick={() => setModalOpen(true)}>
                Create First Category
              </PrimaryButton>
            }
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {roots.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                children_={childrenOf(cat.id)}
                onDelete={requestDelete}
                onEdit={setEditingCategory}
              />
            ))}
          </ul>
        )}
      </SurfaceCard>

      <CreateCategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        categories={categories}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />

      <EditCategoryModal
        category={editingCategory}
        categories={categories}
        onClose={() => setEditingCategory(null)}
        onSaved={() => {
          setEditingCategory(null);
          void load();
        }}
      />

      <ConfirmModal
        open={confirmDeleteId !== null}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete category"
        message="Delete this category? Products assigned to it will remain in the DB."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />
    </PageShell>
  );
}

interface CategoryRowProps {
  readonly cat: Category;
  readonly children_: readonly Category[];
  readonly onDelete: (id: string) => void;
  readonly onEdit: (cat: Category) => void;
}

function CategoryRow({ cat, children_, onDelete, onEdit }: CategoryRowProps) {
  return (
    <li>
      <div className="flex items-center justify-between px-6 py-4 transition-colors duration-300 ease-editorial hover:bg-surface-container-low">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-secondary" aria-hidden>
            folder
          </span>
          <div>
            <p className="font-body text-sm font-semibold text-on-surface">{cat.name}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
              /{cat.slug}
              {cat._count && ` · ${cat._count.products} products`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon="edit" label="Edit" onClick={() => onEdit(cat)} />
          <IconButton icon="delete" label="Delete" tone="danger" onClick={() => onDelete(cat.id)} />
        </div>
      </div>
      {children_.length > 0 && (
        <ul className="border-t border-outline-variant/10">
          {children_.map((child) => (
            <li
              key={child.id}
              className="flex items-center justify-between border-b border-outline-variant/10 px-6 py-3 pl-16 transition-colors duration-300 ease-editorial last:border-b-0 hover:bg-surface-container-low"
            >
              <div className="flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-sm text-secondary"
                  aria-hidden
                >
                  subdirectory_arrow_right
                </span>
                <p className="font-body text-sm text-on-surface">{child.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
                  /{child.slug}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  icon="edit"
                  label="Edit"
                  onClick={() => onEdit(child)}
                />
                <IconButton
                  icon="delete"
                  label="Delete"
                  tone="danger"
                  onClick={() => onDelete(child.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface CreateCategoryModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly categories: readonly Category[];
  readonly onCreated: () => void;
}

function CreateCategoryModal({
  open,
  onClose,
  categories,
  onCreated,
}: CreateCategoryModalProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [parentId, setParentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setDescription('');
      setImage('');
      setParentId('');
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
      await adminFetch('/categories', token, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          image: image.trim() || undefined,
          parentId: parentId || undefined,
        }),
      });
      onCreated();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  const roots = categories.filter((c) => !c.parentId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Category"
      description="Create a root category or a sub-category."
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
            placeholder="Women's Wide-Leg"
          />
        </Field>
        <Field label="Slug" name="slug" required hint="URL-safe identifier">
          <TextInput
            id="slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="wide-leg-women"
          />
        </Field>
        <Field label="Parent Category" name="parent" hint="Leave empty for root">
          <Select
            id="parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">— Root —</option>
            {roots.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" name="description">
          <TextArea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Editorial notes on this category."
            rows={3}
          />
        </Field>
        <Field
          label="Category image"
          name="image"
          hint="Used as the storefront category-card image."
        >
          <ImageUploader
            value={image ? [image] : []}
            onChange={(urls) => setImage(urls[0] ?? '')}
            token={token}
            folder="cms"
            maxFiles={1}
          />
        </Field>
      </div>
    </Modal>
  );
}

interface EditCategoryModalProps {
  readonly category: Category | null;
  readonly categories: readonly Category[];
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

function EditCategoryModal({
  category,
  categories,
  onClose,
  onSaved,
}: EditCategoryModalProps) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [parentId, setParentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name);
      setSlug(category.slug);
      setDescription(category.description ?? '');
      setImage(category.image ?? '');
      setParentId(category.parentId ?? '');
      setFormError('');
    }
  }, [category]);

  const submit = async () => {
    if (!token || !category) return;
    if (!name.trim() || !slug.trim()) {
      setFormError('Name and slug are required');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await adminFetch(`/categories/${category.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          image: image.trim() || null,
          parentId: parentId || null,
        }),
      });
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const parentOptions = categories.filter(
    (c) => !c.parentId && c.id !== category?.id,
  );

  return (
    <Modal
      open={category !== null}
      onClose={onClose}
      title="Edit Category"
      description="Update name, slug, or parent."
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
        <Field label="Name" name="edit-name" required>
          <TextInput
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Slug"
          name="edit-slug"
          required
          hint="URL-safe identifier"
        >
          <TextInput
            id="edit-slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
          />
        </Field>
        <Field
          label="Parent Category"
          name="edit-parent"
          hint="Leave empty for root"
        >
          <Select
            id="edit-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">â€” Root â€”</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" name="edit-description">
          <TextArea
            id="edit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>
        <Field
          label="Category image"
          name="edit-image"
          hint="Used as the storefront category-card image."
        >
          <ImageUploader
            value={image ? [image] : []}
            onChange={(urls) => setImage(urls[0] ?? '')}
            token={token}
            folder="cms"
            maxFiles={1}
          />
        </Field>
      </div>
    </Modal>
  );
}
