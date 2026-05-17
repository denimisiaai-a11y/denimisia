import {
  SetMetadata,
  UseGuards,
  UseInterceptors,
  applyDecorators,
} from '@nestjs/common';
import {
  BULK_OPERATION_META,
  BulkOperationMeta,
  BulkRateLimit,
} from '../bulk/bulk-operation.metadata';
import { Role, Roles } from './roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { MaxItemsGuard } from '../guards/max-items.guard';
import { RateLimitInterceptor } from '../interceptors/rate-limit.interceptor';
import { AuditIntentInterceptor } from '../interceptors/audit-intent.interceptor';
import { TransactionInterceptor } from '../interceptors/transaction.interceptor';
import { AuditOutcomeInterceptor } from '../interceptors/audit-outcome.interceptor';

export interface BulkOperationOptions {
  /** Audit event name, e.g. 'product.bulk.feature'. Suffixed with `.intent` and `.failed` by interceptors. */
  readonly event: string;
  /** Logical endpoint label, e.g. 'POST /products/bulk/feature'. Used as rate-limit key suffix + audit breadcrumb. */
  readonly endpoint: string;
  /** Roles allowed to invoke. Caller enumerates explicitly; RolesGuard uses strict equality. For ladder checks use hasRole() in service code. */
  readonly roles: readonly Role[];
  /** Hard cap on body.ids.length, enforced by MaxItemsGuard before interceptors run. */
  readonly maxItems: number;
  /** Optional Redis sliding-window per {adminUserId}:{endpoint}. */
  readonly rateLimit?: BulkRateLimit;
  /** When true, wraps the handler in prisma.$transaction. Defaults to false. */
  readonly transactional?: boolean;
}

// Locked stack for every bulk admin endpoint. Order is enforced here by the
// applyDecorators call order and asserted by bulk-operation.decorator.matrix.spec.ts.
//
// Guards (run before interceptors):  JwtAuthGuard → RolesGuard → MaxItemsGuard
// Interceptors (request order):      RateLimit → AuditIntent → Transaction → AuditOutcome
//
// MaxItemsGuard is a Guard (not an interceptor) so 413 fires before any
// interceptor side effects (no audit row, no Redis hit).
export function BulkOperation(options: BulkOperationOptions) {
  const meta: BulkOperationMeta = {
    event: options.event,
    endpoint: options.endpoint,
    maxItems: options.maxItems,
    roles: options.roles,
    rateLimit: options.rateLimit,
    transactional: options.transactional ?? false,
  };

  return applyDecorators(
    SetMetadata(BULK_OPERATION_META, meta),
    Roles(...options.roles),
    UseGuards(JwtAuthGuard, RolesGuard, MaxItemsGuard),
    UseInterceptors(
      RateLimitInterceptor,
      AuditIntentInterceptor,
      TransactionInterceptor,
      AuditOutcomeInterceptor,
    ),
  );
}
