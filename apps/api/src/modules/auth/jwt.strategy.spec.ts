import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, type JwtPayload } from './jwt.strategy';

jest.mock('passport-jwt', () => ({
  Strategy: jest.fn(),
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: jest.fn(() => jest.fn()),
  },
}));

function makeDeps(
  opts: {
    secret?: string;
    tv?: string | null;
    cachedUser?: string | null;
    dbUser?: {
      role: string;
      deletedAt: Date | null;
      isActive?: boolean;
    } | null;
  } = {},
): { config: any; prisma: any; redis: any } {
  const config = {
    get: () => opts.secret ?? 'test-secret-32chars-minimum-12345',
  };
  const redis = {
    get: jest.fn((key: string) => {
      if (key.startsWith('auth:tv:')) return Promise.resolve(opts.tv ?? '0');
      if (key.startsWith('auth:user:'))
        return Promise.resolve(opts.cachedUser ?? null);
      return Promise.resolve(null);
    }),
    set: jest.fn(() => Promise.resolve('OK')),
    setex: jest.fn(() => Promise.resolve('OK')),
  };
  const prisma = {
    user: {
      findFirst: jest.fn(() => Promise.resolve(opts.dbUser ?? null)),
    },
  };
  return { config, prisma, redis };
}

describe('JwtStrategy', () => {
  it('throws if JWT_ACCESS_SECRET is missing', () => {
    const { prisma, redis } = makeDeps();
    const config = { get: () => undefined };
    expect(() => new JwtStrategy(config as any, prisma, redis)).toThrow(
      'JWT_ACCESS_SECRET is not configured',
    );
  });

  it('returns user when token version matches and user is active', async () => {
    const { config, prisma, redis } = makeDeps({
      tv: '7',
      dbUser: { role: 'CUSTOMER', deletedAt: null, isActive: true },
    });
    const strategy = new JwtStrategy(config, prisma, redis);
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'a@b.com',
      role: 'CUSTOMER',
      tv: 7,
    };
    const result = await strategy.validate(payload);
    expect(result).toEqual({
      id: 'user-1',
      email: 'a@b.com',
      role: 'CUSTOMER',
    });
  });

  it('rejects when token version is stale', async () => {
    const { config, prisma, redis } = makeDeps({
      tv: '9',
      dbUser: { role: 'CUSTOMER', deletedAt: null, isActive: true },
    });
    const strategy = new JwtStrategy(config, prisma, redis);
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'a@b.com',
      role: 'CUSTOMER',
      tv: 3,
    };
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when user is soft-deleted', async () => {
    const { config, prisma, redis } = makeDeps({
      tv: '0',
      dbUser: { role: 'CUSTOMER', deletedAt: new Date() },
    });
    const strategy = new JwtStrategy(config, prisma, redis);
    const payload: JwtPayload = {
      sub: 'user-1',
      email: 'a@b.com',
      role: 'CUSTOMER',
      tv: 0,
    };
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when sub is missing', async () => {
    const { config, prisma, redis } = makeDeps();
    const strategy = new JwtStrategy(config, prisma, redis);
    const payload = {
      sub: '',
      email: 'a@b.com',
      role: 'CUSTOMER',
      tv: 0,
    } as JwtPayload;
    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
