import { CallHandler, ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { RateLimitInterceptor } from './rate-limit.interceptor';
import { BulkOperationMeta } from '../bulk/bulk-operation.metadata';
import { Role } from '../decorators/roles.decorator';

interface FakeRedis {
  defineCommand: jest.Mock;
  bulkSlidingWindow: jest.Mock;
}

function fakeRedis(): FakeRedis {
  return {
    defineCommand: jest.fn(),
    bulkSlidingWindow: jest.fn().mockResolvedValue([0, '']),
  };
}

function makeMeta(
  overrides: Partial<BulkOperationMeta> = {},
): BulkOperationMeta {
  return {
    event: 'product.bulk.feature',
    endpoint: 'POST /products/bulk/feature',
    maxItems: 250,
    roles: [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN],
    rateLimit: { windowMs: 60_000, max: 10 },
    transactional: false,
    ...overrides,
  };
}

function makeContext(user: { id?: string } | undefined): {
  context: ExecutionContext;
  setHeader: jest.Mock;
} {
  const setHeader = jest.fn();
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  return { context, setHeader };
}

describe('RateLimitInterceptor', () => {
  const next: CallHandler = { handle: () => of('ok') };

  function build(meta: BulkOperationMeta | undefined): {
    interceptor: RateLimitInterceptor;
    redis: FakeRedis;
  } {
    const redis = fakeRedis();
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(meta),
    } as unknown as Reflector;
    const interceptor = new RateLimitInterceptor(reflector, redis as never);
    interceptor.onModuleInit();
    return { interceptor, redis };
  }

  it('registers the sliding-window Lua command on module init', () => {
    const { redis } = build(makeMeta());

    expect(redis.defineCommand).toHaveBeenCalledWith(
      'bulkSlidingWindow',
      expect.objectContaining({ numberOfKeys: 1, lua: expect.any(String) }),
    );
  });

  it('skips when no bulk meta is attached', async () => {
    const { interceptor, redis } = build(undefined);
    const { context } = makeContext({ id: 'u1' });

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('ok');
    expect(redis.bulkSlidingWindow).not.toHaveBeenCalled();
  });

  it('skips when meta has no rateLimit', async () => {
    const meta = makeMeta({ rateLimit: undefined });
    const { interceptor, redis } = build(meta);
    const { context } = makeContext({ id: 'u1' });

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('ok');
    expect(redis.bulkSlidingWindow).not.toHaveBeenCalled();
  });

  it('skips when request has no authenticated user', async () => {
    const meta = makeMeta();
    const { interceptor, redis } = build(meta);
    const { context } = makeContext(undefined);

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('ok');
    expect(redis.bulkSlidingWindow).not.toHaveBeenCalled();
  });

  it('invokes the Lua script and proceeds when allowed', async () => {
    const meta = makeMeta();
    const { interceptor, redis } = build(meta);
    redis.bulkSlidingWindow.mockResolvedValueOnce([0, '']);
    const { context } = makeContext({ id: 'u-42' });

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBe('ok');
    expect(redis.bulkSlidingWindow).toHaveBeenCalledTimes(1);
    const [key] = redis.bulkSlidingWindow.mock.calls[0] as [string];
    expect(key).toBe('bulk:rl:u-42:POST /products/bulk/feature');
  });

  it('throws 429 with Retry-After when the script reports rejection', async () => {
    const meta = makeMeta({ rateLimit: { windowMs: 60_000, max: 5 } });
    const { interceptor, redis } = build(meta);
    redis.bulkSlidingWindow.mockResolvedValueOnce([
      1,
      String(Date.now() - 1_000),
    ]);
    const { context, setHeader } = makeContext({ id: 'u-42' });

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBeInstanceOf(HttpException);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  it('exposes retryAfterSeconds on the 429 payload', async () => {
    const meta = makeMeta({ rateLimit: { windowMs: 10_000, max: 1 } });
    const { interceptor, redis } = build(meta);
    redis.bulkSlidingWindow.mockResolvedValueOnce([
      1,
      String(Date.now() - 2_000),
    ]);
    const { context } = makeContext({ id: 'u-42' });

    try {
      await firstValueFrom(interceptor.intercept(context, next));
      fail('expected 429');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const body = (err as HttpException).getResponse() as {
        error: string;
        retryAfterSeconds: number;
      };
      expect(body.error).toBe('RATE_LIMITED');
      expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    }
  });
});
