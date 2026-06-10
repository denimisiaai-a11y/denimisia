import {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderDeliveredEvent,
  OrderCancelledEvent,
} from './order.events';

describe('Order Events', () => {
  describe('OrderCreatedEvent', () => {
    it('should store orderId, userId, and total', () => {
      const event = new OrderCreatedEvent('order-1', 'user-1', 5000);

      expect(event.orderId).toBe('order-1');
      expect(event.userId).toBe('user-1');
      expect(event.total).toBe(5000);
    });
  });

  describe('OrderStatusChangedEvent', () => {
    it('should store orderId, fromStatus, toStatus, and changedBy', () => {
      const event = new OrderStatusChangedEvent(
        'order-1',
        'PENDING' as any,
        'CONFIRMED' as any,
        'admin-user',
      );

      expect(event.orderId).toBe('order-1');
      expect(event.fromStatus).toBe('PENDING');
      expect(event.toStatus).toBe('CONFIRMED');
      expect(event.changedBy).toBe('admin-user');
    });
  });

  describe('OrderDeliveredEvent', () => {
    it('should store orderId, userId, and total', () => {
      const event = new OrderDeliveredEvent('order-1', 'user-1', 3000);

      expect(event.orderId).toBe('order-1');
      expect(event.userId).toBe('user-1');
      expect(event.total).toBe(3000);
    });
  });

  describe('OrderCancelledEvent', () => {
    it('should store orderId, userId, and items with variantId and quantity', () => {
      const items = [
        { variantId: 'var-1', quantity: 2 },
        { variantId: 'var-2', quantity: 1 },
      ];
      const event = new OrderCancelledEvent('order-1', 'user-1', items);

      expect(event.orderId).toBe('order-1');
      expect(event.userId).toBe('user-1');
      expect(event.items).toEqual(items);
      expect(event.items).toHaveLength(2);
    });
  });
});
