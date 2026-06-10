import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryType, Prisma } from '@prisma/client';

export interface ListVariantsOpts {
  page?: number;
  limit?: number;
  search?: string;
  bucket?: 'all' | 'out' | 'low' | 'healthy';
}

export class AdjustStockDto {
  variantId: string;
  quantity: number;
  type: InventoryType;
  note?: string;
}

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async getLowStockVariants(threshold = 5) {
    return this.prisma.productVariant.findMany({
      where: {
        stock: { lte: threshold },
        deletedAt: null,
        product: { isActive: true, deletedAt: null },
      },
      include: {
        // Admin inventory page falls back to product.images[0] when the
        // variant has no images of its own — selecting images here keeps
        // the row renderable instead of crashing on undefined.
        product: { select: { id: true, name: true, slug: true, images: true } },
      },
      orderBy: { stock: 'asc' },
    });
  }

  async getVariantLogs(variantId: string, page = 1, limit = 20) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.inventoryLog.findMany({
        where: { variantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryLog.count({ where: { variantId } }),
    ]);
    return { logs, total, page, limit };
  }

  /**
   * Adjust variant stock atomically. Uses a single conditional `updateMany`
   * with a guard on the current stock level so two concurrent requests cannot
   * both observe sufficient stock and each decrement past zero (overselling
   * race). For increments we use `update` directly because the invariant is
   * unconditional. The inventory log is written only after the stock mutation
   * succeeds so the audit trail never records a phantom movement.
   */
  async adjustStock(dto: AdjustStockDto) {
    if (dto.quantity === 0) {
      throw new BadRequestException('Quantity must be non-zero');
    }

    if (dto.quantity > 0) {
      const result = await this.prisma.productVariant.updateMany({
        where: { id: dto.variantId },
        data: { stock: { increment: dto.quantity } },
      });
      if (result.count === 0) {
        throw new NotFoundException('Variant not found');
      }
    } else {
      const decrementBy = -dto.quantity;
      const result = await this.prisma.productVariant.updateMany({
        where: { id: dto.variantId, stock: { gte: decrementBy } },
        data: { stock: { decrement: decrementBy } },
      });
      if (result.count === 0) {
        const exists = await this.prisma.productVariant.findUnique({
          where: { id: dto.variantId },
          select: { id: true },
        });
        if (!exists) {
          throw new NotFoundException('Variant not found');
        }
        throw new ConflictException('Insufficient stock');
      }
    }

    await this.prisma.inventoryLog.create({
      data: {
        variantId: dto.variantId,
        type: dto.type,
        quantity: dto.quantity,
        note: dto.note,
      },
    });

    const updatedVariant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
    });
    if (!updatedVariant) throw new NotFoundException('Variant not found');
    return updatedVariant;
  }

  async getInventorySummary() {
    // Soft-deleted variants/products are excluded so the dashboard
    // numbers match what the admin can actually act on.
    const activeWhere = {
      deletedAt: null,
      product: { isActive: true, deletedAt: null },
    };
    const [totalVariants, healthyStock, lowStock, outOfStock] =
      await Promise.all([
        this.prisma.productVariant.count({ where: activeWhere }),
        this.prisma.productVariant.count({
          where: { ...activeWhere, stock: { gt: 5 } },
        }),
        this.prisma.productVariant.count({
          where: { ...activeWhere, stock: { gt: 0, lte: 5 } },
        }),
        this.prisma.productVariant.count({
          where: { ...activeWhere, stock: 0 },
        }),
      ]);
    return { totalVariants, healthyStock, lowStock, outOfStock };
  }

  /**
   * Paginated full inventory list for the admin stock dashboard. Supports
   * filtering by stock bucket (out/low/healthy) and case-insensitive
   * search across SKU and parent product name. Always excludes soft-
   * deleted variants/products and inactive products — same active-rows
   * scope as the summary, so totals stay consistent.
   */
  async listVariants(opts: ListVariantsOpts) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 50));

    let stockFilter: Prisma.IntFilter | number | undefined;
    switch (opts.bucket) {
      case 'out':
        stockFilter = 0;
        break;
      case 'low':
        stockFilter = { gt: 0, lte: 5 };
        break;
      case 'healthy':
        stockFilter = { gt: 5 };
        break;
      default:
        stockFilter = undefined;
    }

    const search = opts.search?.trim();
    const where: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
      product: { isActive: true, deletedAt: null },
      ...(stockFilter !== undefined ? { stock: stockFilter } : {}),
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: 'insensitive' } },
              {
                product: {
                  is: {
                    name: { contains: search, mode: 'insensitive' },
                    isActive: true,
                    deletedAt: null,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [variants, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true, slug: true, images: true },
          },
        },
        // Stock asc surfaces problem variants first so admin sees them
        // without scrolling. SKU as secondary tie-breaker for stable order.
        orderBy: [{ stock: 'asc' }, { sku: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return { variants, total, page, limit };
  }
}
