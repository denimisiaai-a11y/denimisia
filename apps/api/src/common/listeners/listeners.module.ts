import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../modules/audit-log/audit-log.module';
import { OrderListener } from './order.listener';
import { InventoryListener } from './inventory.listener';

@Module({
  imports: [AuditLogModule],
  providers: [OrderListener, InventoryListener],
})
export class ListenersModule {}
