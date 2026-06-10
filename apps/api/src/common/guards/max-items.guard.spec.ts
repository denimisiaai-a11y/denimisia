import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MaxItemsGuard } from './max-items.guard';
import { BulkOperationMeta } from '../bulk/bulk-operation.metadata';
import { Role } from '../decorators/roles.decorator';

function makeMeta(
  overrides: Partial<BulkOperationMeta> = {},
): BulkOperationMeta {
  return {
    event: 'product.bulk.feature',
    endpoint: 'POST /products/bulk/feature',
    maxItems: 3,
    roles: [Role.MANAGER],
    transactional: false,
    ...overrides,
  };
}

function makeContext(body: unknown): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

describe('MaxItemsGuard', () => {
  function build(meta: BulkOperationMeta | undefined): MaxItemsGuard {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(meta),
    } as unknown as Reflector;
    return new MaxItemsGuard(reflector);
  }

  it('passes through when no bulk meta is attached', () => {
    const guard = build(undefined);
    const context = makeContext({ ids: Array(10_000).fill('x') });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('passes when ids length is at or below maxItems', () => {
    const guard = build(makeMeta({ maxItems: 3 }));

    expect(guard.canActivate(makeContext({ ids: ['a', 'b', 'c'] }))).toBe(true);
    expect(guard.canActivate(makeContext({ ids: ['a'] }))).toBe(true);
  });

  it('passes when body is missing or ids is not an array (deferred to schema)', () => {
    const guard = build(makeMeta({ maxItems: 3 }));

    expect(guard.canActivate(makeContext({}))).toBe(true);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
    expect(guard.canActivate(makeContext({ ids: 'not-an-array' }))).toBe(true);
  });

  it('throws 413 when ids length exceeds maxItems', () => {
    const guard = build(makeMeta({ maxItems: 3 }));
    const context = makeContext({ ids: ['a', 'b', 'c', 'd'] });

    try {
      guard.canActivate(context);
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
      const body = (err as HttpException).getResponse() as {
        error: string;
        maxItems: number;
        received: number;
      };
      expect(body.error).toBe('TOO_MANY_ITEMS');
      expect(body.maxItems).toBe(3);
      expect(body.received).toBe(4);
    }
  });
});
