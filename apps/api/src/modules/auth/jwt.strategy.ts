import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
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
  tokenVersion: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

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

    // Load user first so we have an authoritative tokenVersion to fall back
    // on when Redis is unreachable for the dedicated token-version key.
    const user = await this.loadUser(payload.sub);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.deletedAt !== null)
      throw new UnauthorizedException('Account has been deactivated');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');
    if (user.role !== payload.role)
      throw new UnauthorizedException('Stale role in token');

    // Token-version check. Redis is the hot path; on miss OR Redis outage
    // we fall through to the user's DB tokenVersion so a Redis hiccup can't
    // lock every admin out (mirrors the resilience pattern in auth.service.ts).
    let effectiveTv = user.tokenVersion;
    try {
      const raw = await this.redis.get(AUTH_TV_KEY(payload.sub));
      if (raw !== null) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) effectiveTv = parsed;
      }
    } catch (err) {
      this.logger.warn(
        `Redis unavailable for token-version check (sub=${payload.sub}): ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    if (payload.tv !== effectiveTv) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return { id: payload.sub, email: payload.email, role: user.role };
  }

  private async loadUser(userId: string): Promise<CachedUser | null> {
    const cacheKey = AUTH_USER_KEY(userId);

    let cached: string | null = null;
    try {
      cached = await this.redis.get(cacheKey);
    } catch (err) {
      this.logger.warn(
        `Redis unavailable for user cache read (sub=${userId}): ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached) as CachedUser;
        // Legacy cache entries (pre-tokenVersion) are treated as misses so
        // they get refreshed from DB on next request.
        if (
          typeof parsed.role === 'string' &&
          typeof parsed.tokenVersion === 'number'
        ) {
          return parsed;
        }
      } catch {
        // fall through and re-read from DB
      }
    }

    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        role: true,
        deletedAt: true,
        isActive: true,
        tokenVersion: true,
      },
    });
    const value: CachedUser = row
      ? {
          role: row.role,
          deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
          isActive: row.isActive,
          tokenVersion: row.tokenVersion,
        }
      : {
          role: '',
          deletedAt: new Date(0).toISOString(),
          isActive: false,
          tokenVersion: 0,
        };
    try {
      await this.redis.setex(
        cacheKey,
        AUTH_USER_TTL_SECONDS,
        JSON.stringify(value),
      );
    } catch (err) {
      this.logger.warn(
        `Redis unavailable for user cache backfill (sub=${userId}): ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    return row ? value : null;
  }
}
