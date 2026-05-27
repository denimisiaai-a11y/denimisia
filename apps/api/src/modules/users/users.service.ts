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
import * as bcrypt from 'bcrypt';
import {
  UpdateProfileDto,
  CreateAddressDto,
  UpdateAddressDto,
  FitProfileDto,
  CreateCustomerByAdminDto,
  AdminUpdateUserDto,
  CreateStaffDto,
} from './users.dto';
import { parseAndDedupeCsv } from './bulk-import.parser';
import { AuditLogService } from '../audit-log/audit-log.service';

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
    private auditLog: AuditLogService,
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
    return this._bulkImport(buffer, adminUserId);
  }

  /**
   * SUPER_ADMIN-only staff creation. Hashes the starter password, marks the
   * account claimed + verified + active so they can log in immediately, and
   * writes an AuditLog row with the role + permissions snapshot.
   *
   * Rejects emails that already belong to ANY account (customer or staff) —
   * the same email cannot be both a customer and a staff member.
   */
  async createStaff(dto: CreateStaffDto, adminUserId: string) {
    if (dto.password.length < 12) {
      throw new BadRequestException(
        'Password must be at least 12 characters',
      );
    }
    const emailLower = dto.email.trim().toLowerCase();
    const collision = await this.prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true, deletedAt: true },
    });
    if (collision && collision.deletedAt === null) {
      throw new ConflictException('An account with this email already exists');
    }

    const hash = await bcrypt.hash(dto.password, 12);
    const created = await this.prisma.user.create({
      data: {
        email: emailLower,
        firstName: dto.firstName,
        lastName: dto.lastName ?? '',
        passwordHash: hash,
        role: dto.role as Role,
        permissions: dto.permissions ?? [],
        isVerified: true,
        isActive: true,
        claimedAt: new Date(),
        createdBy: adminUserId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        permissions: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.auditLog.log(
      adminUserId,
      'admin.staff.create',
      'User',
      created.id,
      {
        email: created.email,
        role: created.role,
        permissionsCount: created.permissions.length,
      } as Prisma.InputJsonValue,
    );
    return created;
  }

  private async _bulkImport(buffer: Buffer, adminUserId: string) {
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
        // Permissions are surfaced here so NextAuth (admin app) can stash
        // them on the session right after credentials login and use them
        // to drive sidebar visibility.
        permissions: true,
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
          phones: true,
          role: true,
          isVerified: true,
          claimedAt: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Compute lifetime-value (sum of all Order totals) in a second query so
    // the admin Customers page can show Total Contribution per row. groupBy
    // over the paginated slice's user IDs keeps the cost bounded to one
    // extra round-trip per page.
    const userIds = users.map((u) => u.id);
    const aggregates = userIds.length
      ? await this.prisma.order.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds } },
          _sum: { total: true },
        })
      : [];
    const totalSpentByUser = new Map(
      aggregates.map((a) => [a.userId, Number(a._sum.total ?? 0)]),
    );

    const enrichedUsers = users.map(({ _count, ...rest }) => ({
      ...rest,
      totalOrders: _count.orders,
      totalSpent: totalSpentByUser.get(rest.id) ?? 0,
    }));

    return { users: enrichedUsers, total, page, limit };
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
        phones: true,
        role: true,
        isVerified: true,
        claimedAt: true,
        createdAt: true,
        addresses: true,
        // Recent orders for the admin customer-detail page. Capped at 50
        // most-recent to bound payload; pagination is a follow-up if needed.
        // Includes legacy-imported orders (orderNumber LIKE 'LEGACY-%').
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            _count: { select: { items: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { orders: true, reviews: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Compute lifetime-value alongside the embedded recent orders. groupBy
    // against the same userId returns the full sum even if `orders` was
    // capped at 50.
    const agg = await this.prisma.order.aggregate({
      where: { userId },
      _sum: { total: true },
    });
    const totalSpent = Number(agg._sum.total ?? 0);

    return { ...user, totalSpent };
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

  // ─── Admin profile + address edits ───────────────────────────────────────

  /**
   * Admin edits a customer's name, email, or phone. Three security rules:
   *   1. Email must not collide with another user (incl. soft-deleted —
   *      Prisma's unique constraint on email doesn't honour deletedAt).
   *   2. If the user is CLAIMED and email changes, bump tokenVersion to
   *      force re-login. Same rationale as a password reset — staff
   *      shouldn't be able to silently take over a session.
   *   3. Role / isActive / passwordHash are never touched (explicit
   *      allow-list, no spread).
   * Every successful edit writes an AuditLog row keyed to the admin actor.
   */
  async adminUpdateUser(
    targetUserId: string,
    adminUserId: string,
    dto: AdminUpdateUserDto,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phones: true,
        role: true,
        permissions: true,
        claimedAt: true,
        deletedAt: true,
      },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException('User not found');
    }

    // Role + permission changes are SUPER_ADMIN-only. Anyone else trying
    // to escalate themselves or a peer gets a 403 here regardless of the
    // RolesGuard on the controller.
    if (dto.role !== undefined || dto.permissions !== undefined) {
      const actor = await this.prisma.user.findUnique({
        where: { id: adminUserId },
        select: { role: true },
      });
      if (actor?.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Only SUPER_ADMIN can change role or permissions',
        );
      }
    }

    const data: Prisma.UserUpdateInput = {};
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    if (dto.role !== undefined && dto.role !== existing.role) {
      data.role = dto.role as Role;
      changed.role = { from: existing.role, to: dto.role };
      // Role transitions invalidate any outstanding JWTs for this user
      // (their token still carries the old role; jwt.strategy rejects the
      // mismatch but we also force a fresh login via tokenVersion bump).
      data.tokenVersion = { increment: 1 };
    }

    if (dto.permissions !== undefined) {
      const next = [...dto.permissions].sort();
      const current = [...existing.permissions].sort();
      const same =
        next.length === current.length &&
        next.every((p, i) => p === current[i]);
      if (!same) {
        data.permissions = dto.permissions;
        changed.permissions = {
          from: existing.permissions,
          to: dto.permissions,
        };
      }
    }

    if (dto.firstName !== undefined && dto.firstName !== existing.firstName) {
      data.firstName = dto.firstName;
      changed.firstName = { from: existing.firstName, to: dto.firstName };
    }
    if (dto.lastName !== undefined && (dto.lastName ?? null) !== existing.lastName) {
      data.lastName = dto.lastName ?? null;
      changed.lastName = { from: existing.lastName, to: dto.lastName ?? null };
    }

    if (dto.email !== undefined && dto.email !== existing.email) {
      const lowerEmail = dto.email.toLowerCase();
      const collision = await this.prisma.user.findFirst({
        where: { email: lowerEmail, id: { not: targetUserId } },
        select: { id: true },
      });
      if (collision) {
        throw new ConflictException('Email already in use by another account');
      }
      data.email = lowerEmail;
      changed.email = { from: existing.email, to: lowerEmail };
    }

    if (dto.phone !== undefined && dto.phone !== '') {
      const phoneResult = normalizeAndValidate(dto.phone);
      if (!phoneResult.ok) {
        throw new BadRequestException(
          'Phone must be a valid Bangladesh number (10-11 digits)',
        );
      }
      const nextPhones = prependPhoneToArray(existing.phones, phoneResult.phone);
      // Only mark as changed if phones[0] actually moved.
      if (nextPhones[0] !== existing.phones[0]) {
        data.phones = nextPhones;
        changed.phone = { from: existing.phones[0] ?? null, to: nextPhones[0] };
      }
    }

    // Email change on a claimed account → force re-login. Role change does
    // the same — a stale JWT still claims the old role, jwt.strategy
    // currently rejects mismatches but we also bump tokenVersion so the
    // session ends immediately.
    const shouldBumpTv =
      (changed.email && existing.claimedAt !== null) || changed.role;
    if (shouldBumpTv) {
      data.tokenVersion = { increment: 1 };
      await this.bumpTokenVersion(targetUserId);
    }

    if (Object.keys(changed).length === 0) {
      // No-op edit — return the row as-is so the UI can refresh without a
      // misleading "updated" toast.
      return this.getUserById(targetUserId);
    }

    await this.prisma.user.update({ where: { id: targetUserId }, data });
    await this.auditLog.log(
      adminUserId,
      'admin.user.update',
      'User',
      targetUserId,
      changed as Prisma.InputJsonValue,
    );
    return this.getUserById(targetUserId);
  }

  /**
   * Admin creates an address on behalf of a customer. Mirrors the self-serve
   * createAddress path but logs the admin actor for the audit trail.
   */
  async adminCreateAddress(
    targetUserId: string,
    adminUserId: string,
    dto: CreateAddressDto,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, deletedAt: true },
    });
    if (!target || target.deletedAt !== null) {
      throw new NotFoundException('User not found');
    }
    const created = await this.createAddress(targetUserId, dto);
    await this.auditLog.log(
      adminUserId,
      'admin.address.create',
      'Address',
      created.id,
      { userId: targetUserId } as Prisma.InputJsonValue,
    );
    return created;
  }

  async adminUpdateAddress(
    targetUserId: string,
    addressId: string,
    adminUserId: string,
    dto: UpdateAddressDto,
  ) {
    const updated = await this.updateAddress(targetUserId, addressId, dto);
    await this.auditLog.log(
      adminUserId,
      'admin.address.update',
      'Address',
      addressId,
      { userId: targetUserId } as Prisma.InputJsonValue,
    );
    return updated;
  }

  async adminDeleteAddress(
    targetUserId: string,
    addressId: string,
    adminUserId: string,
  ) {
    await this.deleteAddress(targetUserId, addressId);
    await this.auditLog.log(
      adminUserId,
      'admin.address.delete',
      'Address',
      addressId,
      { userId: targetUserId } as Prisma.InputJsonValue,
    );
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
