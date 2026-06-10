import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getBulkMeta } from '../bulk/bulk-operation.metadata';

// Rejects bulk requests whose body.ids exceeds the endpoint's declared maxItems
// BEFORE any interceptor runs. The admin UI uses the 413 + maxItems payload to
// switch to the chunked/escalation flow.
@Injectable()
export class MaxItemsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = getBulkMeta(this.reflector, context);
    if (!meta) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ body?: { ids?: unknown } }>();
    const ids = req.body?.ids;
    const count = Array.isArray(ids) ? ids.length : 0;

    if (count > meta.maxItems) {
      throw new HttpException(
        {
          success: false,
          error: 'TOO_MANY_ITEMS',
          message: `This endpoint accepts at most ${meta.maxItems} ids per call. Received ${count}.`,
          maxItems: meta.maxItems,
          received: count,
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    return true;
  }
}
