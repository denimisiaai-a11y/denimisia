import { Injectable } from '@nestjs/common';
import { Prisma, TagDimension } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_PRODUCTS_RETURNED } from './bot.constants';
import { ParsedSlots } from './bot.types';

const INCLUDE = {
  variants: {
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      stock: true,
      images: true,
    },
  },
  productTags: { select: { dimension: true, value: true } },
};

@Injectable()
export class BotSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchBySlots(slots: ParsedSlots) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
    };
    if (slots.type) where.type = slots.type;
    if (slots.tags.length === 1) {
      const t = slots.tags[0];
      where.productTags = {
        some: { dimension: t.dimension as TagDimension, value: t.value },
      };
    } else if (slots.tags.length > 1) {
      where.AND = slots.tags.map((t) => ({
        productTags: {
          some: { dimension: t.dimension as TagDimension, value: t.value },
        },
      }));
    }
    if (slots.color || slots.size) {
      const variantFilter: Prisma.ProductVariantWhereInput = {
        stock: { gt: 0 },
      };
      if (slots.color)
        variantFilter.color = { equals: slots.color, mode: 'insensitive' };
      if (slots.size) variantFilter.size = slots.size;
      where.variants = { some: variantFilter };
    }

    const rows = await this.prisma.product.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
      take: MAX_PRODUCTS_RETURNED,
    });
    return rows.filter((p: { variants?: Array<{ stock: number }> }) =>
      p.variants?.some((v) => v.stock > 0),
    );
  }

  async findWhatsNew() {
    return this.prisma.product.findMany({
      where: { isActive: true, isNewArrival: true, deletedAt: null },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: MAX_PRODUCTS_RETURNED,
    });
  }
}
