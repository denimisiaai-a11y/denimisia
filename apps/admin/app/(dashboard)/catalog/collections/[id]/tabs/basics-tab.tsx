'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Field, TextArea, TextInput, slugify } from '@/components/form';
import { Banner, PrimaryButton } from '@/components/admin-ui';
import type { CollectionDetail } from '../editor-shell';

type CollectionType = 'DROP' | 'EDIT' | 'AUTO' | 'PROMO';

interface Props {
  readonly collection: CollectionDetail;
  readonly onSaved: (c: CollectionDetail) => void;
}

const TYPE_HINTS: Record<CollectionType, string> = {
  DROP: 'Time-bound campaign — uses countdown, lookbook, scheduled launch.',
  EDIT: 'Evergreen style edit — filter-focused, no countdown.',
  AUTO: 'Rule-driven — auto-populates products from bestsellers, new arrivals, categories.',
  PROMO: 'Discount-linked — links to a promo code, auto-applies at checkout.',
};

export function BasicsTab({ collection, onSaved }: Props) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [form, setForm] = useState({
    name: collection.name,
    slug: collection.slug,
    type: collection.type,
    subtitle: collection.subtitle ?? '',
    description: collection.description ?? '',
    internalNote: collection.internalNote ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminFetch<CollectionDetail>(
        `/collections/${collection.id}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            slug: form.slug,
            type: form.type,
            subtitle: form.subtitle || undefined,
            description: form.description || undefined,
            internalNote: form.internalNote || undefined,
          }),
        },
      );
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl">Basics</h2>
        <p className="mt-1 text-sm text-secondary">
          Core identity of this collection. Name, URL slug, and what role it plays in your store.
        </p>
      </div>

      {error && <Banner tone="error" message={error} />}

      <Field label="Name" name="name" required>
        <TextInput
          id="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>

      <Field
        label="Slug"
        name="slug"
        required
        hint="lowercase letters, numbers, hyphens. Changing this breaks old links and SEO."
      >
        <TextInput
          id="slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
        />
      </Field>

      <Field label="Type" name="type" required hint={TYPE_HINTS[form.type]}>
        <select
          id="type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as CollectionType })}
          className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
        >
          <option value="DROP">DROP — time-bound campaign</option>
          <option value="EDIT">EDIT — evergreen style</option>
          <option value="AUTO">AUTO — rule-driven</option>
          <option value="PROMO">PROMO — discount-linked</option>
        </select>
      </Field>

      <Field
        label="Subtitle / Tagline"
        name="subtitle"
        hint="One line shown over the hero image. Keep it tight."
      >
        <TextInput
          id="subtitle"
          value={form.subtitle}
          onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
          placeholder="Lightweight denim for warmer days"
        />
      </Field>

      <Field
        label="Description"
        name="description"
        hint="Markdown allowed. Shown on the collection landing page as editorial copy."
      >
        <TextArea
          id="description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={6}
        />
      </Field>

      <Field
        label="Internal note"
        name="internalNote"
        hint="Admin-only. Never shown to customers. Use for context, ownership, deadlines."
      >
        <TextArea
          id="internalNote"
          value={form.internalNote}
          onChange={(e) => setForm({ ...form, internalNote: e.target.value })}
          rows={2}
        />
      </Field>

      <div className="border-t border-outline-variant/10 pt-6">
        <PrimaryButton icon="check" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Basics'}
        </PrimaryButton>
      </div>
    </div>
  );
}
