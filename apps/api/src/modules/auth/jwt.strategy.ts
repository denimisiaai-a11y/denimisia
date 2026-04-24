import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '../redis/redis.decorator';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUTH_TV_KEY,
  AUTH_USER_KEY,
  AUTH_USER_TTL_SECONDS,
} from './auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tv: number;
}

interface CachedUser {
  role: string;
  deletedAt: string | null;
  isActive: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
      issuer: 'denimisia-api',
      audience: 'denimisia-clients',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) throw new UnauthorizedException();

    // 1) Token-version check — cheap Redis GET, rejects invalidated tokens.
    const currentTvRaw = await this.redis.get(AUTH_TV_KEY(payload.sub));
    const currentTv = currentTvRaw === null ? 0 : Number.parseInt(currentTvRaw, 10);
    if (!Number.isFinite(currentTv) || payload.tv !== currentTv) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // 2) Short-circuit user lookup, cached for 60s.
    const user = await this.loadUser(payload.sub);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.deletedAt !== null) throw new UnauthorizedException('Account has been deactivated');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');
    if (user.role !== payload.role) throw new UnauthorizedException('Stale role in token');

    return { id: payload.sub, email: payload.email, role: user.role };
  }

  private async loadUser(userId: string): Promise<CachedUser | null> {
    const cacheKey = AUTH_USER_KEY(userId);
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached) as CachedUser;
        if (typeof parsed.role === 'string') return parsed;
      } catch {
        // fall through and re-read from DB
      }
    }

    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true, deletedAt: true, isActive: true },
    });
    const value: CachedUser = row
      ? {
          role: row.role,
          deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
          isActive: row.isActive,
        }
      : { role: '', deletedAt: new Date(0).toISOString(), isActive: false };
    await this.redis.setex(cacheKey, AUTH_USER_TTL_SECONDS, JSON.stringify(value));
    return row ? value : null;
  }
}
