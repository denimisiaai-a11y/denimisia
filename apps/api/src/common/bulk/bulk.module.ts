import { Global, Module } from '@nestjs/common';
import { AuditLogModule } from '../../modules/audit-log/audit-log.module';
import { MaxItemsGuard } from '../guards/max-items.guard';
import { RateLimitInterceptor } from '../interceptors/rate-limit.interceptor';
import { AuditIntentInterceptor } from '../interceptors/audit-intent.interceptor';
import { TransactionInterceptor } from '../interceptors/transaction.interceptor';
import { AuditOutcomeInterceptor } from '../interceptors/audit-outcome.interceptor';

// @Global so feature modules don't have to import this for @BulkOperation to
// resolve. PrismaModule and RedisModule are already @Global; AuditLogModule
// is not, hence the explicit import.
@Global()
@Module({
  imports: [AuditLogModule],
  providers: [
    MaxItemsGuard,
    RateLimitInterceptor,
    AuditIntentInterceptor,
    TransactionInterceptor,
    AuditOutcomeInterceptor,
  ],
  exports: [
    MaxItemsGuard,
    RateLimitInterceptor,
    AuditIntentInterceptor,
    TransactionInterceptor,
    AuditOutcomeInterceptor,
  ],
})
export class BulkModule {}
