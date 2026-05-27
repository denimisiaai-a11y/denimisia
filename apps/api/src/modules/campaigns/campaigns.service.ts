import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AddCampaignProductDto } from './dto/add-campaign-product.dto';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  // ─── Public ───────────────────────────────────────────────────────────────────

  async findActive(page = 1, limit = 20) {
    const now = new Date();
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    };

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { endDate: 'asc' },
        skip,
        take: limit,
        include: {
          products: {
            // Hide products that were soft-deleted or deactivated after
            // being attached to the campaign; the campaign itself stays
            // visible but rotted products do not leak to the storefront.
            where: { product: { isActive: true, deletedAt: null } },
            include: { product: true },
          },
        },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return {
      success: true,
      data: {
        campaigns,
        total,
        page,
        limit,
      },
    };
  }

  async findOnePublic(id: string) {
    const now = new Date();
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        products: {
          where: { product: { isActive: true, deletedAt: null } },
          include: { product: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return { success: true, data: campaign };
  }

  /**
   * Storefront /campaigns/[slug] landing page. Same activeness guard as
   * findOnePublic but keyed on slug instead of cuid.
   */
  async findBySlugPublic(slug: string) {
    const now = new Date();
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        slug,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        products: {
          where: { product: { isActive: true, deletedAt: null } },
          include: {
            product: {
              include: {
                variants: {
                  where: { deletedAt: null },
                  orderBy: { createdAt: 'asc' },
                },
                category: true,
              },
            },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return { success: true, data: campaign };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  /**
   * Admin list — every campaign regardless of isActive or date window so
   * staff can manage paused, future, and expired campaigns.
   */
  async findAllAdmin(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
        include: {
          products: { include: { product: true } },
        },
      }),
      this.prisma.campaign.count(),
    ]);
    return { success: true, data: { campaigns, total, page, limit } };
  }

  /**
   * Admin single read. Includes the joined product so the Edit modal can
   * render name + image + current price next to per-product discount config.
   */
  async findOneAdmin(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        products: {
          include: { product: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return { success: true, data: campaign };
  }


  async create(dto: CreateCampaignDto) {
    const existing = await this.prisma.campaign.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException('Campaign with this slug already exists');
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: dto.isActive ?? true,
      },
    });

    return { success: true, data: campaign };
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (dto.slug && dto.slug !== campaign.slug) {
      const slugTaken = await this.prisma.campaign.findUnique({
        where: { slug: dto.slug },
      });
      if (slugTaken) {
        throw new ConflictException('Campaign with this slug already exists');
      }
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: new Date(dto.endDate) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return { success: true, data: updated };
  }

  async remove(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    await this.prisma.campaign.delete({ where: { id } });
  }

  // ─── Campaign Products ────────────────────────────────────────────────────────

  async addProduct(campaignId: string, dto: AddCampaignProductDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive || product.deletedAt !== null) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.campaignProduct.findUnique({
      where: {
        campaignId_productId: {
          campaignId,
          productId: dto.productId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Product already added to this campaign');
    }

    const campaignProduct = await this.prisma.campaignProduct.create({
      data: {
        campaignId,
        productId: dto.productId,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
      },
      include: { product: true },
    });

    return { success: true, data: campaignProduct };
  }

  async removeProduct(campaignId: string, productId: string) {
    const campaignProduct = await this.prisma.campaignProduct.findUnique({
      where: {
        campaignId_productId: {
          campaignId,
          productId,
        },
      },
    });
    if (!campaignProduct) {
      throw new NotFoundException('Product not found in this campaign');
    }

    await this.prisma.campaignProduct.delete({
      where: { id: campaignProduct.id },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Calculate the campaign discount price for a product.
   * Returns null if the product has no active campaign discount.
   */
  async getCampaignPrice(
    productId: string,
    originalPrice: number,
  ): Promise<number | null> {
    const now = new Date();

    const campaignProduct = await this.prisma.campaignProduct.findFirst({
      where: {
        productId,
        campaign: {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
      include: { campaign: true },
    });

    if (!campaignProduct) {
      return null;
    }

    if (campaignProduct.discountType === 'PERCENTAGE') {
      const discount = originalPrice * (campaignProduct.discountValue / 100);
      return Math.round((originalPrice - discount) * 100) / 100;
    }

    if (campaignProduct.discountType === 'FIXED_AMOUNT') {
      const discounted = originalPrice - campaignProduct.discountValue;
      return Math.max(0, Math.round(discounted * 100) / 100);
    }

    return null;
  }

  /**
   * Track campaign usage when an order is placed.
   * Call this from OrdersService after order creation.
   */
  async trackUsage(campaignId: string, orderId: string, userId: string) {
    return this.prisma.campaignUsage.create({
      data: {
        campaignId,
        orderId,
        userId,
      },
    });
  }
}
