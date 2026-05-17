import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { UpdateBundleDto } from './dto/update-bundle.dto';

@Injectable()
export class BundlesService {
  constructor(private prisma: PrismaService) {}

  async findAllActive() {
    return this.prisma.productBundle.findMany({
      where: { isActive: true },
      include: {
        items: {
          include: {
            product: {
              include: { variants: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const bundle = await this.prisma.productBundle.findUnique({
      where: { slug },
      include: {
        items: {
          include: {
            product: {
              include: { variants: true },
            },
          },
        },
      },
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return bundle;
  }

  async create(dto: CreateBundleDto) {
    const { productIds, ...bundleData } = dto;
    return this.prisma.productBundle.create({
      data: {
        ...bundleData,
        items: {
          create: productIds.map((productId) => ({ productId })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateBundleDto) {
    await this.findById(id);
    return this.prisma.productBundle.update({
      where: { id },
      data: dto,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.bundleItem.deleteMany({ where: { bundleId: id } });
    await this.prisma.productBundle.delete({ where: { id } });
  }

  async addItem(bundleId: string, productId: string) {
    await this.findById(bundleId);
    await this.prisma.bundleItem.create({
      data: { bundleId, productId },
    });
    return this.findById(bundleId);
  }

  async addItems(bundleId: string, productIds: string[]) {
    await this.findById(bundleId);
    await this.prisma.bundleItem.createMany({
      data: productIds.map((productId) => ({ bundleId, productId })),
      skipDuplicates: true,
    });
    return this.findById(bundleId);
  }

  async removeItem(bundleId: string, productId: string) {
    await this.prisma.bundleItem.delete({
      where: {
        bundleId_productId: { bundleId, productId },
      },
    });
  }

  private async findById(id: string) {
    const bundle = await this.prisma.productBundle.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: { variants: true },
            },
          },
        },
      },
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return bundle;
  }
}
