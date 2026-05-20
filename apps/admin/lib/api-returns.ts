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
