import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryType } from '@prisma/client';

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
        product: { select: { id: true, name: true, slug: true } },
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
    const [totalVariants, lowStock, outOfStock] = await Promise.all([
      this.prisma.productVariant.count({ where: activeWhere }),
      this.prisma.productVariant.count({
        where: { ...activeWhere, stock: { gt: 0, lte: 5 } },
      }),
      this.prisma.productVariant.count({
        where: { ...activeWhere, stock: 0 },
      }),
    ]);
    return { totalVariants, lowStock, outOfStock };
  }
}
