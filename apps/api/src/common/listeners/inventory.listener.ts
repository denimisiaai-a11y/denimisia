import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import { LowStockEvent } from '../events/inventory.events';

@Injectable()
export class InventoryListener {
  constructor(private readonly auditLogService: AuditLogService) {}

  @OnEvent('inventory.low_stock')
  async handleLowStock(event: LowStockEvent) {
    await this.auditLogService.log(
      'system',
      'inventory.low_stock',
      'ProductVariant',
      event.variantId,
      {
        productName: event.productName,
        currentStock: event.currentStock,
        threshold: event.threshold,
      },
    );
  }
}
