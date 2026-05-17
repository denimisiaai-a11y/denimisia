import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { InjectRedis } from '../redis/redis.decorator';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUTH_TV_KEY,
  AUTH_USER_KEY,
  AUTH_USER_TTL_SECONDS,
} from './auth.service';

export interface RefreshPayload {
  sub: string;
  email: string;
  role: string;
  tv: number;
}

interface CachedUser {
  role: string;
  deletedAt: string | null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
    super({
      jwtFromRequest: (req: Request) => req?.cookies?.refresh_token ?? null,
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
      algorithms: ['HS256'],
      issuer: 'denimisia-api',
      audience: 'denimisia-clients',
    });
  }

  async validate(req: Request, payload: RefreshPayload) {
    if (!payload.sub) throw new UnauthorizedException();
    const refreshToken = req?.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException();

    // Token-version check (see jwt.strategy.ts for rationale).
    const currentTvRaw = await this.redis.get(AUTH_TV_KEY(payload.sub));
    const currentTv =
      currentTvRaw === null ? 0 : Number.parseInt(currentTvRaw, 10);
    if (!Number.isFinite(currentTv) || payload.tv !== currentTv) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.loadUser(payload.sub);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.deletedAt !== null)
      throw new UnauthorizedException('Account has been deactivated');
    if (user.role !== payload.role)
      throw new UnauthorizedException('Stale role in token');

    return {
      id: payload.sub,
      email: payload.email,
      role: user.role,
      refreshToken,
    };
  }

  private async loadUser(userId: string): Promise<CachedUser | null> {
    const cacheKey = AUTH_USER_KEY(userId);
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached) as CachedUser;
        if (typeof parsed.role === 'string') return parsed;
      } catch {
        // fall through
      }
    }

    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true, deletedAt: true },
    });
    const value: CachedUser = row
      ? {
          role: row.role,
          deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
        }
      : { role: '', deletedAt: new Date(0).toISOString() };
    await this.redis.setex(
      cacheKey,
      AUTH_USER_TTL_SECONDS,
      JSON.stringify(value),
    );
    return row ? value : null;
  }
}
