import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { TransactionInterceptor } from './transaction.interceptor';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { BulkOperationMeta } from '../bulk/bulk-operation.metadata';
import { Role } from '../decorators/roles.decorator';

interface RequestShape {
  prismaTx?: unknown;
}

function makeMeta(
  overrides: Partial<BulkOperationMeta> = {},
): BulkOperationMeta {
  return {
    event: 'product.bulk.delete',
    endpoint: 'POST /products/bulk/delete',
    maxItems: 250,
    roles: [Role.ADMIN],
    transactional: true,
    ...overrides,
  };
}

function makeContext(req: RequestShape): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('TransactionInterceptor', () => {
  function build(
    meta: BulkOperationMeta | undefined,
    txImpl?: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>,
  ): { interceptor: TransactionInterceptor; txMock: jest.Mock } {
    const txMock = jest.fn(
      txImpl ??
        (async (cb: (tx: unknown) => Promise<unknown>) => cb({ marker: 'tx' })),
    );
    const prisma = { $transaction: txMock } as unknown as PrismaService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(meta),
    } as unknown as Reflector;
    return {
      interceptor: new TransactionInterceptor(reflector, prisma),
      txMock,
    };
  }

  it('skips when no bulk meta is attached', async () => {
    const { interceptor, txMock } = build(undefined);
    const req: RequestShape = {};
    const next: CallHandler = { handle: () => of('ok') };

    const result = await firstValueFrom(
      interceptor.intercept(makeContext(req), next),
    );

    expect(result).toBe('ok');
    expect(txMock).not.toHaveBeenCalled();
    expect(req.prismaTx).toBeUndefined();
  });

  it('skips when transactional is false', async () => {
    const meta = makeMeta({ transactional: false });
    const { interceptor, txMock } = build(meta);
    const req: RequestShape = {};
    const next: CallHandler = { handle: () => of('ok') };

    const result = await firstValueFrom(
      interceptor.intercept(makeContext(req), next),
    );

    expect(result).toBe('ok');
    expect(txMock).not.toHaveBeenCalled();
  });

  it('runs the handler inside $transaction and attaches tx client', async () => {
    const meta = makeMeta();
    const { interceptor, txMock } = build(meta);
    const req: RequestShape = {};
    let seenTx: unknown;
    const next: CallHandler = {
      handle: () => {
        seenTx = req.prismaTx;
        return of('ok');
      },
    };

    const result = await firstValueFrom(
      interceptor.intercept(makeContext(req), next),
    );

    expect(result).toBe('ok');
    expect(txMock).toHaveBeenCalledTimes(1);
    expect(seenTx).toEqual({ marker: 'tx' });
    // After completion, tx should be cleaned up off the request.
    expect(req.prismaTx).toBeUndefined();
  });

  it('rolls back when the handler errors and clears the tx client', async () => {
    const meta = makeMeta();
    const { interceptor, txMock } = build(meta);
    const req: RequestShape = {};
    const next: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      firstValueFrom(interceptor.intercept(makeContext(req), next)),
    ).rejects.toThrow('boom');

    expect(txMock).toHaveBeenCalledTimes(1);
    expect(req.prismaTx).toBeUndefined();
  });

  it('propagates errors from the transaction wrapper itself', async () => {
    const meta = makeMeta();
    const { interceptor } = build(meta, () =>
      Promise.reject(new Error('tx failed')),
    );
    const req: RequestShape = {};
    const next: CallHandler = { handle: () => of('ok') };

    await expect(
      firstValueFrom(interceptor.intercept(makeContext(req), next)),
    ).rejects.toThrow('tx failed');
  });
});
