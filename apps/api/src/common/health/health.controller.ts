import { Controller, Get } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { InjectRedis } from '../../modules/redis/redis.decorator';

/**
 * Liveness (/health) and readiness (/ready) endpoints for ops / load balancers.
 *
 * - /health  → process is up. Always 200 once bootstrap completes. Used by
 *              container liveness probes; restart if this fails.
 * - /ready   → downstreams (DB + Redis) are reachable. Used by readiness
 *              probes; do not route traffic here until this returns 200.
 */
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Get('health')
  health(): { status: 'ok'; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready(): Promise<{
    status: 'ok' | 'degraded';
    checks: { db: 'ok' | 'fail'; redis: 'ok' | 'fail' };
    timestamp: string;
  }> {
    const [db, redis] = await Promise.all([
      this.prisma
        .$queryRawUnsafe('SELECT 1')
        .then(() => 'ok' as const)
        .catch(() => 'fail' as const),
      this.redis
        .ping()
        .then(() => 'ok' as const)
        .catch(() => 'fail' as const),
    ]);
    const status = db === 'ok' && redis === 'ok' ? 'ok' : 'degraded';
    return {
      status,
      checks: { db, redis },
      timestamp: new Date().toISOString(),
    };
  }
}
