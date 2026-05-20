'use client';

import { useCallback, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import {
  createManualReturn,
  type ManualReturnPayload,
  type ReturnFault,
  type ReturnReason,
} from '@/lib/api-returns';
import { Banner } from '@/components/admin-ui';
import { ImageUploader } from '@/components/image-uploader';

// ---------------------------------------------------------------------------
// Reason / fault options — labels match the rest of the returns surface
// ---------------------------------------------------------------------------

const REASON_OPTIONS: { value: ReturnReason; label: string }[] = [
  { value: 'DEFECTIVE', label: 'Defective' },
  { value: 'DAMAGED_IN_TRANSIT', label: 'Damaged in transit' },
  { value: 'NOT_AS_DESCRIBED', label: 'Not as described' },
  { value: 'WRONG_ITEM_SENT', label: 'Wrong item sent' },
  { value: 'WRONG_SIZE', label: 'Wrong size' },
  { value: 'CHANGED_MIND', label: 'Changed mind' },
];

type FaultChoice = 'AUTO' | ReturnFault;

const FAULT_OPTIONS: { value: FaultChoice; label: string }[] = [
  { value: 'AUTO', label: 'Auto (use reason default)' },
  { value: 'US', label: 'Force US' },
  { value: 'CUSTOMER', label: 'Force Customer' },
];

// ---------------------------------------------------------------------------
// Order lookup result shape — minimal fields needed to pick items.
// adminFetch already unwraps { data: ... } envelopes, so this matches the
// /orders/{id} response directly.
// ---------------------------------------------------------------------------

interface LookedUpOrderItem {
  id: string;
  quantity: number;
  unitPrice?: number | string | null;
  productName?: string;
  product?: { name?: string; slug?: string };
  variant?: { size?: string | null; color?: string | null; sku?: string };
  snapshot?: {
    name?: string;
    size?: string;
    color?: string;
  };
}

interface LookedUpOrder {
  id: string;
  orderNumber?: string;
  status?: string;
  items: LookedUpOrderItem[];
}

function describeOrderItem(item: LookedUpOrderItem): string {
  const name =
    item.product?.name ??
    item.productName ??
    item.snapshot?.name ??
    'Order item';
  const variantBits = [
    item.variant?.size ?? item.snapshot?.size,
    item.variant?.color ?? item.snapshot?.color,
  ]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(' / ');
  return variantBits ? `${name} · ${variantBits}` : name;
}

// ---------------------------------------------------------------------------
// Local row state — UI-only mirror of ManualReturnItemPayload. We keep
// numeric fields as strings while editing so the inputs feel natural and
// only coerce on submit.
// ---------------------------------------------------------------------------

type ItemMode = 'FROM_ORDER' | 'MANUAL';

interface ItemRow {
  uid: string;
  mode: ItemMode;
  orderItemId: string;
  manualProductName: string;
  manualSku: string;
  manualSize: string;
  manualColor: string;
  manualUnitPrice: string;
  quantity: string;
}

function freshRow(): ItemRow {
  return {
    uid:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `row-${Math.random().toString(36).slice(2)}`,
    mode: 'MANUAL',
    orderItemId: '',
    manualProductName: '',
    manualSku: '',
    manualSize: '',
    manualColor: '',
    manualUnitPrice: '',
    quantity: '1',
  };
}

export default function ManualReturnPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  // -------------------------------------------------------------------------
  // Top-level fields
  // -------------------------------------------------------------------------
  const [orderIdInput, setOrderIdInput] = useState('');
  const [lookedUpOrder, setLookedUpOrder] = useState<LookedUpOrder | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const [reason, setReason] = useState<ReturnReason>('DEFECTIVE');
  const [faultChoice, setFaultChoice] = useState<FaultChoice>('AUTO');
  const [description, setDescription] = useState('');

  const [photos, setPhotos] = useState<string[]>([]);

  const [rows, setRows] = useState<ItemRow[]>([freshRow()]);

  // -------------------------------------------------------------------------
  // Submit / error state
  // -------------------------------------------------------------------------
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // -------------------------------------------------------------------------
  // Order lookup
  // -------------------------------------------------------------------------
  const handleLookup = useCallback(async () => {
    if (!token) return;
    const id = orderIdInput.trim();
    if (!id) {
      setLookupError('Enter an order ID first');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const data = await adminFetch<LookedUpOrder>(`/orders/${id}`, token);
      setLookedUpOrder(data);
    } catch (err: unknown) {
      setLookedUpOrder(null);
      setLookupError(
        err instanceof Error ? err.message : 'Could not look up that order',
      );
    } finally {
      setLookupLoading(false);
    }
  }, [token, orderIdInput]);

  // -------------------------------------------------------------------------
  // Row helpers
  // -------------------------------------------------------------------------
  const addRow = () => setRows((prev) => [...prev, freshRow()]);
  const removeRow = (uid: string) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.uid !== uid)));
  const updateRow = (uid: string, patch: Partial<ItemRow>) =>
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      setFormError('Not signed in');
      return;
    }

    // Client-side validation. We surface a single, specific message so the
    // operator can fix one thing at a time instead of guessing.
    if (!customerName.trim()) {
      setFormError('Customer name is required');
      return;
    }
    if (customerPhone.trim().length < 6) {
      setFormError('Customer phone must be at least 6 characters');
      return;
    }
    if (description.length > 2000) {
      setFormError('Description must be 2000 characters or fewer');
      return;
    }

    const items: ManualReturnPayload['items'] = [];
    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx];
      if (!row) continue;
      const qty = Number.parseInt(row.quantity, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        setFormError(`Item ${idx + 1}: quantity must be a positive whole number`);
        return;
      }
      if (row.mode === 'FROM_ORDER') {
        if (!lookedUpOrder) {
          setFormError(
            `Item ${idx + 1}: look up an order first or switch to manual entry`,
          );
          return;
        }
        if (!row.orderItemId) {
          setFormError(`Item ${idx + 1}: pick an order item`);
          return;
        }
        items.push({ orderItemId: row.orderItemId, quantity: qty });
      } else {
        const name = row.manualProductName.trim();
        const priceStr = row.manualUnitPrice.trim();
        const price = Number.parseFloat(priceStr);
        if (!name) {
          setFormError(`Item ${idx + 1}: product name is required for manual entry`);
          return;
        }
        if (!priceStr || !Number.isFinite(price) || price < 0) {
          setFormError(
            `Item ${idx + 1}: unit price is required and must be a non-negative number`,
          );
          return;
        }
        items.push({
          orderItemId: null,
          manualProductName: name,
          manualSku: row.manualSku.trim() || undefined,
          manualSize: row.manualSize.trim() || undefined,
          manualColor: row.manualColor.trim() || undefined,
          manualUnitPrice: price,
          quantity: qty,
        });
      }
    }

    const payload: ManualReturnPayload = {
      orderId: lookedUpOrder ? lookedUpOrder.id : null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
      reason,
      ...(faultChoice !== 'AUTO' ? { faultOverride: faultChoice } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      photos,
      items,
    };

    setSubmitting(true);
    setFormError('');
    try {
      const created = await createManualReturn(token, payload);
      router.push(`/returns/${created.id}`);
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create manual return',
      );
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
            <Link href="/returns" className="hover:text-on-surface">
              Returns
            </Link>
            <span className="mx-2 text-outline-variant">/</span>
            <span className="text-on-surface">Manual entry</span>
          </p>
          <h2 className="mt-2 font-headline text-4xl font-semibold uppercase tracking-[0.15em] text-on-surface">
            Manual return
          </h2>
          <p className="mt-2 font-body text-sm tracking-wide text-secondary">
            File a return on behalf of a customer — in-store, by phone, or offline.
          </p>
        </div>
      </div>

      {formError && <Banner tone="error" message={formError} />}

      <form onSubmit={handleSubmit} className="space-y-10">
        {/* Order lookup */}
        <section className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
          <h3 className="font-headline text-lg font-semibold uppercase tracking-[0.15em] text-on-surface">
            Order reference
          </h3>
          <p className="mt-1 text-xs text-secondary">
            Optional. Link this return to an existing order so item lines auto-fill.
          </p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label
                htmlFor="manual-return-orderid"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                Order ID
              </label>
              <input
                id="manual-return-orderid"
                type="text"
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                placeholder="e.g. ckp1234..."
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupLoading || !orderIdInput.trim()}
              className="atelier-shadow-sm bg-inverse-surface px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
            >
              {lookupLoading ? 'Looking up...' : 'Lookup'}
            </button>
          </div>
          {lookupError && (
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-error">
              {lookupError}
            </p>
          )}
          {lookedUpOrder && (
            <div className="mt-4 rounded-sm border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                Order found
              </p>
              <p className="mt-1 text-sm text-on-surface">
                {lookedUpOrder.orderNumber ??
                  `#${lookedUpOrder.id.slice(0, 8).toUpperCase()}`}{' '}
                · {lookedUpOrder.items?.length ?? 0} item(s)
                {lookedUpOrder.status ? ` · ${lookedUpOrder.status}` : ''}
              </p>
            </div>
          )}
        </section>

        {/* Customer */}
        <section className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
          <h3 className="font-headline text-lg font-semibold uppercase tracking-[0.15em] text-on-surface">
            Customer
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="manual-customer-name"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                Name *
              </label>
              <input
                id="manual-customer-name"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="manual-customer-phone"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                Phone *
              </label>
              <input
                id="manual-customer-phone"
                type="tel"
                required
                minLength={6}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="manual-customer-email"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                Email (optional)
              </label>
              <input
                id="manual-customer-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Reason + fault */}
        <section className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
          <h3 className="font-headline text-lg font-semibold uppercase tracking-[0.15em] text-on-surface">
            Reason
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="manual-reason"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                Reason *
              </label>
              <select
                id="manual-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReturnReason)}
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="manual-fault"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                Fault override
              </label>
              <select
                id="manual-fault"
                value={faultChoice}
                onChange={(e) => setFaultChoice(e.target.value as FaultChoice)}
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              >
                {FAULT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="manual-description"
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary"
              >
                Description (optional, max 2000 chars)
              </label>
              <textarea
                id="manual-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-secondary">
                {description.length} / 2000
              </p>
            </div>
          </div>
        </section>

        {/* Photos */}
        <section className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
          <h3 className="font-headline text-lg font-semibold uppercase tracking-[0.15em] text-on-surface">
            Photos
          </h3>
          <p className="mt-1 text-xs text-secondary">
            Up to 5 photos. Stored on R2 — same uploader the customer-facing form uses.
          </p>
          <div className="mt-4">
            <ImageUploader
              value={photos}
              onChange={setPhotos}
              token={token}
              folder="cms"
              maxFiles={5}
            />
          </div>
        </section>

        {/* Items */}
        <section className="bg-surface-container-lowest rounded-sm border border-outline-variant/5 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-headline text-lg font-semibold uppercase tracking-[0.15em] text-on-surface">
                Items
              </h3>
              <p className="mt-1 text-xs text-secondary">
                Add one row per returned line. Pick from the looked-up order or enter
                manually.
              </p>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="bg-surface-container-highest px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface hover:bg-surface-container-high transition-colors"
            >
              + Add item
            </button>
          </div>

          <div className="mt-6 space-y-6">
            {rows.map((row, idx) => {
              const canRemove = rows.length > 1;
              return (
                <div
                  key={row.uid}
                  className="rounded-sm border border-outline-variant/15 bg-surface-container-low/40 p-5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                      Item {idx + 1}
                    </p>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.uid)}
                        className="text-[10px] font-bold uppercase tracking-widest text-error hover:opacity-80"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Mode toggle */}
                  <div className="mt-4 inline-flex rounded-sm bg-surface-container-highest p-1">
                    {(['FROM_ORDER', 'MANUAL'] as const).map((mode) => {
                      const active = row.mode === mode;
                      const disabled =
                        mode === 'FROM_ORDER' && !lookedUpOrder;
                      return (
                        <button
                          key={mode}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            updateRow(row.uid, { mode, orderItemId: '' })
                          }
                          className={`px-4 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            active
                              ? 'bg-inverse-surface text-inverse-on-surface'
                              : 'text-secondary hover:text-on-surface'
                          } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                          title={
                            disabled
                              ? 'Look up an order first to pick from its items'
                              : undefined
                          }
                        >
                          {mode === 'FROM_ORDER' ? 'From order' : 'Manual entry'}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mode-specific fields */}
                  {row.mode === 'FROM_ORDER' && lookedUpOrder ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_140px]">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          Order item *
                        </label>
                        <select
                          value={row.orderItemId}
                          onChange={(e) =>
                            updateRow(row.uid, { orderItemId: e.target.value })
                          }
                          className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                        >
                          <option value="">— pick an order item —</option>
                          {lookedUpOrder.items.map((oi) => (
                            <option key={oi.id} value={oi.id}>
                              {describeOrderItem(oi)} · qty {oi.quantity}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={row.quantity}
                          onChange={(e) =>
                            updateRow(row.uid, { quantity: e.target.value })
                          }
                          className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          Product name *
                        </label>
                        <input
                          type="text"
                          value={row.manualProductName}
                          onChange={(e) =>
                            updateRow(row.uid, {
                              manualProductName: e.target.value,
                            })
                          }
                          className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          SKU
                        </label>
                        <input
                          type="text"
                          value={row.manualSku}
                          onChange={(e) =>
                            updateRow(row.uid, { manualSku: e.target.value })
                          }
                          className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          Size
                        </label>
                        <input
                          type="text"
                          value={row.manualSize}
                          onChange={(e) =>
                            updateRow(row.uid, { manualSize: e.target.value })
                          }
                          className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          Color
                        </label>
                        <input
                          type="text"
                          value={row.manualColor}
                          onChange={(e) =>
                            updateRow(row.uid, { manualColor: e.target.value })
                          }
                          className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          Unit price (BDT) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.manualUnitPrice}
                          onChange={(e) =>
                            updateRow(row.uid, {
                              manualUnitPrice: e.target.value,
                            })
                          }
                          className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          Quantity *
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={row.quantity}
                          onChange={(e) =>
                            updateRow(row.uid, { quantity: e.target.value })
                          }
                          className="mt-2 w-full rounded-sm border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Submit */}
        <section className="flex items-center justify-end gap-3">
          <Link
            href="/returns"
            className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="atelier-shadow-sm bg-inverse-surface px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-inverse-on-surface transition-transform duration-300 ease-editorial hover:scale-[1.02] disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create return'}
          </button>
        </section>
      </form>
    </>
  );
}
