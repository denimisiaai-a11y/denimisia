import { UnauthorizedException } from '@nestjs/common';
import {
  JwtRefreshStrategy,
  type RefreshPayload,
} from './jwt-refresh.strategy';

jest.mock('passport-jwt', () => ({
  Strategy: jest.fn(),
}));

function makeDeps(
  opts: {
    secret?: string;
    tv?: string | null;
    dbUser?: { role: string; deletedAt: Date | null } | null;
  } = {},
): { config: any; prisma: any; redis: any } {
  const config = {
    get: () => opts.secret ?? 'test-secret-32chars-minimum-12345',
  };
  const redis = {
    get: jest.fn((key: string) => {
      if (key.startsWith('auth:tv:')) return Promise.resolve(opts.tv ?? '0');
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

describe('JwtRefreshStrategy', () => {
  it('throws if JWT_REFRESH_SECRET is missing', () => {
    const { prisma, redis } = makeDeps();
    const config = { get: () => undefined };
    expect(() => new JwtRefreshStrategy(config as any, prisma, redis)).toThrow(
      'JWT_REFRESH_SECRET is not configured',
    );
  });

  it('validates and returns user with refreshToken', async () => {
    const { config, prisma, redis } = makeDeps({
      tv: '4',
      dbUser: { role: 'CUSTOMER', deletedAt: null },
    });
    const strategy = new JwtRefreshStrategy(config, prisma, redis);
    const req = { cookies: { refresh_token: 'rt-123' } } as any;
    const payload: RefreshPayload = {
      sub: 'user-1',
      email: 'a@b.com',
      role: 'CUSTOMER',
      tv: 4,
    };
    const result = await strategy.validate(req, payload);
    expect(result).toEqual({
      id: 'user-1',
      email: 'a@b.com',
      role: 'CUSTOMER',
      refreshToken: 'rt-123',
    });
  });

  it('rejects when sub is missing', async () => {
    const { config, prisma, redis } = makeDeps();
    const strategy = new JwtRefreshStrategy(config, prisma, redis);
    const req = { cookies: { refresh_token: 'rt-123' } } as any;
    const payload = {
      sub: '',
      email: 'a@b.com',
      role: 'CUSTOMER',
      tv: 0,
    } as RefreshPayload;
    await expect(strategy.validate(req, payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
