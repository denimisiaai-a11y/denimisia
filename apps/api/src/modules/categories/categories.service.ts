import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../redis/redis.decorator';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

// Categories change rarely; the storefront's header nav hits findAll on every
// page load. 60s matches the rest of the public-read cache layer.
const CATEGORY_TTL_SECONDS = 60;
const CATEGORY_TREE_KEY = 'category:tree';
const CATEGORY_SLUG_KEY = (slug: string) => `category:slug:${slug}`;
const CATEGORY_SLUG_PREFIX = 'category:slug:';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private prisma: PrismaService,
    @InjectRedis() private redis: Redis,
  ) {}

  async findAll() {
    return this.getOrSetCached(CATEGORY_TREE_KEY, CATEGORY_TTL_SECONDS, () =>
      this.prisma.category.findMany({
        where: { parentId: null, deletedAt: null },
        include: {
          children: {
            where: { deletedAt: null },
            include: { children: { where: { deletedAt: null } } },
          },
        },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async findBySlug(slug: string) {
    return this.getOrSetCached(
      CATEGORY_SLUG_KEY(slug),
      CATEGORY_TTL_SECONDS,
      async () => {
        const category = await this.prisma.category.findUnique({
          where: { slug },
          include: {
            children: { where: { deletedAt: null } },
            products: {
              where: { isActive: true, deletedAt: null },
              include: { variants: true },
              take: 24,
            },
          },
        });
        // A soft-deleted category should not be reachable through public reads.
        // The unique slug lookup may still return one if admin reused the slug
        // before clearing the deletedAt flag, so re-check after fetch.
        if (!category || category.deletedAt !== null) {
          throw new NotFoundException('Category not found');
        }
        return category;
      },
    );
  }

  async create(dto: CreateCategoryDto) {
    const created = await this.prisma.category.create({ data: dto });
    await this.invalidateAll();
    return created;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);
    const updated = await this.prisma.category.update({
      where: { id },
      data: dto,
    });
    await this.invalidateAll();
    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.category.delete({ where: { id } });
    await this.invalidateAll();
  }

  private async findById(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async invalidateAll(): Promise<void> {
    try {
      await this.redis.del(CATEGORY_TREE_KEY);
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${CATEGORY_SLUG_PREFIX}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) await this.redis.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(
        `redis invalidate categories failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  private async getOrSetCached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch (err) {
      this.logger.warn(
        `redis get failed for ${key}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    const result = await fetcher();
    try {
      await this.redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `redis set failed for ${key}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    return result;
  }
}
