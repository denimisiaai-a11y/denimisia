import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '../redis/redis.decorator';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RegisterDto, LoginDto } from './auth.dto';
import { env, isProd } from '../../common/env';

const JWT_ISSUER = 'denimisia-api';
const JWT_AUDIENCE = 'denimisia-clients';
const JWT_ALGORITHM = 'HS256' as const;

// Redis key prefixes for token-version / cached user lookup.
// Kept here so strategies can import from a single source of truth.
export const AUTH_TV_KEY = (userId: string) => `auth:tv:${userId}`;
export const AUTH_USER_KEY = (userId: string) => `auth:user:${userId}`;
// Token-version entry lives for 30 days (longer than refresh TTL so bumps persist).
export const AUTH_TV_TTL_SECONDS = 30 * 24 * 60 * 60;
// Cached {role, deletedAt} lookup — 60s bounds DB load to ~1 read/user/min.
export const AUTH_USER_TTL_SECONDS = 60;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tv: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    @InjectRedis() private redis: Redis,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Fire-and-forget audit write. Auth succeeds regardless of whether the
   * audit insert makes it to the DB — an unreachable audit table must not
   * brick login. We log the failure via the nest logger and move on.
   */
  private async emitAudit(
    userId: string,
    action: string,
    details?: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.auditLog.log(userId, action, 'User', userId, details);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `emitAudit failed (action=${action}, userId=${userId}): ${message}`,
      );
    }
  }

  async register(dto: RegisterDto) {
    // findFirst + deletedAt:null — ensures soft-deleted accounts can't be
    // re-registered and hides them from existence checks.
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    const tv = await this.getOrInitTokenVersion(user.id);
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      tv,
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    await this.emitAudit(user.id, 'USER_REGISTER', {
      email: user.email,
      role: user.role,
    });
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async login(dto: LoginDto) {
    // findFirst + deletedAt:null — critical: soft-deleted users must not auth.
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw new UnauthorizedException('Invalid credentials');

    const tv = await this.getOrInitTokenVersion(user.id);
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      tv,
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    await this.emitAudit(user.id, 'USER_LOGIN', { email: user.email });
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async logout(userId: string) {
    await this.redis.del(`refresh:${userId}`);
    await this.emitAudit(userId, 'USER_LOGOUT');
  }

  async refreshTokens(
    userId: string,
    email: string,
    role: string,
    refreshToken: string,
  ) {
    const stored = await this.redis.get(`refresh:${userId}`);
    if (!stored) throw new UnauthorizedException('Session expired');

    const tokenMatch = await bcrypt.compare(refreshToken, stored);
    if (!tokenMatch) throw new UnauthorizedException('Invalid refresh token');

    // Re-check the account is still active before minting new tokens.
    // findFirst + deletedAt:null — soft-deleted accounts cannot refresh.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');

    const tv = await this.getOrInitTokenVersion(userId);
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      tv,
    );
    await this.storeRefreshToken(userId, tokens.refreshToken);
    return tokens;
  }

  /**
   * Read the token version for a user. Redis is the hot path; on miss we
   * fall through to the authoritative DB column and backfill the cache.
   */
  async getOrInitTokenVersion(userId: string): Promise<number> {
    const key = AUTH_TV_KEY(userId);
    const current = await this.redis.get(key);
    if (current !== null) {
      const parsed = Number.parseInt(current, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { tokenVersion: true },
    });
    const tv = row?.tokenVersion ?? 0;
    await this.redis.setex(key, AUTH_TV_TTL_SECONDS, String(tv));
    return tv;
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    tv: number,
  ) {
    const payload: JwtPayload = { sub: userId, email, role, tv };
    // Cast through unknown: jsonwebtoken types use the ms-lib `StringValue`
    // template literal for `expiresIn`, which our env strings satisfy at runtime.
    const accessExpiresIn = env.JWT_ACCESS_EXPIRY as unknown as number;
    const refreshExpiresIn = env.JWT_REFRESH_EXPIRY as unknown as number;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: env.JWT_ACCESS_SECRET,
        algorithm: JWT_ALGORITHM,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: accessExpiresIn,
      }),
      this.jwt.signAsync(payload, {
        secret: env.JWT_REFRESH_SECRET,
        algorithm: JWT_ALGORITHM,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
    await this.redis.setex(`refresh:${userId}`, ttl, hash);
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────

  async forgotPassword(email: string) {
    // findFirst + deletedAt:null — soft-deleted users must not receive
    // reset tokens (would let an attacker re-claim the account).
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    // Always return success to prevent email enumeration
    if (!user)
      return { message: 'If an account exists, a reset link has been sent' };

    // 256-bit opaque token — raw UUIDs only have ~122 bits of entropy.
    const token = randomBytes(32).toString('hex');
    await this.redis.setex(`reset:${token}`, 3600, user.id);

    // TODO: Send email with reset link (blocked on email provider decision)
    if (!isProd()) {
      this.logger.debug(
        `Password reset token generated (email=${email}, tokenLen=${token.length})`,
      );
    }

    return { message: 'If an account exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = await this.redis.get(`reset:${token}`);
    if (!userId)
      throw new UnauthorizedException('Invalid or expired reset token');

    // Confirm the account is still active. findFirst + deletedAt:null prevents
    // password resets on soft-deleted accounts.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user)
      throw new UnauthorizedException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.redis.del(`reset:${token}`);
    await this.redis.del(`refresh:${userId}`);
    // Invalidate all outstanding access tokens for this user.
    await this.bumpTokenVersion(userId);
    await this.emitAudit(userId, 'PASSWORD_RESET');

    return { message: 'Password has been reset successfully' };
  }

  /**
   * Atomically bump the token version for a user. Writes to the User row
   * (source of truth) and mirrors to Redis for the hot path. Any JWT minted
   * with the old version will be rejected by the strategies. Also clears the
   * cached {role, deletedAt} entry so strategies re-read.
   */
  async bumpTokenVersion(userId: string): Promise<number> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    const next = updated.tokenVersion;
    const key = AUTH_TV_KEY(userId);
    await this.redis.setex(key, AUTH_TV_TTL_SECONDS, String(next));
    await this.redis.del(AUTH_USER_KEY(userId));
    return next;
  }

  // ─── Email Verification ───────────────────────────────────────────────────────

  async requestEmailVerification(userId: string) {
    // findFirst + deletedAt:null — soft-deleted accounts cannot request
    // verification tokens.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    // 256-bit opaque token — raw UUIDs only have ~122 bits of entropy.
    const token = randomBytes(32).toString('hex');
    await this.redis.setex(`verify:${token}`, 86400, userId);

    if (!isProd()) {
      this.logger.debug(
        `Email verification token generated (email=${user.email}, tokenLen=${token.length})`,
      );
    }

    return { message: 'Verification email sent' };
  }

  async verifyEmail(token: string) {
    const userId = await this.redis.get(`verify:${token}`);
    if (!userId)
      throw new UnauthorizedException('Invalid or expired verification token');

    // Confirm the account is still active before marking it verified.
    // findFirst + deletedAt:null — soft-deleted accounts must not be verified.
    // Also pull the email so the C2 guest-order attach below can find any
    // anonymous orders the customer placed before signing up.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!user)
      throw new UnauthorizedException('Invalid or expired verification token');

    // LR-001 amendment C2: attach any prior guest-checkout orders to this
    // newly-verified account. The attach happens IN THE SAME TRANSACTION
    // as the verification flip so a customer cannot inherit orders without
    // proving they own the inbox (which is the whole point of the
    // verification step).
    const attachedOrders = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isVerified: true },
      });

      const result = await tx.order.updateMany({
        where: {
          guestEmail: user.email,
          userId: null,
          deletedAt: null,
        },
        data: {
          userId: user.id,
          guestEmail: null,
          guestName: null,
          guestPhone: null,
        },
      });
      return result.count;
    });

    await this.redis.del(`verify:${token}`);
    await this.emitAudit(userId, 'EMAIL_VERIFIED');
    if (attachedOrders > 0) {
      await this.emitAudit(userId, 'GUEST_ORDERS_ATTACHED', {
        count: attachedOrders,
      });
    }
    return {
      message: 'Email verified successfully',
      attachedOrders,
    };
  }
}
