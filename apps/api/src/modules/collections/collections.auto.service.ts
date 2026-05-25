import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface AutoRules {
  includeCategoryIds?: string[];
  includeTags?: string[];
  includeIfBestseller?: boolean;
  includeIfNewArrival?: boolean;
  newArrivalDays?: number;
  onSaleOnly?: boolean;
  inStockOnly?: boolean;
  excludeProductIds?: string[];
  maxProducts?: number;
}

interface CollectionLike {
  autoRules: AutoRules | Prisma.JsonValue | null;
}

@Injectable()
export class CollectionsAutoService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(collection: CollectionLike) {
    const rules: AutoRules =
      (collection.autoRules as AutoRules | null) ?? ({} as AutoRules);

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    if (rules.includeCategoryIds?.length) {
      where.categoryId = { in: rules.includeCategoryIds };
    }
    if (rules.includeTags?.length) {
      where.tags = { hasSome: rules.includeTags };
    }
    if (rules.includeIfBestseller) {
      where.isTrending = true;
    }
    if (rules.includeIfNewArrival) {
      const days = rules.newArrivalDays ?? 14;
      where.createdAt = { gte: new Date(Date.now() - days * 86_400_000) };
    }
    if (rules.onSaleOnly) {
      where.compareAtPrice = { not: null };
    }
    if (rules.excludeProductIds?.length) {
      where.id = { notIn: rules.excludeProductIds };
    }
    if (rules.inStockOnly) {
      where.variants = { some: { stock: { gt: 0 } } };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { variants: true, category: true },
      orderBy: rules.includeIfNewArrival
        ? { createdAt: 'desc' }
        : { createdAt: 'desc' },
      take: rules.maxProducts ?? 24,
    });

    // Shape result like CollectionProduct join rows so the controller / web
    // can render either path uniformly.
    return products.map((product, position) => ({
      collectionId: '__auto__',
      productId: product.id,
      position,
      createdAt: new Date(),
      product,
    }));
  }
}
