import { OrderStatus } from '@prisma/client';

// userId is nullable on customer-initiated events because guest checkout
// (LR-001 Phase 1 slice B) lets anonymous customers complete an order. The
// downstream audit log row falls through with userId = NULL in that case;
// the entity + entityId still point at the Order so admins can trace which
// order the event belonged to.
//
// userId stays REQUIRED on OrderStatusChangedEvent.changedBy because only
// authenticated admins can transition order state — there is never a guest
// status change.
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string | null,
    public readonly total: number,
  ) {}
}

export class OrderStatusChangedEvent {
  constructor(
    public readonly orderId: string,
    public readonly fromStatus: OrderStatus,
    public readonly toStatus: OrderStatus,
    public readonly changedBy: string,
  ) {}
}

export class OrderDeliveredEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string | null,
    public readonly total: number,
  ) {}
}

export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string | null,
    public readonly items: Array<{ variantId: string; quantity: number }>,
  ) {}
}
