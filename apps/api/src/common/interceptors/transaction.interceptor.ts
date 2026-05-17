import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, defer, firstValueFrom, from } from 'rxjs';
import { getBulkMeta } from '../bulk/bulk-operation.metadata';
import { PrismaService } from '../../modules/prisma/prisma.service';

// Cross-module contract: services that want to honor the active transaction
// read `req.prismaTx` and fall back to `this.prisma`. Set only while the
// $transaction callback is running.
@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = getBulkMeta(this.reflector, context);
    if (!meta?.transactional) return next.handle();

    const req = context.switchToHttp().getRequest<{ prismaTx?: unknown }>();

    return defer(() =>
      from(
        this.prisma.$transaction(async (tx): Promise<unknown> => {
          req.prismaTx = tx;
          try {
            const result: unknown = await firstValueFrom(next.handle());
            return result;
          } finally {
            delete req.prismaTx;
          }
        }),
      ),
    );
  }
}
