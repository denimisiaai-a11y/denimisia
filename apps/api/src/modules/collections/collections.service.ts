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
    return this.prisma.collection.findMany({
      where: { isActive: true },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: {
        products: {
          include: {
            product: {
              include: { variants: true },
            },
          },
        },
      },
    });
    if (!collection) throw new NotFoundException('Collection not found');
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
    await this.prisma.collectionProduct.createMany({
      data: dto.productIds.map((productId) => ({
        collectionId: id,
        productId,
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
