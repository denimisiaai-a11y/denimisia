import { adminFetch } from './api';

export type ReturnStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'INSPECTING'
  | 'INSPECTED_PASS'
  | 'INSPECTED_FAIL'
  | 'RETURNED_TO_CUSTOMER'
  | 'REFUNDED'
  | 'CLOSED'
  | 'CANCELLED';

export type ReturnReason =
  | 'DEFECTIVE'
  | 'DAMAGED_IN_TRANSIT'
  | 'NOT_AS_DESCRIBED'
  | 'WRONG_ITEM_SENT'
  | 'WRONG_SIZE'
  | 'CHANGED_MIND';

export type ReturnFault = 'US' | 'CUSTOMER';

export interface ReturnListItem {
  id: string;
  rtnNumber: string;
  status: ReturnStatus;
  reason: ReturnReason;
  fault: ReturnFault;
  slaDeadline: string;
  requestedAt: string;
  refundAmount: string | null;
  isManual: boolean;
  guestName: string | null;
  guestEmail: string | null;
  order: { id: string; total: string } | null;
  items: { id: string; quantity: number }[];
  refundTxn: { id: string; amount: string; method: string } | null;
}

export interface ReturnListResponse {
  items: ReturnListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ListAdminReturnsParams {
  status?: ReturnStatus[];
  slaOverdue?: boolean;
  page?: number;
  limit?: number;
}

export async function listAdminReturns(
  params: ListAdminReturnsParams,
  token: string,
): Promise<ReturnListResponse> {
  const q = new URLSearchParams();
  if (params.status?.length) {
    params.status.forEach((s) => q.append('status', s));
  }
  if (params.slaOverdue) q.set('slaOverdue', 'true');
  q.set('page', String(params.page ?? 1));
  q.set('limit', String(params.limit ?? 20));
  return adminFetch<ReturnListResponse>(`/admin/returns?${q.toString()}`, token);
}

// ---------------------------------------------------------------------------
// Detail + transition action helpers
// ---------------------------------------------------------------------------

export interface ReturnItemDetail {
  id: string;
  quantity: number;
  orderItemId: string | null;
  manualProductName: string | null;
  manualSku: string | null;
  manualSize: string | null;
  manualColor: string | null;
  manualUnitPrice: string | null;
  inspectionResult: 'PASS' | 'FAIL' | null;
  restock: boolean;
  itemRefundAmount: string;
  // Bundle-component fields are populated only when this row represents
  // a returned constituent of a bundle order line. For regular variant
  // and manual lines all four are null. See ReturnItem schema in
  // packages/database/prisma/schema.prisma.
  bundleComponentVariantId: string | null;
  bundleComponentName: string | null;
  bundleComponentSize: string | null;
  bundleComponentColor: string | null;
  orderItem: {
    id: string;
    quantity: number;
    unitPrice: string;
    bundleId: string | null;
    snapshot: Record<string, unknown>;
    product:
      | { id: string; name: string; slug: string; images: string[]; price: string }
      | null;
    variant:
      | { id: string; size: string | null; color: string | null; sku: string }
      | null;
    bundle:
      | { id: string; slug: string; name: string; image: string | null }
      | null;
  } | null;
}

export interface ReturnDetail {
  id: string;
  rtnNumber: string;
  status: ReturnStatus;
  reason: ReturnReason;
  fault: ReturnFault;
  description: string | null;
  photos: string[];
  isManual: boolean;
  customerShipsBack: boolean;
  pickupAddress: Record<string, unknown> | null;
  carrier: string | null;
  trackingNumber: string | null;
  rejectionReason: string | null;
  reviewerNotes: string | null;
  inspectionNotes: string | null;
  refundAmount: string | null;
  refundMethod: 'CASH' | 'BANK_TRANSFER' | null;
  refundReference: string | null;
  slaDeadline: string;
  requestedAt: string;
  reviewedAt: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  inspectedAt: string | null;
  refundedAt: string | null;
  closedAt: string | null;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  order: {
    id: string;
    total: string;
    status: string;
    items: { id: string; quantity: number; unitPrice: string }[];
  } | null;
  refundTxn: {
    id: string;
    amount: string;
    method: string;
    reference: string;
    issuedAt: string;
  } | null;
  reviewer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  items: ReturnItemDetail[];
}

// adminFetch is a thin wrapper around fetch() and forwards RequestInit
// directly — bodies must be JSON-stringified by the caller. These helpers
// accept plain JS objects and serialize them here so call sites stay clean.
async function patchJson<T>(
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return adminFetch<T>(path, token, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function postJson<T>(
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return adminFetch<T>(path, token, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function getAdminReturnDetail(
  id: string,
  token: string,
): Promise<ReturnDetail> {
  return adminFetch<ReturnDetail>(`/admin/returns/${id}`, token);
}

export async function reviewReturn(
  id: string,
  token: string,
  body: { reviewerNotes?: string },
): Promise<ReturnDetail> {
  return patchJson<ReturnDetail>(`/admin/returns/${id}/review`, token, body);
}

export async function approveReturn(
  id: string,
  token: string,
  body: {
    carrier?: string;
    pickupAddress?: Record<string, unknown> | null;
    approvalNotes?: string;
  },
): Promise<ReturnDetail> {
  return patchJson<ReturnDetail>(`/admin/returns/${id}/approve`, token, body);
}

export async function rejectReturn(
  id: string,
  token: string,
  body: { rejectionReason: string },
): Promise<ReturnDetail> {
  return patchJson<ReturnDetail>(`/admin/returns/${id}/reject`, token, body);
}

export async function markReceivedReturn(
  id: string,
  token: string,
  body: { trackingNumber?: string; receivedNotes?: string },
): Promise<ReturnDetail> {
  return patchJson<ReturnDetail>(`/admin/returns/${id}/mark-received`, token, body);
}

export async function startInspection(
  id: string,
  token: string,
): Promise<ReturnDetail> {
  return patchJson<ReturnDetail>(`/admin/returns/${id}/start-inspection`, token);
}

export async function inspectReturn(
  id: string,
  token: string,
  body: {
    itemResults: {
      returnItemId: string;
      inspectionResult: 'PASS' | 'FAIL';
      restock: boolean;
    }[];
    inspectionNotes?: string;
  },
): Promise<ReturnDetail> {
  return patchJson<ReturnDetail>(`/admin/returns/${id}/inspect`, token, body);
}

export async function returnToCustomer(
  id: string,
  token: string,
): Promise<ReturnDetail> {
  return patchJson<ReturnDetail>(`/admin/returns/${id}/return-to-customer`, token);
}

export async function issueRefund(
  id: string,
  token: string,
  body: {
    amount: number;
    method: 'CASH' | 'BANK_TRANSFER';
    reference: string;
    notes?: string;
    overrideFromFail?: boolean;
  },
): Promise<ReturnDetail> {
  return postJson<ReturnDetail>(`/admin/returns/${id}/issue-refund`, token, body);
}

// ---------------------------------------------------------------------------
// Manual entry + metrics dashboard
// ---------------------------------------------------------------------------

export interface ManualReturnItemPayload {
  orderItemId: string | null;
  manualProductName?: string;
  manualSku?: string;
  manualSize?: string;
  manualColor?: string;
  manualUnitPrice?: number;
  quantity: number;
  // For bundle-line orderItemIds, the admin must name which constituent
  // is being returned. Matches the variantId in OrderItem.snapshot.items[].
  bundleComponentVariantId?: string;
}

export interface ManualReturnPayload {
  orderId: string | null;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  reason: ReturnReason;
  faultOverride?: ReturnFault;
  description?: string;
  photos: string[];
  items: ManualReturnItemPayload[];
}

export async function createManualReturn(
  token: string,
  body: ManualReturnPayload,
): Promise<{ id: string; rtnNumber: string }> {
  return postJson<{ id: string; rtnNumber: string }>(
    '/admin/returns/manual',
    token,
    body as unknown as Record<string, unknown>,
  );
}

export interface ReturnsMetrics {
  rangeDays: number;
  returnsCount: number;
  ordersCount: number;
  returnRate: number;
  topReasons: { reason: ReturnReason; count: number }[];
  pendingRefundValue: number;
  averageResolutionHours: number | null;
}

export async function getReturnsMetrics(
  token: string,
  rangeDays = 30,
): Promise<ReturnsMetrics> {
  return adminFetch<ReturnsMetrics>(
    `/admin/returns/metrics/dashboard?rangeDays=${rangeDays}`,
    token,
  );
}
