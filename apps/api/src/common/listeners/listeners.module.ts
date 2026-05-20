import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../modules/audit-log/audit-log.module';
import { EmailModule } from '../../modules/email/email.module';
import { OrderListener } from './order.listener';
import { OrderEmailListener } from './order-email.listener';
import { ReturnEmailListener } from './return-email.listener';
import { InventoryListener } from './inventory.listener';

@Module({
  imports: [AuditLogModule, EmailModule],
  providers: [
    OrderListener,
    OrderEmailListener,
    ReturnEmailListener,
    InventoryListener,
  ],
})
export class ListenersModule {}
