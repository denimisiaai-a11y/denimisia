import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../decorators/roles.decorator';

export const BULK_OPERATION_META = 'bulk-operation-meta';

// Audit event suffixes. The intent/outcome interceptors read these to derive
// the action name. Investigators grep audit_log.action for them.
export const AUDIT_INTENT_SUFFIX = '.intent';
export const AUDIT_FAILURE_SUFFIX = '.failed';
export const AUDIT_ENTITY = 'bulk_operation';

// Redis key prefix for the per-actor sliding-window rate limiter. Anyone
// scanning Redis for bulk-op state should grep for this prefix.
export const BULK_RATE_LIMIT_KEY_PREFIX = 'bulk:rl';

export interface BulkRateLimit {
  readonly windowMs: number;
  readonly max: number;
}

/** @internal — runtime metadata shape stored on the handler. Public API is BulkOperationOptions. */
export interface BulkOperationMeta {
  readonly event: string;
  readonly endpoint: string;
  readonly maxItems: number;
  readonly roles: readonly Role[];
  readonly rateLimit?: BulkRateLimit;
  readonly transactional: boolean;
}

export function getBulkMeta(
  reflector: Reflector,
  context: ExecutionContext,
): BulkOperationMeta | undefined {
  return reflector.getAllAndOverride<BulkOperationMeta | undefined>(
    BULK_OPERATION_META,
    [context.getHandler(), context.getClass()],
  );
}
