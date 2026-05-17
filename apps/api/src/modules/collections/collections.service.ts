import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  AddProductsToCollectionDto,
} from './collections.dto';

@Injectable()
export class CollectionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    // Public storefront read: only active, not-soft-deleted, and
    // currently within startDate/endDate window (open-ended on either
    // side counts as in-window). Admin views that need to see scheduled
    // or expired collections would call a separate method (not yet built).
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
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const now = new Date();
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          // Soft-deleted or inactive products would otherwise leak onto
          // the collection page even after admin retires them.
          where: { product: { isActive: true, deletedAt: null } },
          orderBy: { position: 'asc' },
          include: {
            product: {
              include: { variants: true },
            },
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

  async create(dto: CreateCollectionDto) {
    return this.prisma.collection.create({ data: dto });
  }

  async update(id: string, dto: UpdateCollectionDto) {
    await this.findById(id);
    return this.prisma.collection.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.collection.delete({ where: { id } });
  }

  async addProducts(id: string, dto: AddProductsToCollectionDto) {
    await this.findById(id);
    // Assign sequential positions starting from max+1 so the admin's
    // explicit add order is preserved. Without this every new product
    // landed at position=0 and the visible order was undefined.
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

  private async findById(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }
}
