/**
 * Section curation — merchandising editor for homepage product sections.
 *
 * Resolves the final ordered product list for a dynamic section based on
 * its source mode:
 *   COLLECTION — pulls products from the linked Collection in catalog order
 *   MANUAL     — renders only the admin-pinned products, in saved order
 *   MIXED      — prepends pinned manual picks, then fills from the collection,
 *                skipping any product that was already pinned. Respects maxItems.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CurationSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  UpsertCurationDto,
  AddSectionProductDto,
  UpdateSectionProductDto,
} from './curation.dto';

@Injectable()
export class CurationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All curations for one page — used by the admin grid view so workers can
   * see every product section on a page at once (with counts and source mode).
   */
  async listByPage(pageKey: string) {
    return this.prisma.sectionCuration.findMany({
      where: { pageKey },
      orderBy: { sectionKey: 'asc' },
      include: {
        collection: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: true } },
        products: {
          take: 4,
          orderBy: [{ isPinned: 'desc' }, { position: 'asc' }],
          include: {
            product: {
              select: { id: true, name: true, slug: true, images: true },
            },
            customImage: { select: { publicUrl: true } },
          },
        },
      },
    });
  }

  /**
   * Bulk add products — one round trip. Skips duplicates silently.
   */
  async addProductsBulk(
    pageKey: string,
    sectionKey: string,
    productIds: readonly string[],
  ) {
    const curation = await this.ensure(pageKey, sectionKey);
    const existing = await this.prisma.sectionProduct.findMany({
      where: { curationId: curation.id, productId: { in: [...productIds] } },
      select: { productId: true },
    });
    const already = new Set(existing.map((e) => e.productId));
    const toAdd = productIds.filter((id) => !already.has(id));
    if (toAdd.length === 0) return { added: 0, skipped: productIds.length };

    const maxPos = await this.prisma.sectionProduct.aggregate({
      where: { curationId: curation.id },
      _max: { position: true },
    });
    let nextPos = (maxPos._max.position ?? -1) + 1;
    await this.prisma.sectionProduct.createMany({
      data: toAdd.map((productId) => ({
        curationId: curation.id,
        productId,
        position: nextPos++,
        isPinned: false,
      })),
    });
    return { added: toAdd.length, skipped: productIds.length - toAdd.length };
  }

  /**
   * Fill section from its linked collection — one click copies everything
   * (up to maxItems) into the manual product list, respecting collection
   * order. Useful when switching from COLLECTION mode to MIXED/MANUAL.
   */
  async fillFromCollection(pageKey: string, sectionKey: string) {
    const curation = await this.ensure(pageKey, sectionKey);
    if (!curation.collectionId)
      throw new BadRequestException('No collection linked to this section.');
    const collectionProducts = await this.prisma.collectionProduct.findMany({
      where: {
        collectionId: curation.collectionId,
        product: { isActive: true, deletedAt: null },
      },
      orderBy: { product: { createdAt: 'desc' } },
      take: curation.maxItems,
      select: { productId: true },
    });
    return this.addProductsBulk(
      pageKey,
      sectionKey,
      collectionProducts.map((p) => p.productId),
    );
  }

  async getOrCreate(pageKey: string, sectionKey: string, label?: string) {
    const existing = await this.prisma.sectionCuration.findUnique({
      where: { pageKey_sectionKey: { pageKey, sectionKey } },
      include: {
        collection: true,
        products: {
          orderBy: [{ isPinned: 'desc' }, { position: 'asc' }],
          include: {
            product: {
              include: { category: true, variants: { take: 1 } },
            },
            customImage: true,
          },
        },
      },
    });
    if (existing) return existing;
    return this.prisma.sectionCuration.create({
      data: { pageKey, sectionKey, label: label ?? sectionKey },
      include: {
        collection: true,
        products: { include: { product: true, customImage: true } },
      },
    });
  }

  /**
   * Public read — returns the resolved product list ready for storefront use.
   * Includes product cards with variants, plus the custom thumbnail (if any).
   */
  async resolve(pageKey: string, sectionKey: string) {
    const curation = await this.prisma.sectionCuration.findUnique({
      where: { pageKey_sectionKey: { pageKey, sectionKey } },
      include: {
        products: {
          // Filter at the SQL layer: a soft-deleted or deactivated product
          // pinned to a MANUAL or MIXED section would otherwise leak onto
          // the storefront. The MANUAL branch below trusts curation.products
          // without re-checking; doing the filter here is the single point
          // of truth.
          where: { product: { isActive: true, deletedAt: null } },
          orderBy: [{ isPinned: 'desc' }, { position: 'asc' }],
          include: {
            product: {
              include: {
                category: { select: { slug: true, name: true } },
                variants: {
                  select: {
                    price: true,
                    stock: true,
                    size: true,
                    color: true,
                    sku: true,
                  },
                  take: 12,
                },
              },
            },
            customImage: true,
          },
        },
        collection: true,
      },
    });
    if (!curation || !curation.isActive) return { curation: null, items: [] };

    const pinnedIds = new Set(
      curation.products.filter((p) => p.isPinned).map((p) => p.productId),
    );
    const manual = curation.products.filter((p) =>
      curation.sourceMode === CurationSource.MANUAL
        ? true
        : curation.sourceMode === CurationSource.MIXED
          ? p.isPinned
          : false,
    );

    let collectionItems: Awaited<
      ReturnType<typeof this.loadCollectionProducts>
    > = [];
    if (
      curation.sourceMode !== CurationSource.MANUAL &&
      curation.collectionId
    ) {
      collectionItems = await this.loadCollectionProducts(
        curation.collectionId,
        curation.maxItems,
      );
      collectionItems = collectionItems.filter(
        (p) => !pinnedIds.has(p.product.id),
      );
    }

    const combined = [
      ...manual.map((sp) => ({
        productId: sp.productId,
        product: sp.product,
        customImageUrl: sp.customImage?.publicUrl ?? null,
        customImagePoster: sp.customImage?.posterUrl ?? null,
        isPinned: sp.isPinned,
        isManual: true,
        position: sp.position,
        sectionProductId: sp.id,
      })),
      ...collectionItems.map((cp, i) => ({
        productId: cp.product.id,
        product: cp.product,
        customImageUrl: null,
        customImagePoster: null,
        isPinned: false,
        isManual: false,
        position: 1_000_000 + i,
        sectionProductId: null as string | null,
      })),
    ].slice(0, curation.maxItems);

    return { curation, items: combined };
  }

  private async loadCollectionProducts(collectionId: string, take: number) {
    const rows = await this.prisma.collectionProduct.findMany({
      where: { collectionId, product: { isActive: true, deletedAt: null } },
      orderBy: { product: { createdAt: 'desc' } },
      take: Math.max(1, Math.min(50, take * 2)),
      include: {
        product: {
          include: {
            category: { select: { slug: true, name: true } },
            variants: {
              select: {
                price: true,
                stock: true,
                size: true,
                color: true,
                sku: true,
              },
              take: 12,
            },
          },
        },
      },
    });
    return rows;
  }

  async upsert(pageKey: string, sectionKey: string, dto: UpsertCurationDto) {
    if (dto.collectionId) {
      const c = await this.prisma.collection.findUnique({
        where: { id: dto.collectionId },
      });
      if (!c)
        throw new BadRequestException(
          `Unknown collection id: ${dto.collectionId}`,
        );
    }
    const data: Prisma.SectionCurationUpdateInput = {
      label: dto.label,
      sourceMode: dto.sourceMode,
      collection:
        dto.collectionId === null
          ? { disconnect: true }
          : dto.collectionId
            ? { connect: { id: dto.collectionId } }
            : undefined,
      heading: dto.heading,
      subheading: dto.subheading,
      ctaLabel: dto.ctaLabel,
      ctaHref: dto.ctaHref,
      maxItems: dto.maxItems,
      isActive: dto.isActive,
    };
    return this.prisma.sectionCuration.upsert({
      where: { pageKey_sectionKey: { pageKey, sectionKey } },
      update: data,
      create: {
        pageKey,
        sectionKey,
        label: dto.label,
        sourceMode: dto.sourceMode,
        collectionId: dto.collectionId ?? null,
        heading: dto.heading,
        subheading: dto.subheading,
        ctaLabel: dto.ctaLabel,
        ctaHref: dto.ctaHref,
        maxItems: dto.maxItems ?? 12,
        isActive: dto.isActive ?? true,
      },
      include: {
        collection: true,
        products: {
          orderBy: [{ isPinned: 'desc' }, { position: 'asc' }],
          include: { product: true, customImage: true },
        },
      },
    });
  }

  async addProduct(
    pageKey: string,
    sectionKey: string,
    dto: AddSectionProductDto,
  ) {
    const curation = await this.ensure(pageKey, sectionKey);
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product)
      throw new NotFoundException(`Product ${dto.productId} not found`);

    const existing = await this.prisma.sectionProduct.findUnique({
      where: {
        curationId_productId: {
          curationId: curation.id,
          productId: dto.productId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(`Product already in this section.`);
    }

    const maxPos = await this.prisma.sectionProduct.aggregate({
      where: { curationId: curation.id },
      _max: { position: true },
    });
    return this.prisma.sectionProduct.create({
      data: {
        curationId: curation.id,
        productId: dto.productId,
        position: dto.position ?? (maxPos._max.position ?? -1) + 1,
        isPinned: dto.isPinned ?? curation.sourceMode === CurationSource.MANUAL,
      },
      include: { product: true, customImage: true },
    });
  }

  async updateProduct(sectionProductId: string, dto: UpdateSectionProductDto) {
    const data: Prisma.SectionProductUpdateInput = {};
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.isPinned !== undefined) data.isPinned = dto.isPinned;
    if (dto.customImageAssetId !== undefined) {
      data.customImage =
        dto.customImageAssetId === null
          ? { disconnect: true }
          : { connect: { id: dto.customImageAssetId } };
    }
    return this.prisma.sectionProduct.update({
      where: { id: sectionProductId },
      data,
      include: { product: true, customImage: true },
    });
  }

  async removeProduct(sectionProductId: string) {
    return this.prisma.sectionProduct.delete({
      where: { id: sectionProductId },
    });
  }

  async reorder(
    pageKey: string,
    sectionKey: string,
    orderedProductIds: string[],
  ) {
    const curation = await this.ensure(pageKey, sectionKey);
    await this.prisma.$transaction(
      orderedProductIds.map((productId, position) =>
        this.prisma.sectionProduct.updateMany({
          where: { curationId: curation.id, productId },
          data: { position },
        }),
      ),
    );
    return this.getOrCreate(pageKey, sectionKey);
  }

  /**
   * Typeahead product search — by name, slug, model (via variant SKU prefix),
   * or returns the 10 newest when the query is empty.
   */
  async searchProducts(q: string, limit = 10) {
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      return this.prisma.product.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: Math.min(25, limit),
        include: {
          variants: { take: 1 },
          category: { select: { slug: true, name: true } },
        },
      });
    }
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { slug: { contains: trimmed, mode: 'insensitive' } },
          { description: { contains: trimmed, mode: 'insensitive' } },
          {
            variants: {
              some: { sku: { contains: trimmed, mode: 'insensitive' } },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(25, limit),
      include: {
        variants: { take: 1 },
        category: { select: { slug: true, name: true } },
      },
    });
  }

  private async ensure(pageKey: string, sectionKey: string) {
    const c = await this.prisma.sectionCuration.findUnique({
      where: { pageKey_sectionKey: { pageKey, sectionKey } },
    });
    if (c) return c;
    return this.prisma.sectionCuration.create({
      data: { pageKey, sectionKey, label: sectionKey },
    });
  }
}
