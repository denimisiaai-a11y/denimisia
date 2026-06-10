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
import { Checkbox, Field, Select, TextInput, slugify } from '@/components/form';
import { CampaignProductsEditor } from '@/components/campaigns/campaign-products-editor';

// Schema enum is FLASH_SALE / SEASONAL / PROMO. Earlier dev iteration had
// CLEARANCE + PRE_ORDER as UI options but those don't pass class-validator
// on the API side and would hard-fail at create time.
type CampaignType = 'FLASH_SALE' | 'SEASONAL' | 'PROMO';

const CAMPAIGN_TYPE_OPTIONS: readonly { value: CampaignType; label: string }[] = [
  { value: 'FLASH_SALE', label: 'Flash Sale' },
  { value: 'SEASONAL', label: 'Seasonal' },
  { value: 'PROMO', label: 'Promo' },
];

interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly type: CampaignType;
  readonly startDate: string;
  readonly endDate: string;
  readonly isActive: boolean;
  readonly products?: readonly { readonly productId: string }[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function campaignStatus(
  c: Campaign,
): { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' } {
  if (!c.isActive) return { label: 'Paused', tone: 'neutral' };
  const now = Date.now();
  const start = new Date(c.startDate).getTime();
  const end = new Date(c.endDate).getTime();
  if (now < start) return { label: 'Scheduled', tone: 'info' };
  if (now > end) return { label: 'Ended', tone: 'neutral' };
  return { label: 'Live', tone: 'success' };
}

// Convert ISO date string to the 'YYYY-MM-DDTHH:mm' form used by <input type="datetime-local">.
function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// Lexical ISO sort key for the current moment, matching <input type="datetime-local"> values
// (YYYY-MM-DDTHH:mm). Compares as strings — avoids timezone ambiguity.
function nowDateTimeLocal(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function CampaignsPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const [campaigns, setCampaigns] = useState<readonly Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionStale, setSessionStale] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // `/campaigns/admin/all` returns all campaigns regardless of
      // isActive or date window — admin needs to see paused, scheduled,
      // and expired ones to manage them. The public `/campaigns` endpoint
      // only returns active-now campaigns.
      const res = await adminFetch<
        { campaigns: Campaign[]; total: number; page: number; limit: number } | Campaign[]
      >('/campaigns/admin/all', token);
      setCampaigns(Array.isArray(res) ? res : res.campaigns ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setError('You are signed out — please sign in to manage campaigns.');
      setLoading(false);
      return;
    }
    if (status === 'authenticated' && token) {
      void load();
      return;
    }
    // Still loading session — but guard against it hanging forever.
    const timer = window.setTimeout(() => {
      if (!token) {
        setSessionStale(true);
        setLoading(false);
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [status, token, load]);

  const deleteCampaign = async () => {
    if (!token || !confirmTarget) return;
    setDeleting(true);
    try {
      await adminFetch(`/campaigns/${confirmTarget.id}`, token, { method: 'DELETE' });
      setConfirmTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageShell
      title="Campaigns"
      description="Flash sales, seasonal drops, and limited runs."
      breadcrumbs={[{ label: 'Marketing' }, { label: 'Campaigns' }]}
      actions={
        <PrimaryButton icon="add" onClick={() => setModalOpen(true)}>
          New Campaign
        </PrimaryButton>
      }
    >
      {sessionStale && (
        <Banner tone="error" message="Session issue — please sign in again." />
      )}
      {error && <Banner tone="error" message={error} />}

      <SurfaceCard>
        <SurfaceHeader>
          {loading ? 'Loading…' : `${campaigns.length} Campaigns`}
        </SurfaceHeader>

        {loading ? (
          <SkeletonList rowHeight={72} />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon="campaign"
            label="No campaigns yet"
            description="Kick off a flash sale or seasonal promotion."
          />
        ) : (
          <ul className="divide-y divide-outline-variant/10">
            {campaigns.map((c) => {
              const status = campaignStatus(c);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between px-6 py-4 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="material-symbols-outlined text-secondary"
                      aria-hidden
                    >
                      campaign
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-body text-sm font-semibold text-on-surface">
                          {c.name}
                        </p>
                        <StatusChip label={status.label} tone={status.tone} />
                        <StatusChip label={c.type.replaceAll('_', ' ')} tone="info" />
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
                        {formatDate(c.startDate)} → {formatDate(c.endDate)} ·{' '}
                        {c.products?.length ?? 0} products
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      icon="edit"
                      label="Edit"
                      onClick={() => setEditTarget(c)}
                    />
                    <IconButton
                      icon="delete"
                      label="Delete"
                      tone="danger"
                      onClick={() => setConfirmTarget(c)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SurfaceCard>

      <CreateCampaignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          void load();
        }}
      />

      <EditCampaignModal
        campaign={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          void load();
        }}
      />

      <ConfirmModal
        open={confirmTarget !== null}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={deleteCampaign}
        title="Delete campaign?"
        message={
          confirmTarget
            ? `"${confirmTarget.name}" will be permanently removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />
    </PageShell>
  );
}

interface CreateCampaignModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

function CreateCampaignModal({ open, onClose, onCreated }: CreateCampaignModalProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<CampaignType>('FLASH_SALE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setSlug('');
      setType('FLASH_SALE');
      setStartDate('');
      setEndDate('');
      setIsActive(true);
      setFormError('');
    }
  }, [open]);

  const submit = async () => {
    if (!token) return;
    if (!name.trim() || !slug.trim() || !startDate || !endDate) {
      setFormError('Name, slug, start, and end are required');
      return;
    }
    if (endDate <= startDate) {
      setFormError('End must be after start');
      return;
    }
    if (startDate < nowDateTimeLocal()) {
      setFormError('Start date cannot be in the past');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await adminFetch('/campaigns', token, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          type,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          isActive,
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
      title="New Campaign"
      description="Set a live window and type — add products after creation."
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
            placeholder="Spring Flash"
          />
        </Field>
        <Field label="Slug" name="slug" required>
          <TextInput
            id="slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
          />
        </Field>
        <Field label="Type" name="type" required>
          <Select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as CampaignType)}
          >
            {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" name="startDate" required>
            <TextInput
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End" name="endDate" required>
            <TextInput
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Checkbox
          label="Active — goes live when window starts"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </div>
    </Modal>
  );
}

interface EditCampaignModalProps {
  readonly campaign: Campaign | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

function EditCampaignModal({ campaign, onClose, onSaved }: EditCampaignModalProps) {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<CampaignType>('FLASH_SALE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setSlug(campaign.slug);
      setType(campaign.type);
      setStartDate(toDateTimeLocal(campaign.startDate));
      setEndDate(toDateTimeLocal(campaign.endDate));
      setIsActive(campaign.isActive);
      setFormError('');
    }
  }, [campaign]);

  const submit = async () => {
    if (!token || !campaign) return;
    if (!name.trim() || !slug.trim() || !startDate || !endDate) {
      setFormError('Name, slug, start, and end are required');
      return;
    }
    if (endDate <= startDate) {
      setFormError('End must be after start');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await adminFetch(`/campaigns/${campaign.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          type,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
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
      open={campaign !== null}
      onClose={onClose}
      title="Edit Campaign"
      description="Update the live window, type, status — and attach the products on sale."
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
            {submitting ? 'Saving…' : 'Save'}
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
        <Field label="Slug" name="edit-slug" required>
          <TextInput
            id="edit-slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
          />
        </Field>
        <Field label="Type" name="edit-type" required>
          <Select
            id="edit-type"
            value={type}
            onChange={(e) => setType(e.target.value as CampaignType)}
          >
            {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" name="edit-startDate" required>
            <TextInput
              id="edit-startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End" name="edit-endDate" required>
            <TextInput
              id="edit-endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Checkbox
          label="Active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />

        {campaign && token && (
          <CampaignProductsEditor campaignId={campaign.id} token={token} />
        )}
      </div>
    </Modal>
  );
}
