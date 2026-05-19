import { ReturnStatus, ReturnReason, ReturnFault } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['IN_TRANSIT', 'RECEIVED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: ['INSPECTING'],
  INSPECTING: ['INSPECTED_PASS', 'INSPECTED_FAIL'],
  INSPECTED_PASS: ['REFUNDED'],
  INSPECTED_FAIL: ['RETURNED_TO_CUSTOMER', 'REFUNDED'],
  RETURNED_TO_CUSTOMER: ['CLOSED'],
  REFUNDED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CANCELLED: ['CLOSED'],
  CLOSED: [],
};

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export const REASON_FAULT: Record<ReturnReason, ReturnFault> = {
  DEFECTIVE: 'US',
  DAMAGED_IN_TRANSIT: 'US',
  NOT_AS_DESCRIBED: 'US',
  WRONG_ITEM_SENT: 'US',
  WRONG_SIZE: 'CUSTOMER',
  CHANGED_MIND: 'CUSTOMER',
};

export const PHOTOS_REQUIRED_REASONS: ReadonlySet<ReturnReason> = new Set([
  'DEFECTIVE',
  'DAMAGED_IN_TRANSIT',
  'WRONG_ITEM_SENT',
  'NOT_AS_DESCRIBED',
]);

export function defaultFault(reason: ReturnReason): ReturnFault {
  return REASON_FAULT[reason];
}

export function requiresPhotos(reason: ReturnReason): boolean {
  return PHOTOS_REQUIRED_REASONS.has(reason);
}
