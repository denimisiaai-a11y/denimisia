import { REDIS_CLIENT } from '../../modules/redis/redis.decorator';

// In-memory Redis stand-in for NestJS test modules whose services depend on
// REDIS_CLIENT. Covers the methods our services actually call today. Add new
// methods here when a service starts using one that isn't stubbed.
export function createRedisMock(): {
  get: jest.Mock;
  set: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  incr: jest.Mock;
  expire: jest.Mock;
  zadd: jest.Mock;
  zcard: jest.Mock;
  zrange: jest.Mock;
  zremrangebyscore: jest.Mock;
} {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(0),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    zadd: jest.fn().mockResolvedValue(1),
    zcard: jest.fn().mockResolvedValue(0),
    zrange: jest.fn().mockResolvedValue([]),
    zremrangebyscore: jest.fn().mockResolvedValue(0),
  };
}

export function redisMockProvider() {
  return { provide: REDIS_CLIENT, useValue: createRedisMock() };
}
