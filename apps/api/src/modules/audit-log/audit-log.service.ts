import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface FindLogsOptions {
  readonly page: number;
  readonly limit: number;
  readonly entity?: string;
  readonly entityId?: string;
  readonly userId?: string;
}

const MAX_DETAILS_JSON_LENGTH = 16_384;
const TRUNCATED_SUFFIX = '…[truncated]';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // userId is nullable so events emitted by guest-checkout flows (no
  // authenticated actor) still leave an audit trail. Anonymous rows show
  // up in the admin audit log with a "guest" badge keyed off userId IS
  // NULL plus the order's guestEmail. See migration
  // 20260517150000_guest_checkout_support.
  async log(
    userId: string | null,
    action: string,
    entity: string,
    entityId?: string,
    details?: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        details: this.normalizeDetails(details),
      },
    });
  }

  async findAll(options: FindLogsOptions) {
    const { page, limit, entity, entityId, userId } = options;
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.AuditLogWhereInput = {
      ...(entity ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
      ...(userId ? { userId } : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page: safePage, limit: safeLimit };
  }

  /**
   * Serialize `details` into a storage-safe shape. Three concerns:
   *   1. Only plain JSON-serialisable values are accepted; functions, symbols,
   *      and circular references are normalised to a stub.
   *   2. The serialised JSON is capped at MAX_DETAILS_JSON_LENGTH bytes so a
   *      malicious caller cannot blow out storage with a huge blob.
   *   3. If the payload exceeds the cap we store it as a single truncated
   *      string field rather than silently losing information.
   */
  private normalizeDetails(
    details: Prisma.InputJsonValue | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.DbNull {
    if (details === undefined || details === null) {
      return Prisma.DbNull;
    }

    if (typeof details === 'function') {
      return { error: 'unserializable' };
    }

    let serialized: string;
    try {
      serialized = JSON.stringify(details);
    } catch {
      return { error: 'unserializable' };
    }

    if (!serialized) {
      return Prisma.DbNull;
    }

    if (serialized.length <= MAX_DETAILS_JSON_LENGTH) {
      return details;
    }

    const truncated =
      serialized.slice(0, MAX_DETAILS_JSON_LENGTH - TRUNCATED_SUFFIX.length) +
      TRUNCATED_SUFFIX;
    return { truncated: true, raw: truncated };
  }
}
