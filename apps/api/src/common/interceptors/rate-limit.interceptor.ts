import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
  OnModuleInit,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { Observable, from, switchMap } from 'rxjs';
import {
  BULK_RATE_LIMIT_KEY_PREFIX,
  BulkOperationMeta,
  getBulkMeta,
} from '../bulk/bulk-operation.metadata';
import { InjectRedis } from '../../modules/redis/redis.decorator';

// Atomic sliding-window: trim old entries, count, either add the new entry or
// return the oldest in-window score for Retry-After. One round-trip, atomic —
// eliminates the check-then-set race two concurrent requests can hit at
// count = limit - 1. Returns {0, ""} on allow, {1, oldestScore} on reject.
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local maxCount = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])

redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
local count = redis.call('ZCARD', key)
if count >= maxCount then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {1, oldest[2] or ''}
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl)
return {0, ''}
`.trim();

interface RedisWithSlidingWindow extends Redis {
  bulkSlidingWindow(
    key: string,
    now: string,
    windowStart: string,
    maxCount: string,
    member: string,
    ttl: string,
  ): Promise<[number, string]>;
}

@Injectable()
export class RateLimitInterceptor implements NestInterceptor, OnModuleInit {
  constructor(
    private readonly reflector: Reflector,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  onModuleInit(): void {
    this.redis.defineCommand('bulkSlidingWindow', {
      numberOfKeys: 1,
      lua: SLIDING_WINDOW_SCRIPT,
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = getBulkMeta(this.reflector, context);
    if (!meta?.rateLimit) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<{ user?: { id?: string } }>();
    const userId = req.user?.id;
    // No actor → auth chain has already failed; don't double-spend a 429.
    if (!userId) return next.handle();

    const res = http.getResponse<{
      setHeader?: (k: string, v: string | number) => void;
    }>();

    return from(this.consume(userId, meta, res)).pipe(
      switchMap(() => next.handle()),
    );
  }

  private async consume(
    userId: string,
    meta: BulkOperationMeta,
    res: { setHeader?: (k: string, v: string | number) => void },
  ): Promise<void> {
    const limit = meta.rateLimit!;
    const key = `${BULK_RATE_LIMIT_KEY_PREFIX}:${userId}:${meta.endpoint}`;
    const now = Date.now();
    const windowStart = now - limit.windowMs;
    // +60s TTL headroom so the key self-cleans if traffic stops.
    const ttlSec = Math.ceil(limit.windowMs / 1000) + 60;
    const member = `${now}:${randomBytes(4).toString('hex')}`;

    const redis = this.redis as RedisWithSlidingWindow;
    const [rejected, oldestScoreRaw] = await redis.bulkSlidingWindow(
      key,
      String(now),
      String(windowStart),
      String(limit.max),
      member,
      String(ttlSec),
    );

    if (rejected === 1) {
      const oldestScore = parseInt(oldestScoreRaw, 10);
      const retryAfterMs = Number.isFinite(oldestScore)
        ? Math.max(1, oldestScore + limit.windowMs - now)
        : limit.windowMs;
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));

      res.setHeader?.('Retry-After', retryAfterSec);

      throw new HttpException(
        {
          success: false,
          error: 'RATE_LIMITED',
          message: `Bulk operation rate limit exceeded for ${meta.endpoint}.`,
          retryAfterSeconds: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
