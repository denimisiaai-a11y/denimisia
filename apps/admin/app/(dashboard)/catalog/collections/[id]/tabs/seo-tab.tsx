'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Field, TextArea, TextInput, Checkbox } from '@/components/form';
import { Banner, PrimaryButton } from '@/components/admin-ui';
import { ImageUploader } from '@/components/image-uploader';
import type { CollectionDetail } from '../editor-shell';

interface Props {
  readonly collection: CollectionDetail;
  readonly onSaved: (c: CollectionDetail) => void;
}

export function SeoTab({ collection, onSaved }: Props) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [form, setForm] = useState({
    seoTitle: collection.seoTitle ?? '',
    seoDescription: collection.seoDescription ?? '',
    ogImage: collection.ogImage ?? '',
    showInNav: collection.showInNav,
    navOrder: collection.navOrder,
    isFeaturedHome: collection.isFeaturedHome,
    homepageSlot: collection.homepageSlot ?? 1,
    showAsRail: collection.showAsRail,
    railTitle: collection.railTitle ?? '',
    promoCode: collection.promoCode ?? '',
    utmSource: collection.utmSource ?? `collection-${collection.slug}`,
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
            seoTitle: form.seoTitle || undefined,
            seoDescription: form.seoDescription || undefined,
            ogImage: form.ogImage || undefined,
            showInNav: form.showInNav,
            navOrder: form.navOrder,
            isFeaturedHome: form.isFeaturedHome,
            homepageSlot: form.isFeaturedHome ? form.homepageSlot : undefined,
            showAsRail: form.showAsRail,
            railTitle: form.railTitle || undefined,
            promoCode: form.promoCode || undefined,
            utmSource: form.utmSource || undefined,
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

  const effectiveTitle = form.seoTitle || `${collection.name} — Denimisia`;
  const effectiveDesc =
    form.seoDescription ||
    (collection.description ?? '').slice(0, 160) ||
    'Curated collection from Denimisia.';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl">SEO & Marketing</h2>
        <p className="mt-1 text-sm text-secondary">
          Search visibility, social previews, and where this collection surfaces across the site.
        </p>
      </div>

      {error && <Banner tone="error" message={error} />}

      {/* Search */}
      <div className="space-y-4">
        <h3 className="font-display text-base">Search & meta</h3>

        <Field
          label="SEO title"
          name="seoTitle"
          hint={`${form.seoTitle.length}/60 — defaults to "${collection.name} — Denimisia"`}
        >
          <TextInput
            id="seoTitle"
            value={form.seoTitle}
            maxLength={70}
            onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
            placeholder={`${collection.name} — Denimisia`}
          />
        </Field>

        <Field
          label="SEO description"
          name="seoDescription"
          hint={`${form.seoDescription.length}/160 — falls back to first 160 chars of description`}
        >
          <TextArea
            id="seoDescription"
            value={form.seoDescription}
            maxLength={200}
            onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
            rows={3}
          />
        </Field>

        <Field label="Open Graph image" name="ogImage" hint="Used in WhatsApp, Facebook, Twitter shares. Defaults to hero image.">
          <ImageUploader
            value={form.ogImage ? [form.ogImage] : []}
            onChange={(urls) => setForm({ ...form, ogImage: urls[0] ?? '' })}
            token={token}
            folder="cms"
            maxFiles={1}
          />
        </Field>

        {/* Google preview */}
        <div className="border border-outline-variant/20 bg-surface-container-low p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary mb-2">
            Google preview
          </p>
          <p className="text-sm text-blue-400 truncate">denimisiabd.com/collections/{collection.slug}</p>
          <p className="text-base text-blue-600 truncate">{effectiveTitle}</p>
          <p className="text-xs text-secondary line-clamp-2 mt-1">{effectiveDesc}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-outline-variant/10 pt-6 space-y-4">
        <h3 className="font-display text-base">Navigation</h3>

        <Checkbox
          label="Show in main nav mega-menu"
          checked={form.showInNav}
          onChange={(e) => setForm({ ...form, showInNav: e.target.checked })}
        />

        {form.showInNav && (
          <Field label="Nav order" name="navOrder" hint="Lower numbers appear first in the menu.">
            <TextInput
              id="navOrder"
              type="number"
              value={form.navOrder}
              onChange={(e) => setForm({ ...form, navOrder: Number(e.target.value) })}
            />
          </Field>
        )}
      </div>

      {/* Homepage */}
      <div className="border-t border-outline-variant/10 pt-6 space-y-4">
        <h3 className="font-display text-base">Homepage</h3>

        <Checkbox
          label="Featured in homepage drops carousel"
          checked={form.isFeaturedHome}
          onChange={(e) => setForm({ ...form, isFeaturedHome: e.target.checked })}
        />

        {form.isFeaturedHome && (
          <Field label="Slot priority (1-5)" name="homepageSlot" hint="1 = first slot in carousel">
            <select
              id="homepageSlot"
              value={form.homepageSlot}
              onChange={(e) => setForm({ ...form, homepageSlot: Number(e.target.value) })}
              className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  Slot {n}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Checkbox
          label="Show as horizontal product rail on homepage"
          checked={form.showAsRail}
          onChange={(e) => setForm({ ...form, showAsRail: e.target.checked })}
        />

        {form.showAsRail && (
          <Field label="Rail title (overrides Name)" name="railTitle">
            <TextInput
              id="railTitle"
              value={form.railTitle}
              onChange={(e) => setForm({ ...form, railTitle: e.target.value })}
              placeholder={collection.name}
            />
          </Field>
        )}
      </div>

      {/* Promo + tracking */}
      <div className="border-t border-outline-variant/10 pt-6 space-y-4">
        <h3 className="font-display text-base">Promo & tracking</h3>

        {collection.type === 'PROMO' && (
          <Field
            label="Linked promo code"
            name="promoCode"
            hint="Discount code that auto-applies for products from this collection."
          >
            <TextInput
              id="promoCode"
              value={form.promoCode}
              onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase() })}
              placeholder="B2G1"
            />
          </Field>
        )}

        <Field
          label="UTM source for share links"
          name="utmSource"
          hint="Appended to all share URLs for analytics tracking."
        >
          <TextInput
            id="utmSource"
            value={form.utmSource}
            onChange={(e) => setForm({ ...form, utmSource: e.target.value })}
          />
        </Field>
      </div>

      <div className="border-t border-outline-variant/10 pt-6">
        <PrimaryButton icon="check" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save SEO & Marketing'}
        </PrimaryButton>
      </div>
    </div>
  );
}
