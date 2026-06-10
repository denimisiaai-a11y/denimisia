import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import {
  AUDIT_ENTITY,
  AUDIT_INTENT_SUFFIX,
  getBulkMeta,
} from '../bulk/bulk-operation.metadata';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';

// Writes `<event>.intent` before the handler runs. Fire-and-forget — audit
// latency must not slow bulk requests. If the audit row fails, the request
// still proceeds and the outcome interceptor will still record the result.
@Injectable()
export class AuditIntentInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditIntentInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLog: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = getBulkMeta(this.reflector, context);
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<{
      user?: { id?: string };
      body?: { ids?: unknown; idempotencyKey?: unknown; reason?: unknown };
    }>();
    const userId = req.user?.id ?? 'unknown';
    const body = req.body ?? {};
    const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];

    this.auditLog
      .log(
        userId,
        `${meta.event}${AUDIT_INTENT_SUFFIX}`,
        AUDIT_ENTITY,
        undefined,
        {
          endpoint: meta.endpoint,
          idCount: ids.length,
          ids: ids.slice(0, 100),
          idempotencyKey:
            typeof body.idempotencyKey === 'string'
              ? body.idempotencyKey
              : null,
          reason: typeof body.reason === 'string' ? body.reason : null,
        },
      )
      .catch((err: unknown) => {
        this.logger.error(`audit-intent log failed for ${meta.event}`, err);
      });

    return next.handle();
  }
}
