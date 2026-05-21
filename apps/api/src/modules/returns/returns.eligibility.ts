import { OrderItem, Product } from '@prisma/client';

export type EligibilityFailure =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_DELIVERED'
  | 'WINDOW_EXPIRED'
  | 'PRODUCT_NOT_RETURNABLE'
  | 'ITEM_ALREADY_RETURNED'
  | 'QUANTITY_EXCEEDS_ORDERED'
  | 'INVALID_QUANTITY';

export const RETURN_WINDOW_DAYS = 7;

export type DeliveryTimestamp = Date | null | undefined;

export function isWithinWindow(
  deliveredAt: DeliveryTimestamp,
  now: Date = new Date(),
): boolean {
  if (!deliveredAt) return false;
  const diffMs = now.getTime() - deliveredAt.getTime();
  if (diffMs < 0) return false;
  const maxMs = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return diffMs <= maxMs;
}

export interface ItemEligibilityInput {
  orderItem: Pick<OrderItem, 'quantity'> & {
    product: Pick<Product, 'returnable'> | null;
  };
  requestedQty: number;
  alreadyReturnedQty: number;
}

export function checkItemEligibility(
  input: ItemEligibilityInput,
): EligibilityFailure | null {
  if (input.requestedQty <= 0) return 'INVALID_QUANTITY';
  if (input.orderItem.product && !input.orderItem.product.returnable) {
    return 'PRODUCT_NOT_RETURNABLE';
  }
  const remaining = input.orderItem.quantity - input.alreadyReturnedQty;
  if (remaining <= 0) return 'ITEM_ALREADY_RETURNED';
  if (input.requestedQty > remaining) return 'QUANTITY_EXCEEDS_ORDERED';
  return null;
}
