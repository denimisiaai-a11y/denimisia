'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Field, TextInput, Checkbox } from '@/components/form';
import { Banner, PrimaryButton, StatusChip } from '@/components/admin-ui';
import type { CollectionDetail } from '../editor-shell';

interface Props {
  readonly collection: CollectionDetail;
  readonly onSaved: (c: CollectionDetail) => void;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): string | undefined {
  if (!s) return undefined;
  return new Date(s).toISOString();
}

function formatDistance(date: Date, now: Date): string {
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && !hours) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function ScheduleTab({ collection, onSaved }: Props) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [form, setForm] = useState({
    isActive: collection.isActive,
    startDate: toLocalInput(collection.startDate),
    endDate: toLocalInput(collection.endDate),
    timezone: collection.timezone || 'Asia/Dhaka',
    prelaunchTeaser: collection.prelaunchTeaser,
    postEndBehavior: collection.postEndBehavior || 'hide',
    postEndRedirect: collection.postEndRedirect ?? '',
    visibility: collection.visibility || 'public',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = useMemo(() => {
    const now = new Date();
    if (!form.isActive) return { label: 'Hidden', tone: 'warning' as const, hint: 'Master switch is off' };
    if (form.startDate && new Date(form.startDate) > now) {
      return { label: 'Scheduled', tone: 'info' as const, hint: `Goes live in ${formatDistance(new Date(form.startDate), now)}` };
    }
    if (form.endDate && new Date(form.endDate) < now) {
      return { label: 'Ended', tone: 'neutral' as const, hint: `Ended ${formatDistance(new Date(form.endDate), now)} ago` };
    }
    if (form.endDate) {
      return { label: 'Live', tone: 'success' as const, hint: `Ends in ${formatDistance(new Date(form.endDate), now)}` };
    }
    return { label: 'Live', tone: 'success' as const, hint: 'No end date set — runs indefinitely' };
  }, [form]);

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
            isActive: form.isActive,
            startDate: fromLocalInput(form.startDate),
            endDate: fromLocalInput(form.endDate),
            timezone: form.timezone,
            prelaunchTeaser: form.prelaunchTeaser,
            postEndBehavior: form.postEndBehavior,
            postEndRedirect: form.postEndRedirect || undefined,
            visibility: form.visibility,
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
        <h2 className="font-display text-xl">Schedule & Visibility</h2>
        <p className="mt-1 text-sm text-secondary">
          When customers see this collection, who sees it, and what happens after the campaign ends.
        </p>
      </div>

      <div className="border border-outline-variant/20 bg-surface-container-low p-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary mb-1">
            Current status
          </p>
          <div className="flex items-center gap-2">
            <StatusChip label={status.label} tone={status.tone} />
            <span className="text-sm text-secondary">{status.hint}</span>
          </div>
        </div>
      </div>

      {error && <Banner tone="error" message={error} />}

      <Checkbox
        label="Active — master visibility switch (overrides dates when off)"
        checked={form.isActive}
        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date & Time" name="startDate" hint="Leave blank for immediate.">
          <TextInput
            id="startDate"
            type="datetime-local"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </Field>
        <Field label="End Date & Time" name="endDate" hint="Leave blank to run indefinitely.">
          <TextInput
            id="endDate"
            type="datetime-local"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Timezone" name="timezone" hint="Dates interpreted in this zone.">
        <select
          id="timezone"
          value={form.timezone}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
        >
          <option value="Asia/Dhaka">Asia/Dhaka (BD)</option>
          <option value="UTC">UTC</option>
          <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
          <option value="Asia/Singapore">Asia/Singapore</option>
        </select>
      </Field>

      <div className="border-t border-outline-variant/10 pt-6 space-y-4">
        <h3 className="font-display text-base">Pre-launch & post-end behavior</h3>

        <Checkbox
          label="Show pre-launch teaser page before Start Date"
          checked={form.prelaunchTeaser}
          onChange={(e) => setForm({ ...form, prelaunchTeaser: e.target.checked })}
        />

        <Field label="After End Date" name="postEndBehavior">
          <select
            id="postEndBehavior"
            value={form.postEndBehavior}
            onChange={(e) => setForm({ ...form, postEndBehavior: e.target.value })}
            className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
          >
            <option value="hide">Hide — show 404</option>
            <option value="redirect">Redirect to another collection</option>
            <option value="archive">Archive — show with "ended" banner</option>
          </select>
        </Field>

        {form.postEndBehavior === 'redirect' && (
          <Field label="Redirect target slug" name="postEndRedirect" required>
            <TextInput
              id="postEndRedirect"
              value={form.postEndRedirect}
              onChange={(e) => setForm({ ...form, postEndRedirect: e.target.value })}
              placeholder="bestsellers"
            />
          </Field>
        )}
      </div>

      <div className="border-t border-outline-variant/10 pt-6 space-y-4">
        <h3 className="font-display text-base">Visibility</h3>

        <Field label="Who can see this collection" name="visibility">
          <select
            id="visibility"
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            className="w-full bg-surface-container border border-outline-variant/30 px-3 py-2 text-sm text-on-surface focus:border-on-surface outline-none"
          >
            <option value="public">Public — anyone can find and view</option>
            <option value="direct">Direct link only — not indexed, not in nav</option>
            <option value="members">Members only — must be logged in</option>
          </select>
        </Field>
      </div>

      <div className="border-t border-outline-variant/10 pt-6">
        <PrimaryButton icon="check" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Schedule'}
        </PrimaryButton>
      </div>
    </div>
  );
}
