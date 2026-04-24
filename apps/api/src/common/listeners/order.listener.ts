import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import {
  OrderCreatedEvent,
  OrderStatusChangedEvent,
  OrderCancelledEvent,
} from '../events/order.events';

@Injectable()
export class OrderListener {
  constructor(private readonly auditLogService: AuditLogService) {}

  @OnEvent('order.created')
  async handleOrderCreated(event: OrderCreatedEvent) {
    await this.auditLogService.log(
      event.userId,
      'order.created',
      'Order',
      event.orderId,
      { total: event.total },
    );
  }

  @OnEvent('order.status_changed')
  async handleOrderStatusChanged(event: OrderStatusChangedEvent) {
    await this.auditLogService.log(
      event.changedBy,
      'order.status_changed',
      'Order',
      event.orderId,
      {
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
      },
    );
  }

  @OnEvent('order.cancelled')
  async handleOrderCancelled(event: OrderCancelledEvent) {
    await this.auditLogService.log(
      event.userId,
      'order.cancelled',
      'Order',
      event.orderId,
      {
        itemCount: event.items.length,
        items: event.items,
      },
    );
  }
}
