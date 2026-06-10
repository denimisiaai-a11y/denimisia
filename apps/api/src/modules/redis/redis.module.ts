import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.decorator';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // maxRetriesPerRequest caps how long a single command waits before
        // throwing. Without it, ioredis queues commands indefinitely while
        // reconnecting — so a Redis outage stalls every auth request for
        // ~4s before the caller sees an error. Three retries (~150ms) is
        // enough to ride out a single dropped connection but fails fast
        // when Redis is truly down, letting the auth path's try/catch
        // fallbacks kick in.
        return new Redis(
          config.get<string>('REDIS_URL', 'redis://localhost:6379'),
          {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
          },
        );
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
