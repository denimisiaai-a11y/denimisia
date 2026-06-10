'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Checkbox, Field, TextArea, TextInput } from '@/components/form';

interface HomepageSection {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly image: string | null;
  readonly link: string | null;
  readonly position: number;
  readonly isActive: boolean;
  readonly content: Record<string, unknown> | null;
}

// Backend may return a bare array or `{ sections, total }` — `adminFetch` already
// unwraps `json.data ?? json`, so we still need to handle both after that.
type SectionsResponse =
  | readonly HomepageSection[]
  | { readonly sections: readonly HomepageSection[]; readonly total: number };

function toSectionsArray(data: SectionsResponse): readonly HomepageSection[] {
  if (Array.isArray(data)) return data;
  return (data as { sections: readonly HomepageSection[] }).sections ?? [];
}

// Accepts absolute URLs (http/https) or root-relative paths ('/image.jpg').
function isValidImageUrl(s: string): boolean {
  if (s.startsWith('/')) return true;
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export default function DesignPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [sections, setSections] = useState<readonly HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HomepageSection | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<HomepageSection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<SectionsResponse>('/cms/sections', token);
      setSections(toSectionsArray(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sections');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!token || !confirmTarget) return;
    setDeleting(true);
    try {
      await adminFetch(`/cms/sections/${confirmTarget.id}`, token, { method: 'DELETE' });
      setConfirmTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (s: HomepageSection) => {
    if (!token) return;
    try {
      await adminFetch(`/cms/sections/${s.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const sorted = [...sections].sort((a, b) => a.position - b.position);

  const nextPosition = useMemo(
    () =>
      sections.length === 0
        ? 0
        : Math.max(...sections.map((s) => s.position)) + 1,
    [sections],
  );

  return (
    <PageShell
      title="Design"
      description="Compose the storefront — hero, editorial slabs, and rotating banners."
      breadcrumbs={[{ label: 'Design' }, { label: 'Homepage' }]}
      actions={
        <div className="flex items-center gap-3">
          <Link
            href="/cms/banners"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary transition-colors duration-300 ease-editorial hover:text-on-surface"
          >
            Manage Banners →
          </Link>
          <PrimaryButton icon="add" onClick={() => setModalOpen(true)}>
            New Section
          </PrimaryButton>
        </div>
      }
    >
      {error && <Banner tone="error" message={error} />}

      <SurfaceCard>
        <SurfaceHeader>
          {loading ? 'Loading…' : `${sections.length} Homepage Sections`}
        </SurfaceHeader>

        {loading ? (
          <SkeletonList rowHeight={100} />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="dashboard_customize"
            label="No sections yet"
            description="Compose the storefront by adding hero, feature, and editorial slabs."
            action={
              <PrimaryButton icon="add" onClick={() => setModalOpen(true)}>
                Add First Section
              </PrimaryButton>
            }
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {sorted.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-4 px-6 py-4 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
              >
                <div className="flex flex-1 gap-4">
                  <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden bg-surface-container">
                    {s.image ? (
                      <Image
                        src={s.image}
                        alt={s.title}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined flex h-full items-center justify-center text-2xl text-secondary">
                        dashboard_customize
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-body text-sm font-semibold text-on-surface">
                        {s.title}
                      </p>
                      <StatusChip
                        label={s.isActive ? 'Live' : 'Hidden'}
                        tone={s.isActive ? 'success' : 'neutral'}
                      />
                      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
                        pos {s.position} · {s.key}
                      </span>
                    </div>
                    {s.subtitle && (
                      <p className="mt-1 font-body text-xs text-secondary">
                        {s.subtitle}
                      </p>
                    )}
                    {s.link && (
                      <p className="mt-1 font-mono text-[10px] text-secondary">
                        → {s.link}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <IconButton
                    icon={s.isActive ? 'visibility' : 'visibility_off'}
                    label={s.isActive ? 'Hide' : 'Show'}
                    onClick={() => toggleActive(s)}
                  />
                  <IconButton
                    icon="edit"
                    label="Edit"
                    onClick={() => setEditTarget(s)}
                  />
                  <IconButton
                    icon="delete"
                    label="Delete"
                    tone="danger"
                    onClick={() => setConfirmTarget(s)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceCard>

      <SectionFormModal
        mode="create"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existingKeys={sections.map((s) => s.key)}
        nextPosition={nextPosition}
        section={null}
        onSaved={() => {
          setModalOpen(false);
          void load();
        }}
      />

      <SectionFormModal
        mode="edit"
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        existingKeys={sections.filter((s) => s.id !== editTarget?.id).map((s) => s.key)}
        nextPosition={editTarget?.position ?? nextPosition}
        section={editTarget}
        onSaved={() => {
          setEditTarget(null);
          void load();
        }}
      />

      <ConfirmModal
        open={confirmTarget !== null}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={confirmDelete}
        title="Delete section?"
        message={
          confirmTarget
            ? `"${confirmTarget.title}" will be removed from the homepage.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />
    </PageShell>
  );
}

interface SectionFormModalProps {
  readonly mode: 'create' | 'edit';
  readonly open: boolean;
  readonly onClose: () => void;
  readonly existingKeys: readonly string[];
  readonly nextPosition: number;
  readonly section: HomepageSection | null;
  readonly onSaved: () => void;
}

function SectionFormModal({
  mode,
  open,
  onClose,
  existingKeys,
  nextPosition,
  section,
  onSaved,
}: SectionFormModalProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [image, setImage] = useState('');
  const [link, setLink] = useState('');
  const [position, setPosition] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && section) {
      setKey(section.key);
      setTitle(section.title);
      setSubtitle(section.subtitle ?? '');
      setImage(section.image ?? '');
      setLink(section.link ?? '');
      setPosition(section.position);
      setIsActive(section.isActive);
      setFormError('');
    } else {
      setKey('');
      setTitle('');
      setSubtitle('');
      setImage('');
      setLink('');
      setPosition(nextPosition);
      setIsActive(true);
      setFormError('');
    }
  }, [open, mode, section, nextPosition]);

  const submit = async () => {
    if (!token) return;
    if (!key.trim() || !title.trim()) {
      setFormError('Key and title are required');
      return;
    }
    if (existingKeys.includes(key.trim())) {
      setFormError('Key already exists — pick a unique one');
      return;
    }
    if (!Number.isInteger(position) || position < 0) {
      setFormError('Position must be a non-negative integer');
      return;
    }
    const imageTrimmed = image.trim();
    if (imageTrimmed && !isValidImageUrl(imageTrimmed)) {
      setFormError('Image URL must start with http://, https://, or /');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const body = JSON.stringify({
        key: key.trim(),
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        image: imageTrimmed || undefined,
        link: link.trim() || undefined,
        position,
        isActive,
      });
      if (mode === 'edit' && section) {
        await adminFetch(`/cms/sections/${section.id}`, token, {
          method: 'PATCH',
          body,
        });
      } else {
        await adminFetch('/cms/sections', token, {
          method: 'POST',
          body,
        });
      }
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const heading = mode === 'edit' ? 'Edit Homepage Section' : 'New Homepage Section';
  const cta = mode === 'edit' ? (submitting ? 'Saving…' : 'Save') : submitting ? 'Creating…' : 'Create';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={heading}
      description="A block on the storefront — hero, editorial, feature grid, etc."
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
            {cta}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <Banner tone="error" message={formError} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key" name="key" required hint="Unique identifier">
            <TextInput
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="hero-spring"
              disabled={mode === 'edit'}
            />
          </Field>
          <Field label="Position" name="position" hint="Sort order (lowest first)">
            <TextInput
              id="position"
              type="number"
              min="0"
              value={position}
              onChange={(e) => setPosition(Number(e.target.value) || 0)}
            />
          </Field>
        </div>
        <Field label="Title" name="title" required>
          <TextInput
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Spring Editorial"
          />
        </Field>
        <Field label="Subtitle" name="subtitle">
          <TextArea
            id="subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Image URL" name="image" hint="R2 / CDN link">
          <TextInput
            id="image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Link" name="link" hint="Where it points on click">
          <TextInput
            id="link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/collections/spring"
          />
        </Field>
        <Checkbox
          label="Active — visible on the storefront"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
