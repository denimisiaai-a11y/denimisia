'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Field, TextInput } from '@/components/form';
import { Banner, PrimaryButton } from '@/components/admin-ui';
import { ImageUploader } from '@/components/image-uploader';
import type { CollectionDetail } from '../editor-shell';

interface Props {
  readonly collection: CollectionDetail;
  readonly onSaved: (c: CollectionDetail) => void;
  readonly onReload: () => Promise<void>;
}

export function VisualsTab({ collection, onSaved, onReload }: Props) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [form, setForm] = useState({
    image: collection.image ?? '',
    heroImageDesktop: collection.heroImageDesktop ?? '',
    heroImageMobile: collection.heroImageMobile ?? '',
    heroVideo: collection.heroVideo ?? '',
    heroTextColor: collection.heroTextColor || 'light',
    heroOverlay: collection.heroOverlay ?? 30,
    heroAlign: collection.heroAlign || 'left',
    backgroundColor: collection.backgroundColor ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lookbook
  const [lookbookCaption, setLookbookCaption] = useState('');
  const [lookbookBusy, setLookbookBusy] = useState(false);

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await adminFetch<CollectionDetail>(
        `/collections/${collection.id}`,
        token,
        { method: 'PATCH', body: JSON.stringify(form) },
      );
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function addLookbookItem(imageUrl: string) {
    if (!token || !imageUrl) return;
    setLookbookBusy(true);
    try {
      await adminFetch(`/collections/${collection.id}/lookbook`, token, {
        method: 'POST',
        body: JSON.stringify({
          imageUrl,
          caption: lookbookCaption || undefined,
          position: collection.lookbook.length,
        }),
      });
      setLookbookCaption('');
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add lookbook image failed');
    } finally {
      setLookbookBusy(false);
    }
  }

  async function removeLookbookItem(id: string) {
    if (!token) return;
    setLookbookBusy(true);
    try {
      await adminFetch(`/collections/lookbook/${id}`, token, { method: 'DELETE' });
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setLookbookBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="font-display text-xl">Visuals</h2>
        <p className="mt-1 text-sm text-secondary">
          Hero imagery, video, overlay styling, thumbnail, and lookbook gallery interspersed between products.
        </p>
      </div>

      {error && <Banner tone="error" message={error} />}

      {/* Thumbnail */}
      <div className="space-y-2">
        <h3 className="font-display text-base">Thumbnail</h3>
        <p className="text-sm text-secondary">
          Used in admin list, homepage cards, mega-menu, search results. 1:1 square.
        </p>
        <ImageUploader
          value={form.image ? [form.image] : []}
          onChange={(urls) => setForm({ ...form, image: urls[0] ?? '' })}
          token={token}
          folder="cms"
          maxFiles={1}
        />
      </div>

      {/* Hero images */}
      <div className="space-y-4 border-t border-outline-variant/10 pt-6">
        <h3 className="font-display text-base">Hero</h3>

        <Field label="Hero image (desktop)" name="heroImageDesktop" hint="Wide format — 16:9 or 21:9 looks best.">
          <ImageUploader
            value={form.heroImageDesktop ? [form.heroImageDesktop] : []}
            onChange={(urls) => setForm({ ...form, heroImageDesktop: urls[0] ?? '' })}
            token={token}
            folder="cms"
            maxFiles={1}
          />
        </Field>

        <Field label="Hero image (mobile)" name="heroImageMobile" hint="Portrait 4:5. Falls back to desktop if blank.">
          <ImageUploader
            value={form.heroImageMobile ? [form.heroImageMobile] : []}
            onChange={(urls) => setForm({ ...form, heroImageMobile: urls[0] ?? '' })}
            token={token}
            folder="cms"
            maxFiles={1}
          />
        </Field>

        <Field
          label="Hero video URL"
          name="heroVideo"
          hint="Optional. Plays muted, auto-loops. Used when hero layout is VIDEO."
        >
          <TextInput
            id="heroVideo"
            type="url"
            value={form.heroVideo}
            onChange={(e) => setForm({ ...form, heroVideo: e.target.value })}
            placeholder="https://..."
          />
        </Field>
      </div>

      {/* Hero overlay styling */}
      <div className="space-y-4 border-t border-outline-variant/10 pt-6">
        <h3 className="font-display text-base">Hero overlay</h3>

        <Field label="Text color over hero" name="heroTextColor">
          <select
            id="heroTextColor"
            value={form.heroTextColor}
            onChange={(e) => setForm({ ...form, heroTextColor: e.target.value })}
            className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
          >
            <option value="light">Light text (for dark images)</option>
            <option value="dark">Dark text (for light images)</option>
          </select>
        </Field>

        <Field
          label={`Overlay strength: ${form.heroOverlay}%`}
          name="heroOverlay"
          hint="Dark gradient over the hero image to improve text legibility. 0 = no overlay, 100 = solid."
        >
          <input
            id="heroOverlay"
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.heroOverlay}
            onChange={(e) => setForm({ ...form, heroOverlay: Number(e.target.value) })}
            className="w-full"
          />
        </Field>

        <Field label="Text alignment" name="heroAlign">
          <div className="flex gap-2">
            {(['left', 'center', 'right'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setForm({ ...form, heroAlign: opt })}
                className={`flex-1 border px-4 py-2 text-sm capitalize transition-colors ${
                  form.heroAlign === opt
                    ? 'border-on-surface bg-surface-container-low'
                    : 'border-outline-variant/30 hover:border-outline-variant/60'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Background color"
          name="backgroundColor"
          hint="Hex code for sections without imagery. Used by MINIMAL hero layout."
        >
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={form.backgroundColor || '#000000'}
              onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })}
              className="h-10 w-14 bg-transparent cursor-pointer"
            />
            <TextInput
              id="backgroundColor"
              value={form.backgroundColor}
              onChange={(e) => setForm({ ...form, backgroundColor: e.target.value })}
              placeholder="#000000"
            />
          </div>
        </Field>
      </div>

      <div className="border-t border-outline-variant/10 pt-6">
        <PrimaryButton icon="check" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Visuals'}
        </PrimaryButton>
      </div>

      {/* Lookbook gallery */}
      <div className="space-y-4 border-t border-outline-variant/10 pt-8">
        <div>
          <h3 className="font-display text-base">Lookbook gallery</h3>
          <p className="mt-1 text-sm text-secondary">
            Editorial images shown between product rows on the collection page. Up to 8.
          </p>
        </div>

        <div className="space-y-3">
          {collection.lookbook.length === 0 && (
            <p className="text-sm text-secondary italic">No lookbook images yet.</p>
          )}
          {collection.lookbook.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border border-outline-variant/20 p-3"
            >
              <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden bg-surface-container">
                <Image src={item.imageUrl} alt={item.caption ?? ''} fill className="object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-on-surface">{item.caption || '(no caption)'}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary mt-0.5">
                  Position {item.position}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeLookbookItem(item.id)}
                disabled={lookbookBusy}
                aria-label="Remove"
                className="flex h-8 w-8 items-center justify-center text-secondary hover:text-primary"
              >
                <span className="material-symbols-outlined text-base" aria-hidden>delete</span>
              </button>
            </div>
          ))}
        </div>

        <div className="border border-dashed border-outline-variant/30 p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
            Add lookbook image
          </p>
          <TextInput
            id="lookbookCaption"
            value={lookbookCaption}
            onChange={(e) => setLookbookCaption(e.target.value)}
            placeholder="Caption (optional) — 'Photographed in Cox's Bazar'"
          />
          <ImageUploader
            value={[]}
            onChange={(urls) => {
              if (urls[0]) void addLookbookItem(urls[0]);
            }}
            token={token}
            folder="cms"
            maxFiles={1}
          />
        </div>
      </div>
    </div>
  );
}
