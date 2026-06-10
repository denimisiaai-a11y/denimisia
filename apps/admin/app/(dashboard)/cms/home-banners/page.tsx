'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  PrimaryButton,
  StatusChip,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

type MediaKind = 'IMAGE' | 'VIDEO';

interface MediaAsset {
  readonly id: string;
  readonly kind: MediaKind;
  readonly mime: string;
  readonly bytes: number;
  readonly publicUrl: string;
  readonly posterUrl: string | null;
}

interface PageSlotRecord {
  readonly id: string;
  readonly pageKey: string;
  readonly slotKey: string;
  readonly label: string;
  readonly mediaKind: MediaKind;
  readonly acceptsVideo: boolean;
  readonly assetId: string | null;
  readonly asset: MediaAsset | null;
  readonly heading: string | null;
  readonly subheading: string | null;
  readonly body: string | null;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  readonly altText: string | null;
  readonly position: number;
  readonly groupKey: string | null;
  readonly isActive: boolean;
  readonly specWidth: number;
  readonly specHeight: number;
  readonly specAspect: string;
  readonly maxBytes: number;
}

interface SlotsPayload {
  readonly slots: PageSlotRecord[];
}

type FieldKey = 'heading' | 'subheading' | 'body' | 'ctaLabel' | 'ctaHref' | 'altText';

interface FieldSpec {
  readonly key: FieldKey;
  readonly label: string;
  readonly hint?: string;
  readonly multiline?: boolean;
}

const HERO_FIELDS: readonly FieldSpec[] = [
  { key: 'heading',    label: 'Heading',     hint: 'e.g. "Raw Collection"' },
  { key: 'subheading', label: 'Subheading',  hint: 'Sits under the headline.' },
  { key: 'ctaLabel',   label: 'CTA label',   hint: 'Button text (e.g. "Shop now").' },
  { key: 'ctaHref',    label: 'CTA link',    hint: 'Where the button goes (e.g. "/shop").' },
  { key: 'altText',    label: 'Alt text',    hint: 'For accessibility / SEO.' },
];

const EDITORIAL_FIELDS: readonly FieldSpec[] = [
  { key: 'subheading', label: 'Eyebrow',     hint: 'Small label above the title (e.g. "Campaign No. 01").' },
  { key: 'heading',    label: 'Title',       hint: 'The big slide headline.' },
  { key: 'body',       label: 'Subtitle',    hint: 'One-line caption under the title.', multiline: true },
  { key: 'ctaLabel',   label: 'CTA label',   hint: 'Button text (defaults to "Discover").' },
  { key: 'ctaHref',    label: 'CTA link',    hint: 'Where the button goes.' },
  { key: 'altText',    label: 'Alt text',    hint: 'For accessibility / SEO.' },
];

const BRAND_STORY_FIELDS: readonly FieldSpec[] = [
  { key: 'heading',    label: 'Heading' },
  { key: 'body',       label: 'Body copy', multiline: true },
  { key: 'altText',    label: 'Alt text' },
];

const CATEGORY_CARD_FIELDS: readonly FieldSpec[] = [
  { key: 'heading',    label: 'Card title', hint: 'e.g. "Wide-Leg".' },
  { key: 'ctaHref',    label: 'Card link',  hint: 'e.g. "/shop/womens/womens-wide-leg".' },
  { key: 'altText',    label: 'Alt text' },
];

const HERO_SLOT_KEYS = ['hero_main'] as const;
const EDITORIAL_SLOT_KEYS = [
  'editorial_slide_1',
  'editorial_slide_2',
  'editorial_slide_3',
  'editorial_slide_4',
] as const;
const BRAND_STORY_SLOT_KEYS = ['brand_story_backdrop'] as const;
const CATEGORY_CARD_SLOT_KEYS = [
  'category_card_1',
  'category_card_2',
  'category_card_3',
] as const;

function bySlotKey(slots: readonly PageSlotRecord[]): Map<string, PageSlotRecord> {
  return new Map(slots.map((s) => [s.slotKey, s]));
}

function isSlotFilled(slot: PageSlotRecord | undefined): boolean {
  if (!slot) return false;
  return Boolean(slot.asset?.publicUrl || slot.heading || slot.subheading || slot.body);
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function HomeBannersPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [slots, setSlots] = useState<PageSlotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const payload = await adminFetch<SlotsPayload>('/media/slots?page=home');
      setSlots(payload.slots);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load slots.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const slotByKey = useMemo(() => bySlotKey(slots), [slots]);

  const onSlotUpdated = useCallback((updated: PageSlotRecord) => {
    setSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const filledEditorialCount = useMemo(
    () => EDITORIAL_SLOT_KEYS.filter((k) => isSlotFilled(slotByKey.get(k))).length,
    [slotByKey],
  );

  return (
    <PageShell
      title="Home Banners"
      description="Upload and edit every banner on the storefront home page — hero, editorial carousel, brand story, and category cards."
      breadcrumbs={[
        { label: 'CMS', href: '/cms' },
        { label: 'Home Banners' },
      ]}
    >
      {error && (
        <div className="mb-6">
          <Banner tone="error" message={error} />
        </div>
      )}

      {loading ? (
        <SurfaceCard className="px-6 py-12 text-center text-sm text-secondary">
          Loading slots…
        </SurfaceCard>
      ) : (
        <div className="flex flex-col gap-8">
          <Section title="Hero — fullscreen banner at the top of the home page">
            {HERO_SLOT_KEYS.map((key) => {
              const slot = slotByKey.get(key);
              return (
                <Fragment key={key}>
                  {slot ? (
                    <SlotCard
                      slot={slot}
                      token={token}
                      fields={HERO_FIELDS}
                      onUpdated={onSlotUpdated}
                    />
                  ) : (
                    <MissingSlot slotKey={key} />
                  )}
                </Fragment>
              );
            })}
          </Section>

          <Section
            title={`Editorial carousel — ${filledEditorialCount}/${EDITORIAL_SLOT_KEYS.length} slides with content`}
          >
            {EDITORIAL_SLOT_KEYS.map((key) => {
              const slot = slotByKey.get(key);
              return (
                <Fragment key={key}>
                  {slot ? (
                    <SlotCard
                      slot={slot}
                      token={token}
                      fields={EDITORIAL_FIELDS}
                      removable
                      onUpdated={onSlotUpdated}
                    />
                  ) : (
                    <MissingSlot slotKey={key} />
                  )}
                </Fragment>
              );
            })}
          </Section>

          <Section title="Brand story — backdrop image and copy on the home page">
            {BRAND_STORY_SLOT_KEYS.map((key) => {
              const slot = slotByKey.get(key);
              return (
                <Fragment key={key}>
                  {slot ? (
                    <SlotCard
                      slot={slot}
                      token={token}
                      fields={BRAND_STORY_FIELDS}
                      onUpdated={onSlotUpdated}
                    />
                  ) : (
                    <MissingSlot slotKey={key} />
                  )}
                </Fragment>
              );
            })}
          </Section>

          <Section title="Category cards — three tiles below the hero">
            {CATEGORY_CARD_SLOT_KEYS.map((key) => {
              const slot = slotByKey.get(key);
              return (
                <Fragment key={key}>
                  {slot ? (
                    <SlotCard
                      slot={slot}
                      token={token}
                      fields={CATEGORY_CARD_FIELDS}
                      onUpdated={onSlotUpdated}
                    />
                  ) : (
                    <MissingSlot slotKey={key} />
                  )}
                </Fragment>
              );
            })}
          </Section>
        </div>
      )}
    </PageShell>
  );
}

interface SectionProps {
  readonly title: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}

function Section({ title, action, children }: SectionProps) {
  return (
    <SurfaceCard>
      <SurfaceHeader action={action}>{title}</SurfaceHeader>
      <div className="flex flex-col gap-4 p-6">{children}</div>
    </SurfaceCard>
  );
}

function MissingSlot({ slotKey }: { readonly slotKey: string }) {
  return (
    <div className="rounded border border-dashed border-outline-variant/40 px-4 py-6 text-center text-xs text-secondary">
      Slot <code className="font-mono">{slotKey}</code> is not in the database yet.
      Run <code className="font-mono">pnpm --filter database seed:media</code> in the
      monorepo root, then refresh.
    </div>
  );
}

interface SlotCardProps {
  readonly slot: PageSlotRecord;
  readonly token: string | undefined;
  readonly fields: readonly FieldSpec[];
  readonly removable?: boolean;
  readonly onUpdated: (slot: PageSlotRecord) => void;
}

function SlotCard({ slot, token, fields, removable, onUpdated }: SlotCardProps) {
  const [text, setText] = useState<Record<FieldKey, string>>(() => ({
    heading:    slot.heading    ?? '',
    subheading: slot.subheading ?? '',
    body:       slot.body       ?? '',
    ctaLabel:   slot.ctaLabel   ?? '',
    ctaHref:    slot.ctaHref    ?? '',
    altText:    slot.altText    ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [cardError, setCardError] = useState('');

  useEffect(() => {
    setText({
      heading:    slot.heading    ?? '',
      subheading: slot.subheading ?? '',
      body:       slot.body       ?? '',
      ctaLabel:   slot.ctaLabel   ?? '',
      ctaHref:    slot.ctaHref    ?? '',
      altText:    slot.altText    ?? '',
    });
  }, [slot.id, slot.heading, slot.subheading, slot.body, slot.ctaLabel, slot.ctaHref, slot.altText]);

  const setField = (key: FieldKey, value: string) =>
    setText((prev) => ({ ...prev, [key]: value }));

  const onUpload = async (file: File | null) => {
    if (!file || !token) return;
    if (file.size > slot.maxBytes) {
      setCardError(`File is ${formatBytes(file.size)} — max is ${formatBytes(slot.maxBytes)}.`);
      return;
    }
    setUploading(true);
    setCardError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(
        `${API}/media/admin/upload?page=${slot.pageKey}&slot=${slot.slotKey}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Upload failed: ${res.status}`);
      }
      const json = await res.json();
      onUpdated((json.data ?? json) as PageSlotRecord);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!token) return;
    setSaving(true);
    setCardError('');
    try {
      const payload: Partial<Record<FieldKey, string>> = {};
      fields.forEach((f) => {
        payload[f.key] = text[f.key];
      });
      const updated = await adminFetch<PageSlotRecord>(
        `/media/admin/slots/${slot.pageKey}/${slot.slotKey}`,
        token,
        { method: 'PATCH', body: JSON.stringify(payload) },
      );
      onUpdated(updated);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    if (!token) return;
    if (!confirm(`Clear "${slot.label}"? The image and all text fields will be removed.`)) return;
    setRemoving(true);
    setCardError('');
    try {
      const updated = await adminFetch<PageSlotRecord>(
        `/media/admin/slots/${slot.pageKey}/${slot.slotKey}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            assetId: null,
            heading: '',
            subheading: '',
            body: '',
            ctaLabel: '',
            ctaHref: '',
            altText: '',
          }),
        },
      );
      onUpdated(updated);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Remove failed.');
    } finally {
      setRemoving(false);
    }
  };

  const filled = isSlotFilled(slot);

  return (
    <div className="rounded border border-outline-variant/30 bg-surface-container-lowest p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-headline text-sm font-semibold uppercase tracking-[0.18em] text-on-surface">
            {slot.label}
          </span>
          <StatusChip
            label={filled ? 'Active' : 'Empty'}
            tone={filled ? 'success' : 'neutral'}
          />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
          {slot.specAspect} · {formatBytes(slot.maxBytes)} max
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-[260px_1fr]">
        <div>
          <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded bg-surface-container">
            {slot.asset?.publicUrl ? (
              slot.asset.kind === 'VIDEO' ? (
                <video
                  src={slot.asset.publicUrl}
                  poster={slot.asset.posterUrl ?? undefined}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={slot.asset.publicUrl}
                  alt={slot.altText ?? ''}
                  className="h-full w-full object-cover"
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-secondary">
                No image uploaded
              </div>
            )}
          </div>
          <label className="block">
            <span className="sr-only">Upload image or video</span>
            <input
              type="file"
              accept={slot.acceptsVideo ? 'image/*,video/*' : 'image/*'}
              disabled={uploading}
              onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:mr-3 file:cursor-pointer file:border-0 file:bg-inverse-surface file:px-3 file:py-2 file:text-[10px] file:font-bold file:uppercase file:tracking-[0.15em] file:text-inverse-on-surface hover:file:scale-[1.02]"
            />
          </label>
          {uploading && <p className="mt-2 text-xs text-secondary">Uploading…</p>}
          <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-secondary">
            Recommended: {slot.specWidth}×{slot.specHeight}
            {slot.acceptsVideo ? ' · image or video' : ' · image only'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {fields.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
                {f.label}
              </span>
              {f.multiline ? (
                <textarea
                  rows={3}
                  value={text[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={text[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
                />
              )}
              {f.hint && (
                <span className="mt-1 block text-[10px] text-secondary">{f.hint}</span>
              )}
            </label>
          ))}

          {cardError && (
            <div className="text-xs text-[#c62828] dark:text-[#ff8a80]">{cardError}</div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <PrimaryButton icon="save" onClick={onSave} disabled={saving || !token}>
              {saving ? 'Saving…' : 'Save text'}
            </PrimaryButton>
            {removable && filled && (
              <button
                type="button"
                onClick={onRemove}
                disabled={removing || !token}
                className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary transition-colors hover:text-[#c62828] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden>
                  delete
                </span>
                {removing ? 'Removing…' : 'Remove slide'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
