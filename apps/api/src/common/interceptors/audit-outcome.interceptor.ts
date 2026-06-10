import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import {
  AUDIT_ENTITY,
  AUDIT_FAILURE_SUFFIX,
  BulkOperationMeta,
  getBulkMeta,
} from '../bulk/bulk-operation.metadata';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import { BulkOperationResult } from '../dto/bulk-operation.dto';

// Writes the outcome row after the handler resolves: `<event>` on success
// with a success/failure/skip breakdown, `<event>.failed` on thrown error.
@Injectable()
export class AuditOutcomeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditOutcomeInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLog: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = getBulkMeta(this.reflector, context);
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = req.user?.id ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: (value: unknown) => this.recordSuccess(userId, meta, value),
        error: (err: unknown) => this.recordFailure(userId, meta, err),
      }),
    );
  }

  private recordSuccess(
    userId: string,
    meta: BulkOperationMeta,
    value: unknown,
  ): void {
    const result = (value ?? {}) as Partial<BulkOperationResult>;
    const succeeded = Array.isArray(result.succeeded) ? result.succeeded : [];
    const failed = Array.isArray(result.failed) ? result.failed : [];
    const skipped = Array.isArray(result.skipped) ? result.skipped : [];

    this.auditLog
      .log(userId, meta.event, AUDIT_ENTITY, undefined, {
        endpoint: meta.endpoint,
        succeededCount: succeeded.length,
        failedCount: failed.length,
        skippedCount: skipped.length,
        succeededIds: succeeded.slice(0, 100),
        failedIds: failed.slice(0, 50).map((f) => f.id),
        undoToken: result.undoToken ?? null,
      })
      .catch((err: unknown) => {
        this.logger.error(`audit-outcome log failed for ${meta.event}`, err);
      });
  }

  private recordFailure(
    userId: string,
    meta: BulkOperationMeta,
    err: unknown,
  ): void {
    const message = err instanceof Error ? err.message : String(err);
    this.auditLog
      .log(
        userId,
        `${meta.event}${AUDIT_FAILURE_SUFFIX}`,
        AUDIT_ENTITY,
        undefined,
        {
          endpoint: meta.endpoint,
          error: message,
        },
      )
      .catch((logErr: unknown) => {
        this.logger.error(
          `audit-outcome failure log failed for ${meta.event}`,
          logErr,
        );
      });
  }
}
