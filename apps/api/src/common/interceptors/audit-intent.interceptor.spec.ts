import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { AuditIntentInterceptor } from './audit-intent.interceptor';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import { BulkOperationMeta } from '../bulk/bulk-operation.metadata';
import { Role } from '../decorators/roles.decorator';

function makeMeta(
  overrides: Partial<BulkOperationMeta> = {},
): BulkOperationMeta {
  return {
    event: 'product.bulk.feature',
    endpoint: 'POST /products/bulk/feature',
    maxItems: 250,
    roles: [Role.MANAGER],
    transactional: false,
    ...overrides,
  };
}

function makeContext(
  user: { id?: string } | undefined,
  body: unknown,
): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user, body }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuditIntentInterceptor', () => {
  const next: CallHandler = { handle: () => of('ok') };

  function build(meta: BulkOperationMeta | undefined): {
    interceptor: AuditIntentInterceptor;
    log: jest.Mock;
  } {
    const log = jest.fn().mockResolvedValue(undefined);
    const audit = { log } as unknown as AuditLogService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(meta),
    } as unknown as Reflector;
    return { interceptor: new AuditIntentInterceptor(reflector, audit), log };
  }

  // Fire-and-forget audit: yield a tick so the synchronous .log() call lands
  // before the assertion runs.
  const flush = () => new Promise<void>((r) => setImmediate(r));

  it('skips when no bulk meta is attached', async () => {
    const { interceptor, log } = build(undefined);
    const context = makeContext({ id: 'u1' }, { ids: ['p1'] });

    const result = await firstValueFrom(interceptor.intercept(context, next));
    await flush();

    expect(result).toBe('ok');
    expect(log).not.toHaveBeenCalled();
  });

  it('writes <event>.intent with ids + idempotency key', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    const context = makeContext(
      { id: 'u-42' },
      {
        ids: ['p1', 'p2'],
        idempotencyKey: 'idem-abc-12345',
        reason: 'spring sale',
      },
    );

    await firstValueFrom(interceptor.intercept(context, next));
    await flush();

    expect(log).toHaveBeenCalledWith(
      'u-42',
      'product.bulk.feature.intent',
      'bulk_operation',
      undefined,
      expect.objectContaining({
        endpoint: 'POST /products/bulk/feature',
        idCount: 2,
        ids: ['p1', 'p2'],
        idempotencyKey: 'idem-abc-12345',
        reason: 'spring sale',
      }),
    );
  });

  it('caps the ids snapshot at 100 entries to bound audit payload size', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    const ids = Array.from({ length: 150 }, (_, i) => `p${i}`);
    const context = makeContext(
      { id: 'u-1' },
      { ids, idempotencyKey: 'idem-zzz-99999' },
    );

    await firstValueFrom(interceptor.intercept(context, next));
    await flush();

    const call = log.mock.calls[0] as [
      string,
      string,
      string,
      undefined,
      { idCount: number; ids: string[] },
    ];
    expect(call[4].idCount).toBe(150);
    expect(call[4].ids).toHaveLength(100);
  });

  it('uses "unknown" actor when no user is on the request', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    const context = makeContext(undefined, {
      ids: ['p1'],
      idempotencyKey: 'idem-abc-12345',
    });

    await firstValueFrom(interceptor.intercept(context, next));
    await flush();

    const call = log.mock.calls[0] as [string, ...unknown[]];
    expect(call[0]).toBe('unknown');
  });

  it('proceeds immediately without waiting for the audit write to complete', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    let resolveLog: ((v: unknown) => void) | undefined;
    log.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLog = resolve;
      }),
    );
    const context = makeContext(
      { id: 'u-1' },
      { ids: ['p1'], idempotencyKey: 'idem-abc-12345' },
    );

    const result = await firstValueFrom(interceptor.intercept(context, next));

    // Handler completed without the audit promise having resolved.
    expect(result).toBe('ok');
    resolveLog?.(undefined);
  });

  it('swallows audit log failure so the request still proceeds', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    log.mockRejectedValueOnce(new Error('db down'));
    const context = makeContext(
      { id: 'u-1' },
      { ids: ['p1'], idempotencyKey: 'idem-abc-12345' },
    );

    const result = await firstValueFrom(interceptor.intercept(context, next));
    await flush();

    expect(result).toBe('ok');
  });
});
