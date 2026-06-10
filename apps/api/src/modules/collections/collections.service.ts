import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionsAutoService } from './collections.auto.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  AddProductsToCollectionDto,
  UpsertLookbookItemDto,
} from './collections.dto';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auto: CollectionsAutoService,
  ) {}

  async findAll() {
    // Public storefront read: only active, not-soft-deleted, and currently
    // within startDate/endDate window. Admin views call findAllAdmin.
    const now = new Date();
    return this.prisma.collection.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      include: { _count: { select: { products: true } } },
      orderBy: [{ navOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findAllAdmin() {
    return this.prisma.collection.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { products: true } } },
      orderBy: [{ navOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findByIdAdmin(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        lookbook: { orderBy: { position: 'asc' } },
        products: {
          orderBy: { position: 'asc' },
          include: {
            product: { include: { variants: true, category: true } },
          },
        },
      },
    });
    if (!collection || collection.deletedAt) {
      throw new NotFoundException('Collection not found');
    }
    return collection;
  }

  async findBySlug(slug: string) {
    const now = new Date();
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: {
        lookbook: { orderBy: { position: 'asc' } },
        products: {
          where: { product: { isActive: true, deletedAt: null } },
          orderBy: { position: 'asc' },
          include: {
            product: { include: { variants: true } },
          },
        },
      },
    });
    if (
      !collection ||
      collection.deletedAt !== null ||
      !collection.isActive ||
      (collection.startDate && collection.startDate > now) ||
      (collection.endDate && collection.endDate < now)
    ) {
      throw new NotFoundException('Collection not found');
    }
    return collection;
  }

  async findBySlugResolved(slug: string) {
    const now = new Date();
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: {
        lookbook: { orderBy: { position: 'asc' } },
        products: {
          where: { product: { isActive: true, deletedAt: null } },
          orderBy: { position: 'asc' },
          include: {
            product: { include: { variants: true, category: true } },
          },
        },
      },
    });
    if (
      !collection ||
      collection.deletedAt !== null ||
      !collection.isActive ||
      (collection.startDate && collection.startDate > now) ||
      (collection.endDate && collection.endDate < now)
    ) {
      throw new NotFoundException('Collection not found');
    }
    if (collection.type === 'AUTO') {
      const autoProducts = await this.auto.resolve(collection as never);
      return { ...collection, products: autoProducts };
    }
    return collection;
  }

  async create(dto: CreateCollectionDto) {
    return this.prisma.collection.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type ?? undefined,
        subtitle: dto.subtitle ?? undefined,
        description: dto.description ?? undefined,
      },
    });
  }

  async update(id: string, dto: UpdateCollectionDto) {
    await this.findById(id);
    const data: Prisma.CollectionUpdateInput = {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      filterConfig: dto.filterConfig
        ? (dto.filterConfig as unknown as Prisma.InputJsonValue)
        : undefined,
      autoRules: dto.autoRules
        ? (dto.autoRules as unknown as Prisma.InputJsonValue)
        : undefined,
    };
    return this.prisma.collection.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.collection.delete({ where: { id } });
  }

  async addProducts(id: string, dto: AddProductsToCollectionDto) {
    await this.findById(id);
    const maxPos = await this.prisma.collectionProduct.aggregate({
      where: { collectionId: id },
      _max: { position: true },
    });
    let nextPos = (maxPos._max.position ?? -1) + 1;
    await this.prisma.collectionProduct.createMany({
      data: dto.productIds.map((productId) => ({
        collectionId: id,
        productId,
        position: nextPos++,
      })),
      skipDuplicates: true,
    });
    return this.findById(id);
  }

  async removeProduct(id: string, productId: string) {
    await this.prisma.collectionProduct.delete({
      where: { collectionId_productId: { collectionId: id, productId } },
    });
  }

  async reorderProducts(id: string, productIds: string[]) {
    await this.findById(id);
    await this.prisma.$transaction(
      productIds.map((productId, index) =>
        this.prisma.collectionProduct.update({
          where: { collectionId_productId: { collectionId: id, productId } },
          data: { position: index },
        }),
      ),
    );
    return this.findByIdAdmin(id);
  }

  async upsertLookbookItem(collectionId: string, dto: UpsertLookbookItemDto) {
    await this.findById(collectionId);
    return this.prisma.collectionLookbook.create({
      data: {
        collectionId,
        imageUrl: dto.imageUrl,
        caption: dto.caption,
        altText: dto.altText,
        position: dto.position ?? 0,
        hotspots: dto.hotspots
          ? (dto.hotspots as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async removeLookbookItem(lookbookId: string) {
    await this.prisma.collectionLookbook.delete({ where: { id: lookbookId } });
  }

  private async findById(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }
}
