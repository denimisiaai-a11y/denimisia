import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, HomepageSectionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBannerDto,
  UpdateBannerDto,
  CreateHomepageSectionDto,
  UpdateHomepageSectionDto,
  ReorderHomepageSectionsDto,
  UpdateGlobalStylesDto,
} from './cms.dto';

const STYLES_SINGLETON_ID = 'singleton';
type AuditEntity = 'HomepageSectionInstance' | 'GlobalStorefrontStyles';

/**
 * Coerce ISO date strings in a banner DTO to Date instances Prisma can persist.
 * Leaves other fields untouched. Null passes through unchanged so the admin
 * can clear an existing date by sending `null`.
 */
function coerceBannerDates<T extends { startDate?: string | null; endDate?: string | null }>(
  dto: T,
): Omit<T, 'startDate' | 'endDate'> & { startDate?: Date | null; endDate?: Date | null } {
  const { startDate, endDate, ...rest } = dto;
  const out: Record<string, unknown> = { ...rest };
  if (startDate !== undefined) {
    out.startDate = startDate === null ? null : new Date(startDate);
  }
  if (endDate !== undefined) {
    out.endDate = endDate === null ? null : new Date(endDate);
  }
  return out as Omit<T, 'startDate' | 'endDate'> & {
    startDate?: Date | null;
    endDate?: Date | null;
  };
}

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  // ─── Homepage Section Composer ──────────────────────────────────────────────

  /** Admin: list every section (active + inactive), ordered. */
  async listAllSections() {
    return this.prisma.homepageSectionInstance.findMany({
      orderBy: { position: 'asc' },
    });
  }

  /** Storefront: list only active sections, ordered. Drives page.tsx. */
  async listActiveSections() {
    return this.prisma.homepageSectionInstance.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  async createSection(dto: CreateHomepageSectionDto, userId?: string) {
    // Default to "append to end" when position is omitted.
    const position =
      dto.position ??
      ((await this.prisma.homepageSectionInstance.count()) || 0);
    const created = await this.prisma.homepageSectionInstance.create({
      data: {
        type: dto.type,
        position,
        isActive: dto.isActive ?? true,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.audit(userId, 'cms.section.create', 'HomepageSectionInstance', created.id, {
      type: created.type,
      position: created.position,
    });
    return created;
  }

  async updateSection(id: string, dto: UpdateHomepageSectionDto, userId?: string) {
    const existing = await this.prisma.homepageSectionInstance.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Section not found');

    const data: Prisma.HomepageSectionInstanceUpdateInput = {};
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.config !== undefined) data.config = dto.config as Prisma.InputJsonValue;

    const updated = await this.prisma.homepageSectionInstance.update({
      where: { id },
      data,
    });
    await this.audit(userId, 'cms.section.update', 'HomepageSectionInstance', id, {
      type: updated.type,
      changes: dto,
    });
    return updated;
  }

  async deleteSection(id: string, userId?: string) {
    const existing = await this.prisma.homepageSectionInstance.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Section not found');
    await this.prisma.homepageSectionInstance.delete({ where: { id } });
    await this.audit(userId, 'cms.section.delete', 'HomepageSectionInstance', id, {
      type: existing.type,
    });
  }

  /**
   * Bulk-reorder. Uses a transaction so a partial update can't leave the list
   * in a half-reordered state visible to readers.
   */
  async reorderSections(dto: ReorderHomepageSectionsDto, userId?: string) {
    const updates = dto.orders.map((o) =>
      this.prisma.homepageSectionInstance.update({
        where: { id: o.id },
        data: { position: o.position },
      }),
    );
    const updated = await this.prisma.$transaction(updates);
    await this.audit(userId, 'cms.section.reorder', 'HomepageSectionInstance', null, {
      orderedIds: dto.orders.map((o) => o.id),
    });
    return updated;
  }

  // ─── Global Storefront Styles ───────────────────────────────────────────────

  /** Storefront-readable. Always returns the singleton (creating it on demand). */
  async getStyles() {
    return this.prisma.globalStorefrontStyles.upsert({
      where: { id: STYLES_SINGLETON_ID },
      create: { id: STYLES_SINGLETON_ID },
      update: {},
    });
  }

  async updateStyles(dto: UpdateGlobalStylesDto, userId?: string) {
    const updated = await this.prisma.globalStorefrontStyles.upsert({
      where: { id: STYLES_SINGLETON_ID },
      create: {
        id: STYLES_SINGLETON_ID,
        negativeSpace: dto.negativeSpace ?? 1,
        typographyFlow: dto.typographyFlow ?? 1,
      },
      update: {
        ...(dto.negativeSpace !== undefined && { negativeSpace: dto.negativeSpace }),
        ...(dto.typographyFlow !== undefined && { typographyFlow: dto.typographyFlow }),
      },
    });
    await this.audit(userId, 'cms.styles.update', 'GlobalStorefrontStyles', updated.id, { ...dto });
    return updated;
  }

  // ─── Banners (unchanged from before) ────────────────────────────────────────

  async listActiveBanners() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBanner(dto: CreateBannerDto) {
    return this.prisma.banner.create({ data: coerceBannerDates(dto) });
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return this.prisma.banner.update({ where: { id }, data: coerceBannerDates(dto) });
  }

  async deleteBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    await this.prisma.banner.delete({ where: { id } });
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private async audit(
    userId: string | undefined,
    action: string,
    entity: AuditEntity,
    entityId: string | null,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action,
          entity,
          entityId,
          details: details as Prisma.InputJsonValue,
        },
      });
    } catch {
      // AuditLog writes must never block the operation that triggered them.
      // A swallowed audit miss is preferable to a 500 on a working PATCH.
    }
  }
}
