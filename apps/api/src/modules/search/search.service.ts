import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const MAX_SEARCH_LIMIT = 50;

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchProducts(query: string, page = 1, limit = 20) {
    if (!query || query.trim().length < 2) {
      return { products: [], total: 0, page, limit };
    }

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);

    const q = query.trim();
    const skip = (safePage - 1) * safeLimit;

    const where = {
      isActive: true,
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { tags: { has: q } },
        { category: { name: { contains: q, mode: 'insensitive' as const } } },
        {
          collections: {
            some: {
              collection: {
                name: { contains: q, mode: 'insensitive' as const },
              },
            },
          },
        },
      ],
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: safeLimit,
        include: {
          category: { select: { name: true, slug: true } },
          variants: {
            select: {
              id: true,
              size: true,
              color: true,
              price: true,
              stock: true,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total, page: safePage, limit: safeLimit, query: q };
  }

  async getSuggestions(query: string) {
    if (!query || query.trim().length < 2) return [];

    const q = query.trim();
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        name: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, name: true, slug: true, images: true },
      take: 6,
      orderBy: { name: 'asc' },
    });

    return products;
  }
}
