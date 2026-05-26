import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRedis } from '../redis/redis.decorator';
import type Redis from 'ioredis';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeAndValidate,
  prependPhoneToArray,
} from '../../common/phone.util';
import {
  UpdateProfileDto,
  CreateAddressDto,
  UpdateAddressDto,
  FitProfileDto,
  CreateCustomerByAdminDto,
} from './users.dto';
import { parseAndDedupeCsv } from './bulk-import.parser';

// Redis keys mirror auth.service constants — keep in sync.
const AUTH_TV_KEY = (userId: string) => `auth:tv:${userId}`;
const AUTH_USER_KEY = (userId: string) => `auth:user:${userId}`;
const AUTH_TV_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    @InjectRedis() private redis: Redis,
  ) {}

  /**
   * Admin-only customer creation.
   *
   * Three cases:
   *   1. Email is new → create a shadow record (no password, no email sent).
   *   2. Email belongs to a CLAIMED user → 409 Conflict.
   *   3. Email belongs to an existing SHADOW → fill-blanks update (no
   *      overwrite of non-empty fields). Phone array is dedup-prepended.
   *
   * The caller's admin id (`adminUserId`) is captured as `createdBy` on
   * new shadows. For fill-blanks updates we do not change createdBy.
   */
  async createCustomerAsAdmin(
    dto: CreateCustomerByAdminDto,
    adminUserId: string,
  ) {
    const email = dto.email.trim().toLowerCase();

    let normalizedPhone = '';
    if (dto.phone && dto.phone.trim()) {
      const phoneResult = normalizeAndValidate(dto.phone);
      if (!phoneResult.ok) {
        throw new BadRequestException(
          'Phone must be a valid Bangladesh number (10-11 digits)',
        );
      }
      normalizedPhone = phoneResult.phone;
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phones: true,
        claimedAt: true,
        deletedAt: true,
      },
    });

    if (existing) {
      if (existing.deletedAt !== null) {
        throw new ConflictException(
          'A user with this email previously existed and was deactivated',
        );
      }
      if (existing.claimedAt !== null) {
        throw new ConflictException('A user with this email already exists');
      }
      // Existing SHADOW: fill-blanks update.
      const updates: Prisma.UserUpdateInput = {};
      if (!existing.firstName && dto.firstName) updates.firstName = dto.firstName;
      if (!existing.lastName && dto.lastName) updates.lastName = dto.lastName;
      if (normalizedPhone) {
        const newPhones = prependPhoneToArray(existing.phones, normalizedPhone);
        if (
          newPhones.length !== existing.phones.length ||
          newPhones[0] !== existing.phones[0]
        ) {
          updates.phones = newPhones;
        }
      }
      if (Object.keys(updates).length === 0) {
        return existing;
      }
      return this.prisma.user.update({
        where: { id: existing.id },
        data: updates,
        select: this.publicUserSelect(),
      });
    }

    return this.prisma.user.create({
      data: {
        email,
        firstName: dto.firstName,
        lastName: dto.lastName ?? '',
        phones: normalizedPhone ? [normalizedPhone] : [],
        passwordHash: null,
        role: Role.CUSTOMER,
        isVerified: true,
        claimedAt: null,
        createdBy: adminUserId,
      },
      select: this.publicUserSelect(),
    });
  }

  private publicUserSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phones: true,
      role: true,
      isActive: true,
      isVerified: true,
      claimedAt: true,
      createdBy: true,
      createdAt: true,
    };
  }

  /**
   * Bulk-import shadow customers from a CSV buffer (field `file` via multer).
   *
   * Two-pass approach:
   *   1. Parse + dedupe the CSV in memory (via parseAndDedupeCsv).
   *   2. Query existing emails, filter them out, then insert in 100-row
   *      batches with skipDuplicates:true as a safety net.
   *
   * Returns a summary object rather than throwing on partial failures so the
   * caller always gets a machine-readable report.
   */
  async bulkImport(buffer: Buffer, adminUserId: string) {
    const parsed = await parseAndDedupeCsv(buffer);

    const emails = Array.from(parsed.rows.keys());
    const existing = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    const existingEmails = new Set(existing.map((u) => u.email));

    const toInsert = Array.from(parsed.rows.values())
      .filter((r) => !existingEmails.has(r.email))
      .map((r) => ({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        phones: r.phone ? [r.phone] : [],
        passwordHash: null,
        role: Role.CUSTOMER,
        isVerified: true,
        claimedAt: null,
        createdBy: adminUserId,
      }));

    let createdCount = 0;
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100);
      const result = await this.prisma.user.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      createdCount += result.count;
    }

    return {
      created: createdCount,
      skipped_existing: existingEmails.size,
      skipped_duplicate_within_upload: parsed.duplicates.length,
      errors: parsed.errors,
    };
  }

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
        phones: true,
        role: true,
        isVerified: true,
        claimedAt: true,
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
    const data: Prisma.UserUpdateInput = {
      firstName: dto.firstName,
      lastName: dto.lastName,
    };

    // Phone handling — dedup-prepend to phones[] if provided + valid.
    // Empty string / null clears phones[0] (preserves history).
    // undefined leaves phones unchanged.
    if (dto.phone !== undefined) {
      const current = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phones: true },
      });
      if (!current) throw new NotFoundException('User not found');

      if (dto.phone === '' || dto.phone === null) {
        // Remove the most-recent entry but keep history.
        data.phones = current.phones.slice(1);
      } else {
        const phoneResult = normalizeAndValidate(dto.phone);
        if (!phoneResult.ok) {
          throw new BadRequestException(
            'Phone must be a valid Bangladesh number (10-11 digits)',
          );
        }
        data.phones = prependPhoneToArray(current.phones, phoneResult.phone);
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phones: true,
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
