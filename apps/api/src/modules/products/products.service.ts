import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TagDimension } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
  ProductQueryDto,
} from './products.dto';
import { REQUIRED_DIMENSIONS_FOR_TYPE } from '../bot/bot.constants';

/**
 * Shared include for listing endpoints (featured, new-arrivals, trending,
 * findAll). Extracted so the shape can't drift between call sites — e.g. when
 * adding `_count: { reviews: true }` to one but not the other.
 */
const PRODUCT_LIST_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  variants: {
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      colorHex: true,
      price: true,
      stock: true,
      images: true,
    },
  },
  productTags: { select: { dimension: true, value: true } },
  sizeCharts: {
    select: {
      sizeKey: true,
      dimension: true,
      bodyValueIn: true,
      garmentValueIn: true,
    },
  },
  _count: { select: { reviews: true } },
} as const satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  async findAll(
    query: ProductQueryDto,
    options: { includeInactive?: boolean } = {},
  ) {
    const page = Math.max(parseInt(query.page ?? '1'), 1);
    const limit = Math.min(Math.max(parseInt(query.limit ?? '24'), 1), 200);
    const skip = (page - 1) * limit;

    const orderBy = this.buildOrderBy(query.sort);

    // Admin views set includeInactive=true to see inactive items so they
    // can re-activate them. Public storefront always hides them.
    const where: Prisma.ProductWhereInput = options.includeInactive
      ? {}
      : { isActive: true };
    if (query.category) where.category = { slug: query.category };
    if (query.featured !== undefined) where.isFeatured = query.featured;
    if (query.trending !== undefined) where.isTrending = query.trending;
    if (query.newArrival !== undefined) where.isNewArrival = query.newArrival;
    if (query.collection) {
      where.collections = { some: { collection: { slug: query.collection } } };
    }
    if (query.minPrice || query.maxPrice) {
      const price: Prisma.DecimalFilter = {};
      if (query.minPrice) price.gte = parseFloat(query.minPrice);
      if (query.maxPrice) price.lte = parseFloat(query.maxPrice);
      where.price = price;
    }
    if (query.size) {
      const sizes = query.size.split(',').map((s) => s.trim());
      where.variants = { some: { size: { in: sizes } } };
    }
    if (query.color) {
      const colors = query.color.split(',').map((c) => c.trim());
      const variantWhere = where.variants?.some ?? {};
      where.variants = {
        some: { ...variantWhere, color: { in: colors, mode: 'insensitive' } },
      };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: PRODUCT_LIST_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFeatured() {
    return this.prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      take: 8,
      include: PRODUCT_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findNewArrivals() {
    // Prefers admin-flagged "new arrival" rows; falls back to most-recent
    // active products when no rows are explicitly flagged so the homepage
    // never renders an empty section.
    const flagged = await this.prisma.product.findMany({
      where: { isActive: true, isNewArrival: true },
      take: 8,
      include: PRODUCT_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    if (flagged.length > 0) return flagged;

    return this.prisma.product.findMany({
      where: { isActive: true },
      take: 8,
      include: PRODUCT_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTrending() {
    // Sort by createdAt to match findNewArrivals + findFeatured. Earlier
    // version used updatedAt, which bumped a product to the front of the
    // slider any time the admin tweaked an unrelated field (price, image,
    // etc.). The flag itself is the signal; ordering by creation date keeps
    // the row stable until you explicitly unflag / reflag.
    return this.prisma.product.findMany({
      where: { isActive: true, isTrending: true },
      take: 8,
      include: PRODUCT_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lean slug feed for sitemap generation. Cursor-paginated on the unique id
   * column (ordered ascending) to guarantee stable page boundaries regardless
   * of how id values are generated (cuid/uuid/auto-increment). Sitemaps don't
   * need chronological order; each entry carries its own updatedAt so Google
   * still gets freshness signals.
   */
  async getSlugFeed(params: { cursor?: string; limit: number }) {
    const { cursor, limit } = params;

    const rows = await this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        updatedAt: true,
        images: true,
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((p) => ({
      slug: p.slug,
      updatedAt: p.updatedAt,
      firstImage:
        Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null,
    }));
    const nextCursor = hasMore ? rows[limit].id : null;

    return { items, nextCursor };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        variants: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        collections: {
          include: {
            collection: { select: { id: true, name: true, slug: true } },
          },
        },
        productTags: { select: { dimension: true, value: true } },
        sizeCharts: {
          select: {
            sizeKey: true,
            dimension: true,
            bodyValueIn: true,
            garmentValueIn: true,
          },
        },
      },
    });
    if (!product || !product.isActive)
      throw new NotFoundException('Product not found');
    return product;
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async create(dto: CreateProductDto) {
    const { variants, bundle, productTags, sizeCharts, type, ...productData } =
      dto;

    // Server-side guard: when a product type is set, the bot's recommender
    // requires every dimension in REQUIRED_DIMENSIONS_FOR_TYPE[type] to be
    // covered by at least one tag. Reject up-front so we never persist
    // unfindable products.
    this.assertRequiredTagDimensions(type, productTags);

    // Fast path: no inline bundle and no tags/size-charts — preserve the
    // single-call behaviour so existing callers / tests stay valid.
    if (!bundle && !productTags?.length && !sizeCharts?.length) {
      return this.prisma.product.create({
        data: {
          ...productData,
          ...(type !== undefined ? { type } : {}),
          variants: variants ? { create: variants } : undefined,
        },
        include: { variants: true, category: true },
      });
    }

    // Multi-write path: wrap product + bundle + tags + size-charts in one
    // transaction so a failed leg rolls back the product. Avoids orphan
    // rows the chained client flow used to leave behind.
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          ...(type !== undefined ? { type } : {}),
          variants: variants ? { create: variants } : undefined,
        },
        include: { variants: true, category: true },
      });

      if (bundle) {
        await tx.productBundle.create({
          data: {
            name: bundle.name,
            slug: bundle.slug,
            description: bundle.description ?? null,
            badgeText: bundle.badgeText,
            image: bundle.image ?? null,
            items: {
              create: [product.id, ...bundle.additionalProductIds].map(
                (productId) => ({ productId }),
              ),
            },
          },
        });
      }

      if (productTags?.length) {
        await tx.productTag.createMany({
          data: productTags.map((t) => ({
            productId: product.id,
            dimension: t.dimension as TagDimension,
            value: t.value,
          })),
        });
      }

      if (sizeCharts?.length) {
        await tx.productSizeChart.createMany({
          data: sizeCharts.map((s) => ({
            productId: product.id,
            sizeKey: s.sizeKey,
            dimension: s.dimension,
            bodyValueIn: s.bodyValueIn,
            garmentValueIn: s.garmentValueIn,
          })),
        });
      }

      // Re-fetch with the full include so callers see the tags + charts
      // they just supplied without needing a follow-up GET.
      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          variants: true,
          category: true,
          productTags: true,
          sizeCharts: true,
        },
      });
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);
    const { productTags, sizeCharts, type, ...rest } = dto;

    // If type is being set, enforce the same required-tag coverage that
    // create() does. We only validate against the tag set provided in
    // THIS request — if the client wants to keep existing tags, they need
    // to send them back. (Replace-strategy below mirrors that contract.)
    if (type !== undefined && productTags !== undefined) {
      this.assertRequiredTagDimensions(type, productTags);
    }

    // Fast path: no tags / size-chart replacement — preserve the original
    // single-call shape so existing callers / tests stay valid.
    if (productTags === undefined && sizeCharts === undefined) {
      return this.prisma.product.update({
        where: { id },
        data: { ...rest, ...(type !== undefined ? { type } : {}) },
        include: { variants: true, category: true },
      });
    }

    // Replace-strategy: deleteMany then createMany for each collection the
    // caller provided. An undefined collection means "leave existing
    // rows alone"; an empty array means "delete all rows".
    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { ...rest, ...(type !== undefined ? { type } : {}) },
      });

      if (productTags !== undefined) {
        await tx.productTag.deleteMany({ where: { productId: id } });
        if (productTags.length) {
          await tx.productTag.createMany({
            data: productTags.map((t) => ({
              productId: id,
              dimension: t.dimension as TagDimension,
              value: t.value,
            })),
          });
        }
      }

      if (sizeCharts !== undefined) {
        await tx.productSizeChart.deleteMany({ where: { productId: id } });
        if (sizeCharts.length) {
          await tx.productSizeChart.createMany({
            data: sizeCharts.map((s) => ({
              productId: id,
              sizeKey: s.sizeKey,
              dimension: s.dimension,
              bodyValueIn: s.bodyValueIn,
              garmentValueIn: s.garmentValueIn,
            })),
          });
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          variants: true,
          category: true,
          productTags: true,
          sizeCharts: true,
        },
      });
    });
  }

  /**
   * Read-only size chart for a product. Rows ordered (sizeKey, dimension)
   * so consumers (bot recommender + PDP) can render a stable table without
   * extra sorting on the client.
   */
  async getSizeChart(productId: string) {
    const rows = await this.prisma.productSizeChart.findMany({
      where: { productId },
      orderBy: [{ sizeKey: 'asc' }, { dimension: 'asc' }],
    });
    return { rows };
  }

  /**
   * Throws BadRequestException if `type` is set and one of its required
   * tag dimensions is missing from the provided `productTags`. Centralised
   * so create + update share the same rule.
   */
  private assertRequiredTagDimensions(
    type: UpdateProductDto['type'],
    productTags: UpdateProductDto['productTags'],
  ) {
    if (!type) return;
    const required = REQUIRED_DIMENSIONS_FOR_TYPE[type];
    const provided = new Set((productTags ?? []).map((t) => t.dimension));
    for (const dim of required) {
      if (!provided.has(dim)) {
        throw new BadRequestException(
          `Missing required attribute: ${dim} for type ${type}`,
        );
      }
    }
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async addVariant(productId: string, dto: CreateVariantDto) {
    await this.findById(productId);
    await this.assertVariantImagesMatchColor(productId, dto.color, dto.images);
    return this.prisma.productVariant.create({
      data: { ...dto, productId },
    });
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ) {
    const existing = await this.findVariant(productId, variantId);
    // If color OR images changed, re-validate against siblings of the
    // resulting color. Pull from `existing` for any field the dto omits.
    const nextColor = dto.color ?? existing.color;
    const nextImages = dto.images ?? existing.images;
    if (dto.color !== undefined || dto.images !== undefined) {
      await this.assertVariantImagesMatchColor(
        productId,
        nextColor,
        nextImages,
        variantId,
      );
    }
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: dto,
    });
  }

  /**
   * Enforce LR-001 D1: every ProductVariant of the same (productId, color)
   * shares the same `images` array. The admin UI presents image input PER
   * color, but admins editing variants via the API directly could break
   * this invariant without the gate. Rejects with ConflictException (409)
   * when the proposed images differ from any sibling.
   *
   * `excludeVariantId` is the variant being updated (skip self-compare).
   */
  private async assertVariantImagesMatchColor(
    productId: string,
    color: string,
    images: string[] | undefined,
    excludeVariantId?: string,
  ) {
    if (!images) return; // no image change attempted
    const siblings = await this.prisma.productVariant.findMany({
      where: {
        productId,
        color,
        deletedAt: null,
        ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
      },
      select: { id: true, images: true },
    });
    if (siblings.length === 0) return; // first variant of this color sets the canon

    const canon = siblings[0].images;
    const sameAsCanon =
      images.length === canon.length &&
      images.every((url, i) => url === canon[i]);
    if (!sameAsCanon) {
      throw new ConflictException(
        `Variant images must match all other variants of color "${color}" on this product. ` +
          `Edit images for the color as a group via the admin UI.`,
      );
    }
  }

  async deleteVariant(productId: string, variantId: string) {
    await this.findVariant(productId, variantId);
    await this.prisma.productVariant.delete({ where: { id: variantId } });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /**
   * Admin GET-by-id with the same shape as findBySlug: variants, category,
   * and collections joined. Used by the product edit page which only has
   * the cuid (the public `/products/:slug` route is slug-only, hence the
   * dedicated admin lookup).
   */
  async findByIdForAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
        collections: {
          include: {
            collection: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async findVariant(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return variant;
  }

  async getFacets() {
    const [categories, variants, priceAgg] = await Promise.all([
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: { isActive: true },
        _count: { id: true },
      }),
      this.prisma.productVariant.findMany({
        where: { product: { isActive: true } },
        select: { size: true, color: true },
      }),
      this.prisma.product.aggregate({
        where: { isActive: true },
        _min: { price: true },
        _max: { price: true },
      }),
    ]);

    const categoryDetails = await this.prisma.category.findMany({
      where: { id: { in: categories.map((c) => c.categoryId) } },
      select: { id: true, name: true, slug: true },
    });

    const categoryFacets = categories
      .map((c) => {
        const cat = categoryDetails.find((d) => d.id === c.categoryId);
        return {
          name: cat?.name ?? '',
          slug: cat?.slug ?? '',
          count: c._count.id,
        };
      })
      .sort((a, b) => b.count - a.count);

    const sizeCounts = new Map<string, number>();
    const colorCounts = new Map<string, number>();
    for (const v of variants) {
      sizeCounts.set(v.size, (sizeCounts.get(v.size) ?? 0) + 1);
      colorCounts.set(v.color, (colorCounts.get(v.color) ?? 0) + 1);
    }

    const sizes = [...sizeCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort(
        (a, b) =>
          parseInt(a.value) - parseInt(b.value) ||
          a.value.localeCompare(b.value),
      );

    const colors = [...colorCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    return {
      categories: categoryFacets,
      sizes,
      colors,
      price: {
        min: Number(priceAgg._min.price ?? 0),
        max: Number(priceAgg._max.price ?? 0),
      },
    };
  }

  private buildOrderBy(sort?: string) {
    switch (sort) {
      case 'price_asc':
        return { price: 'asc' as const };
      case 'price_desc':
        return { price: 'desc' as const };
      case 'name_asc':
        return { name: 'asc' as const };
      case 'oldest':
        return { createdAt: 'asc' as const };
      default:
        return { createdAt: 'desc' as const };
    }
  }
}
