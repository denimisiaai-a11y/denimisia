import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuditOutcomeInterceptor } from './audit-outcome.interceptor';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import { BulkOperationMeta } from '../bulk/bulk-operation.metadata';
import { Role } from '../decorators/roles.decorator';
import { BulkOperationResult } from '../dto/bulk-operation.dto';

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

function makeContext(userId: string | undefined): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: userId ? { id: userId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuditOutcomeInterceptor', () => {
  function build(meta: BulkOperationMeta | undefined): {
    interceptor: AuditOutcomeInterceptor;
    log: jest.Mock;
  } {
    const log = jest.fn().mockResolvedValue(undefined);
    const audit = { log } as unknown as AuditLogService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(meta),
    } as unknown as Reflector;
    return { interceptor: new AuditOutcomeInterceptor(reflector, audit), log };
  }

  // tap callbacks fire asynchronously after subscription completes; this helper
  // yields once so jest.fn() has a chance to receive the call.
  const flush = () => new Promise<void>((r) => setImmediate(r));

  it('skips when no bulk meta is attached', async () => {
    const { interceptor, log } = build(undefined);
    const next: CallHandler = { handle: () => of('ok') };

    const result = await firstValueFrom(
      interceptor.intercept(makeContext('u1'), next),
    );
    await flush();

    expect(result).toBe('ok');
    expect(log).not.toHaveBeenCalled();
  });

  it('writes <event> with success/failure/skip counts on success', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    const result: BulkOperationResult = {
      succeeded: ['p1', 'p2'],
      failed: [{ id: 'p3', code: 'CONFLICT', message: 'version mismatch' }],
      skipped: ['p4'],
      undoToken: 'undo-abc',
      versionMap: {
        p1: '2026-05-16T10:00:00.000Z',
        p2: '2026-05-16T10:00:00.000Z',
      },
    };
    const next: CallHandler = { handle: () => of(result) };

    await firstValueFrom(interceptor.intercept(makeContext('u-42'), next));
    await flush();

    expect(log).toHaveBeenCalledWith(
      'u-42',
      'product.bulk.feature',
      'bulk_operation',
      undefined,
      expect.objectContaining({
        endpoint: 'POST /products/bulk/feature',
        succeededCount: 2,
        failedCount: 1,
        skippedCount: 1,
        succeededIds: ['p1', 'p2'],
        failedIds: ['p3'],
        undoToken: 'undo-abc',
      }),
    );
  });

  it('writes <event>.failed when the handler throws', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    const next: CallHandler = {
      handle: () => throwError(() => new Error('explode')),
    };

    await expect(
      firstValueFrom(interceptor.intercept(makeContext('u-42'), next)),
    ).rejects.toThrow('explode');
    await flush();

    expect(log).toHaveBeenCalledWith(
      'u-42',
      'product.bulk.feature.failed',
      'bulk_operation',
      undefined,
      expect.objectContaining({
        endpoint: 'POST /products/bulk/feature',
        error: 'explode',
      }),
    );
  });

  it('handles malformed result envelopes without crashing', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    const next: CallHandler = { handle: () => of(null) };

    await firstValueFrom(interceptor.intercept(makeContext('u-1'), next));
    await flush();

    expect(log).toHaveBeenCalledWith(
      'u-1',
      'product.bulk.feature',
      'bulk_operation',
      undefined,
      expect.objectContaining({
        succeededCount: 0,
        failedCount: 0,
        skippedCount: 0,
        undoToken: null,
      }),
    );
  });

  it('uses "unknown" actor when no user is on the request', async () => {
    const meta = makeMeta();
    const { interceptor, log } = build(meta);
    const next: CallHandler = {
      handle: () =>
        of({ succeeded: [], failed: [], skipped: [], versionMap: {} }),
    };

    await firstValueFrom(interceptor.intercept(makeContext(undefined), next));
    await flush();

    const call = log.mock.calls[0] as [string, ...unknown[]];
    expect(call[0]).toBe('unknown');
  });
});
