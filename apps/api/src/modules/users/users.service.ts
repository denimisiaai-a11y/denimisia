import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRedis } from '../redis/redis.decorator';
import type Redis from 'ioredis';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateProfileDto,
  CreateAddressDto,
  UpdateAddressDto,
  FitProfileDto,
} from './users.dto';

// Redis keys mirror auth.service constants — keep in sync.
const AUTH_TV_KEY = (userId: string) => `auth:tv:${userId}`;
const AUTH_USER_KEY = (userId: string) => `auth:user:${userId}`;
const AUTH_TV_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @InjectRedis() private redis: Redis,
  ) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    // findFirst + deletedAt:null — soft-deleted users must 404 when viewing
    // their "own" profile via a still-valid token.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * findById used by auth strategies. Filters soft-deleted accounts.
   * Returns the minimal shape the JWT strategies need to validate a session.
   */
  async findById(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        deletedAt: true,
      },
    });
  }

  /**
   * Invalidate every access + refresh token issued for this user.
   * Called on role change, deactivation, password reset, or admin revoke.
   * TODO(schema): persist `tokenVersion` on the User row once the column is
   * added to packages/database/prisma/schema.prisma. Until then the value
   * lives in Redis with a 30-day TTL.
   */
  async bumpTokenVersion(userId: string): Promise<number> {
    const next = await this.redis.incr(AUTH_TV_KEY(userId));
    await this.redis.expire(AUTH_TV_KEY(userId), AUTH_TV_TTL_SECONDS);
    await this.redis.del(AUTH_USER_KEY(userId));
    return next;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Explicit allow-list — never spread the DTO to prevent mass assignment
    // (e.g. role, isVerified, email, passwordHash).
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
      },
    });
  }

  // ─── Addresses ────────────────────────────────────────────────────────────

  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { label: 'asc' }],
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.create({
      data: { ...dto, userId },
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    await this.verifyAddressOwner(userId, addressId);
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.update({
      where: { id: addressId },
      data: { ...dto },
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.verifyAddressOwner(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
  }

  // ─── Fit profile ─────────────────────────────────────────────────────────

  /**
   * Merge one product-type sub-profile into User.fitProfile. The column is a
   * single JSON object keyed by lowercased type (`shirts`, `pants`,
   * `jackets`), so saving SHIRTS leaves the user's PANTS sub-profile
   * untouched. Each sub-profile carries its own `fitPref` + `updatedAt`
   * timestamp.
   */
  async saveFitProfile(userId: string, payload: FitProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fitProfile: true },
    });
    const existing =
      (user?.fitProfile as Prisma.JsonObject | null | undefined) ?? {};
    const updated: Prisma.InputJsonValue = {
      ...existing,
      [payload.type.toLowerCase()]: {
        ...payload.measurements,
        fitPref: payload.fitPref,
        updatedAt: new Date().toISOString(),
      },
    };
    return this.prisma.user.update({
      where: { id: userId },
      data: { fitProfile: updated },
      select: { fitProfile: true },
    });
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async getAllUsers(page: number, limit: number) {
    const skip = (page - 1) * limit;
    // Filter soft-deleted users so the list view matches getUserById's
    // behaviour. Without this, the admin could see + click into a row
    // that 404s on detail — a UX trap. A future admin "show deleted"
    // toggle would be its own endpoint.
    const where = { deletedAt: null };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total, page, limit };
  }

  async getUserById(userId: string) {
    // findFirst + deletedAt:null — admin-side lookups must also hide
    // soft-deleted users to keep the view consistent with auth behaviour.
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isVerified: true,
        createdAt: true,
        addresses: true,
        _count: { select: { orders: true, reviews: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deactivateUser(userId: string) {
    // TODO(schema): add `isActive Boolean @default(true)` and
    // `tokenVersion Int @default(0)` to the User model in
    // packages/database/prisma/schema.prisma. Then set
    // { isActive: false, isVerified: false } here and persist
    // tokenVersion instead of relying on Redis-only storage.
    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: false },
    });
    // Invalidate all outstanding JWTs issued to this user so the
    // deactivated account cannot continue making authenticated requests.
    await this.bumpTokenVersion(userId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async verifyAddressOwner(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });
    if (!address) throw new NotFoundException('Address not found');
    if (address.userId !== userId) throw new ForbiddenException();
  }
}
