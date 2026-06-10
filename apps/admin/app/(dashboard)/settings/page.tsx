'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { Modal, ConfirmModal } from '@/components/modal';
import { IconButton } from '@/components/admin-ui';

interface StoreInfo {
  storeName: string;
  contactEmail: string;
  address: string;
  city: string;
  country: string;
  currency: string;
}

interface ShippingZone {
  id: string;
  name: string;
  description: string;
  rate: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  featured?: boolean;
  locked?: boolean;
  lockedLabel?: string;
}

interface TeamRole {
  label: string;
  access: string;
  dot: string;
}

interface SettingsSnapshot {
  storeInfo: StoreInfo;
  paymentMethods: readonly PaymentMethod[];
  shippingZones: readonly ShippingZone[];
}

const LOCAL_STORAGE_KEY = 'admin-settings-v1';

const DEFAULT_STORE_INFO: StoreInfo = {
  storeName: 'Denimisia',
  contactEmail: 'atelier@denimisia.com',
  address: 'Plot 42, Block C, Banani, Dhaka 1213, Bangladesh',
  city: 'Dhaka',
  country: 'Bangladesh',
  currency: 'BDT',
};

const CURRENCY_OPTIONS: ReadonlyArray<string> = [
  'BDT',
  'USD ($)',
  'EUR (€)',
];

const TEAM_ROLES: ReadonlyArray<TeamRole> = [
  { label: 'Owner', access: 'Full Access', dot: 'bg-primary' },
  { label: 'Manager', access: 'Limited', dot: 'bg-secondary' },
  { label: 'Support', access: 'Orders Only', dot: 'bg-surface-container-high' },
];

const DEFAULT_SHIPPING_ZONES: ReadonlyArray<ShippingZone> = [
  {
    id: 'inside-dhaka',
    name: 'Inside Dhaka',
    description: 'Delivery within 24-48 hours',
    rate: 'BDT 60.00',
  },
  {
    id: 'outside-dhaka',
    name: 'Outside Dhaka',
    description: 'Standard delivery (3-5 business days)',
    rate: 'BDT 120.00',
  },
  {
    id: 'international',
    name: 'International Express',
    description: 'DHL/FedEx tracked shipping',
    rate: 'BDT 2,400.00',
  },
];

const DEFAULT_PAYMENT_METHODS: ReadonlyArray<PaymentMethod> = [
  {
    id: 'bkash',
    name: 'bKash Merchant',
    description: 'Active & Verified',
    icon: 'account_balance_wallet',
    enabled: true,
    featured: true,
  },
  {
    id: 'cod',
    name: 'Cash On Delivery',
    description: 'Enabled for specific zones',
    icon: 'local_atm',
    enabled: true,
  },
  {
    id: 'cards',
    name: 'Credit/Debit Cards',
    description: 'Requires SSLCommerz integration',
    icon: 'credit_card',
    enabled: false,
    locked: true,
    lockedLabel: 'Setup Required',
  },
];

function cloneSnapshot(snap: SettingsSnapshot): SettingsSnapshot {
  return {
    storeInfo: { ...snap.storeInfo },
    paymentMethods: snap.paymentMethods.map((m) => ({ ...m })),
    shippingZones: snap.shippingZones.map((z) => ({ ...z })),
  };
}

function loadLocalSnapshot(): SettingsSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SettingsSnapshot>;
    if (!parsed.storeInfo || !parsed.paymentMethods || !parsed.shippingZones) {
      return null;
    }
    return parsed as SettingsSnapshot;
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const [storeInfo, setStoreInfo] = useState<StoreInfo>(DEFAULT_STORE_INFO);
  const [paymentMethods, setPaymentMethods] = useState<ReadonlyArray<PaymentMethod>>(
    DEFAULT_PAYMENT_METHODS,
  );
  const [shippingZones, setShippingZones] = useState<ReadonlyArray<ShippingZone>>(
    DEFAULT_SHIPPING_ZONES,
  );
  const [originalSnapshot, setOriginalSnapshot] = useState<SettingsSnapshot>({
    storeInfo: DEFAULT_STORE_INFO,
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    shippingZones: DEFAULT_SHIPPING_ZONES,
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveTone, setSaveTone] = useState<'info' | 'success' | 'error'>('info');
  const [isSaving, setIsSaving] = useState(false);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [editZone, setEditZone] = useState<ShippingZone | null>(null);
  const [deleteZoneTarget, setDeleteZoneTarget] = useState<ShippingZone | null>(null);

  // On mount: prefer local snapshot; snapshot whatever we start with as "original".
  useEffect(() => {
    const local = loadLocalSnapshot();
    if (local) {
      setStoreInfo(local.storeInfo);
      setPaymentMethods(local.paymentMethods);
      setShippingZones(local.shippingZones);
      setOriginalSnapshot(cloneSnapshot(local));
    } else {
      setOriginalSnapshot({
        storeInfo: DEFAULT_STORE_INFO,
        paymentMethods: DEFAULT_PAYMENT_METHODS,
        shippingZones: DEFAULT_SHIPPING_ZONES,
      });
    }
  }, []);

  const updateStoreField = <K extends keyof StoreInfo>(field: K, value: StoreInfo[K]) => {
    setStoreInfo((prev) => ({ ...prev, [field]: value }));
  };

  const togglePayment = (id: string) => {
    setPaymentMethods((prev) =>
      prev.map((method) =>
        method.id === id && !method.locked ? { ...method, enabled: !method.enabled } : method,
      ),
    );
  };

  const addZone = (zone: Omit<ShippingZone, 'id'>) => {
    const id = zone.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    setShippingZones((prev) => [...prev, { ...zone, id }]);
  };

  const updateZone = (updated: ShippingZone) => {
    setShippingZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
  };

  const removeZone = (id: string) => {
    setShippingZones((prev) => prev.filter((z) => z.id !== id));
  };

  const persistLocally = (snap: SettingsSnapshot): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snap));
  };

  const showMessage = (message: string, tone: 'info' | 'success' | 'error', ttl = 3500): void => {
    setSaveMessage(message);
    setSaveTone(tone);
    window.setTimeout(() => setSaveMessage(null), ttl);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    const payload: SettingsSnapshot = { storeInfo, paymentMethods, shippingZones };
    try {
      await adminFetch('/settings', token, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      persistLocally(payload);
      setOriginalSnapshot(cloneSnapshot(payload));
      showMessage('Saved', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      // Treat 404 / missing endpoint as graceful fallback.
      if (message.includes('404') || message.toLowerCase().includes('not found')) {
        persistLocally(payload);
        setOriginalSnapshot(cloneSnapshot(payload));
        showMessage('Saved locally — backend not yet wired', 'info');
      } else {
        showMessage(`Failed: ${message}`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    const snap = cloneSnapshot(originalSnapshot);
    setStoreInfo(snap.storeInfo);
    setPaymentMethods(snap.paymentMethods);
    setShippingZones(snap.shippingZones);
    showMessage('Changes discarded', 'info', 2500);
  };

  return (
    <div className="max-w-[1400px]">
      <div className="mb-12">
        <h2 className="mb-2 font-headline text-4xl font-semibold tracking-tight text-on-surface">
          STORE SETTINGS
        </h2>
        <p className="text-[10px] font-medium uppercase tracking-wide text-secondary">
          Configure your Digital Atelier environment
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* STORE INFORMATION */}
        <section className="rounded-sm border border-outline-variant/10 bg-surface-container-lowest p-10 shadow-sm lg:col-span-8">
          <div className="mb-8 flex items-center gap-4">
            <span className="material-symbols-outlined text-primary">storefront</span>
            <h3 className="font-headline text-sm font-semibold uppercase tracking-[0.15em] text-on-surface">
              Store Information
            </h3>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <FieldInput
                label="Store Name"
                type="text"
                value={storeInfo.storeName}
                onChange={(value) => updateStoreField('storeName', value)}
              />
              <FieldInput
                label="Contact Email"
                type="email"
                value={storeInfo.contactEmail}
                onChange={(value) => updateStoreField('contactEmail', value)}
              />
            </div>

            <FieldInput
              label="Primary Warehouse Address"
              type="text"
              value={storeInfo.address}
              onChange={(value) => updateStoreField('address', value)}
            />

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <FieldInput
                label="City"
                type="text"
                value={storeInfo.city}
                onChange={(value) => updateStoreField('city', value)}
              />
              <FieldInput
                label="Country"
                type="text"
                value={storeInfo.country}
                onChange={(value) => updateStoreField('country', value)}
              />
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
                  Currency
                </label>
                <select
                  value={storeInfo.currency}
                  onChange={(e) => updateStoreField('currency', e.target.value)}
                  className="w-full border-b border-outline-variant/30 bg-transparent py-2 text-sm font-medium text-on-surface transition-colors focus:border-primary focus:ring-0"
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* TEAM ROLES + EDITORIAL CARD */}
        <section className="space-y-8 lg:col-span-4">
          <div className="rounded-sm bg-surface-container-low p-8">
            <h3 className="mb-6 flex items-center gap-3 font-headline text-xs font-semibold uppercase tracking-[0.15em] text-on-surface">
              <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
              Team Roles
            </h3>
            <div className="space-y-4">
              {TEAM_ROLES.map((role) => (
                <div
                  key={role.label}
                  className="flex items-center justify-between rounded-sm bg-surface-container-lowest p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${role.dot}`} />
                    <span className="text-xs font-medium uppercase tracking-wider text-on-surface">
                      {role.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-secondary">
                    {role.access}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/system/users"
              className="mt-6 block w-full border border-outline-variant/20 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-lowest"
            >
              Manage Permissions
            </Link>
          </div>

          {/* Editorial denim card (placeholder, no stock image URL) */}
          <div className="group relative aspect-[4/5] overflow-hidden rounded-sm bg-inverse-surface">
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-inverse-surface via-inverse-surface to-black/80 px-8 text-center">
              <span className="material-symbols-outlined mb-6 text-inverse-on-surface/40 text-[48px]">
                diamond
              </span>
              <div className="h-px w-12 bg-inverse-on-surface/30" />
            </div>
            <div className="absolute inset-0 flex items-end p-6">
              <p className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface">
                Craftsmanship first. Configuration second.
              </p>
            </div>
          </div>
        </section>

        {/* SHIPPING ZONES */}
        <section className="rounded-sm border border-outline-variant/10 bg-surface-container-lowest p-10 lg:col-span-6">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-primary">local_shipping</span>
              <h3 className="font-headline text-sm font-semibold uppercase tracking-[0.15em] text-on-surface">
                Shipping Zones
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setZoneModalOpen(true)}
              className="text-[10px] font-bold uppercase tracking-widest text-primary"
            >
              + Add Zone
            </button>
          </div>
          <div className="space-y-6">
            {shippingZones.map((zone, idx) => (
              <div
                key={zone.id}
                className={
                  idx < shippingZones.length - 1
                    ? 'border-b border-outline-variant/15 pb-4'
                    : 'pb-4'
                }
              >
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                      {zone.name}
                    </h4>
                    <p className="text-[10px] text-secondary">{zone.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-headline text-xs font-semibold text-on-surface">
                      {zone.rate}
                    </span>
                    <IconButton
                      icon="edit"
                      label={`Edit ${zone.name}`}
                      onClick={() => setEditZone(zone)}
                    />
                    <IconButton
                      icon="delete"
                      label={`Delete ${zone.name}`}
                      tone="danger"
                      onClick={() => setDeleteZoneTarget(zone)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PAYMENT METHODS */}
        <section className="rounded-sm border border-outline-variant/10 bg-surface-container-lowest p-10 lg:col-span-6">
          <div className="mb-8 flex items-center gap-4">
            <span className="material-symbols-outlined text-primary">payments</span>
            <h3 className="font-headline text-sm font-semibold uppercase tracking-[0.15em] text-on-surface">
              Payment Methods
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {paymentMethods.map((method) => {
              if (method.featured) {
                return (
                  <div
                    key={method.id}
                    className="flex items-center justify-between border-l-2 border-primary bg-surface-container-low p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-surface-container-lowest">
                        <span className="material-symbols-outlined text-primary">
                          {method.icon}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                          {method.name}
                        </h4>
                        <p className="text-[10px] text-secondary">{method.description}</p>
                      </div>
                    </div>
                    <span
                      className="material-symbols-outlined text-sm text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  </div>
                );
              }

              if (method.locked) {
                return (
                  <div
                    key={method.id}
                    className="flex items-center justify-between border border-outline-variant/15 bg-surface-container-lowest p-4 opacity-50 grayscale"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-surface-container-low">
                        <span className="material-symbols-outlined text-secondary">
                          {method.icon}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                          {method.name}
                        </h4>
                        <p className="text-[10px] text-secondary">{method.description}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-tighter text-on-surface">
                      {method.lockedLabel ?? 'Setup Required'}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={method.id}
                  className="flex items-center justify-between border border-outline-variant/15 bg-surface-container-lowest p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-surface-container-low">
                      <span className="material-symbols-outlined text-secondary">
                        {method.icon}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                        {method.name}
                      </h4>
                      <p className="text-[10px] text-secondary">{method.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePayment(method.id)}
                    aria-label={`Toggle ${method.name}`}
                    className={`relative h-4 w-8 rounded-full transition-colors ${
                      method.enabled ? 'bg-primary/20' : 'bg-surface-container-high'
                    }`}
                  >
                    <div
                      className={`absolute top-0 h-4 w-4 rounded-full transition-all ${
                        method.enabled ? 'right-0 bg-primary' : 'left-0 bg-secondary'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* STICKY BOTTOM ACTIONS */}
      <div className="fixed bottom-8 right-12 z-30 flex items-center gap-4">
        {saveMessage && (
          <div
            className={
              'rounded-[4px] px-4 py-2 text-[10px] font-semibold uppercase tracking-widest shadow-lg ' +
              (saveTone === 'success'
                ? 'bg-[#059669] text-white'
                : saveTone === 'error'
                  ? 'bg-[#c62828] text-white'
                  : 'bg-inverse-surface text-inverse-on-surface')
            }
          >
            {saveMessage}
          </div>
        )}
        <button
          type="button"
          onClick={handleDiscard}
          disabled={isSaving}
          className="rounded-[4px] border border-outline-variant/20 bg-surface-container-lowest px-8 py-3 text-xs font-semibold uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
        >
          Discard Changes
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-[4px] bg-primary px-10 py-3 text-xs font-semibold uppercase tracking-widest text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save Configuration'}
        </button>
      </div>

      <AddZoneModal
        open={zoneModalOpen}
        onClose={() => setZoneModalOpen(false)}
        onAdd={(zone) => {
          addZone(zone);
          setZoneModalOpen(false);
        }}
      />

      <EditZoneModal
        zone={editZone}
        onClose={() => setEditZone(null)}
        onSave={(zone) => {
          updateZone(zone);
          setEditZone(null);
        }}
      />

      <ConfirmModal
        open={deleteZoneTarget !== null}
        onCancel={() => setDeleteZoneTarget(null)}
        onConfirm={() => {
          if (deleteZoneTarget) removeZone(deleteZoneTarget.id);
          setDeleteZoneTarget(null);
        }}
        title="Delete shipping zone?"
        message={
          deleteZoneTarget
            ? `"${deleteZoneTarget.name}" will be removed. Save Configuration to persist the change.`
            : ''
        }
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
}

interface FieldInputProps {
  label: string;
  type: 'text' | 'email';
  value: string;
  onChange: (value: string) => void;
}

function FieldInput({ label, type, value, onChange }: FieldInputProps) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-b border-outline-variant/30 bg-transparent py-2 text-sm font-medium text-on-surface transition-colors focus:border-primary focus:ring-0"
      />
    </div>
  );
}

interface AddZoneModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onAdd: (zone: Omit<ShippingZone, 'id'>) => void;
}

interface EditZoneModalProps {
  readonly zone: ShippingZone | null;
  readonly onClose: () => void;
  readonly onSave: (zone: ShippingZone) => void;
}

function EditZoneModal({ zone, onClose, onSave }: EditZoneModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (zone) {
      setName(zone.name);
      setDescription(zone.description);
      setRate(zone.rate);
      setError('');
    }
  }, [zone]);

  const submit = (): void => {
    if (!zone) return;
    if (!name.trim() || !rate.trim()) {
      setError('Zone name and rate are required');
      return;
    }
    onSave({
      id: zone.id,
      name: name.trim(),
      description: description.trim(),
      rate: rate.trim(),
    });
  };

  return (
    <Modal
      open={zone !== null}
      onClose={onClose}
      title="Edit Shipping Zone"
      description="Save via Save Configuration to persist."
      width="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface"
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="border border-primary/30 bg-surface-container-low px-3 py-2 text-xs text-primary">
            {error}
          </p>
        )}
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
            Zone Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border-b border-outline-variant/30 bg-transparent py-2 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border-b border-outline-variant/30 bg-transparent py-2 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
            Rate
          </label>
          <input
            type="text"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full border-b border-outline-variant/30 bg-transparent py-2 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
}

function AddZoneModal({ open, onClose, onAdd }: AddZoneModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setRate('');
      setError('');
    }
  }, [open]);

  const submit = (): void => {
    if (!name.trim() || !rate.trim()) {
      setError('Zone name and rate are required');
      return;
    }
    onAdd({ name: name.trim(), description: description.trim(), rate: rate.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Shipping Zone"
      description="Save via Save Configuration to persist."
      width="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="atelier-shadow-sm bg-inverse-surface px-5 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface"
          >
            Add
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="border border-primary/30 bg-surface-container-low px-3 py-2 text-xs text-primary">
            {error}
          </p>
        )}
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
            Zone Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chittagong"
            className="w-full border-b border-outline-variant/30 bg-transparent py-2 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Regional delivery, 2-3 days"
            className="w-full border-b border-outline-variant/30 bg-transparent py-2 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary">
            Rate
          </label>
          <input
            type="text"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="BDT 150.00"
            className="w-full border-b border-outline-variant/30 bg-transparent py-2 text-sm font-medium text-on-surface focus:border-primary focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
}
