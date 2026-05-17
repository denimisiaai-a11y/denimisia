import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  private generateShareToken(): string {
    return randomBytes(16).toString('hex');
  }

  async getWishlist(userId: string) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          // Hide items whose product was soft-deleted or deactivated after
          // it was wishlisted. The DB row stays (so the savedAtPrice
          // snapshot remains for reporting), but the customer never sees
          // a dead product card.
          where: { product: { isActive: true, deletedAt: null } },
          include: {
            product: {
              include: {
                variants: {
                  select: {
                    id: true,
                    size: true,
                    color: true,
                    stock: true,
                    images: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return wishlist ?? { items: [] };
  }

  async addItem(userId: string, productId: string) {
    let wishlist = await this.prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({ data: { userId } });
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { variants: { select: { stock: true } } },
    });
    if (!product || !product.isActive || product.deletedAt !== null) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });
    if (existing) throw new ConflictException('Product already in wishlist');

    const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

    return this.prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId,
        savedAtPrice: product.price,
        savedAtStock: totalStock,
      },
      include: {
        product: {
          include: {
            variants: {
              select: {
                id: true,
                size: true,
                color: true,
                stock: true,
                images: true,
              },
            },
          },
        },
      },
    });
  }

  async removeItem(userId: string, productId: string) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
    });
    if (!wishlist) throw new NotFoundException('Wishlist not found');

    await this.prisma.wishlistItem.delete({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    });
  }

  async bulkAdd(userId: string, productIds: string[]) {
    if (productIds.length === 0) return { added: 0, skipped: 0 };
    let wishlist = await this.prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({ data: { userId } });
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null, isActive: true },
      select: {
        id: true,
        price: true,
        variants: { select: { stock: true } },
      },
    });
    const result = await this.prisma.wishlistItem.createMany({
      data: products.map((p) => ({
        wishlistId: wishlist.id,
        productId: p.id,
        savedAtPrice: p.price,
        savedAtStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
      })),
      skipDuplicates: true,
    });
    return {
      added: result.count,
      skipped: productIds.length - result.count,
    };
  }

  async getOrCreateShareToken(userId: string): Promise<{ shareToken: string }> {
    let wishlist = await this.prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({ data: { userId } });
    }
    if (wishlist.shareToken) return { shareToken: wishlist.shareToken };
    const token = this.generateShareToken();
    const updated = await this.prisma.wishlist.update({
      where: { id: wishlist.id },
      data: { shareToken: token },
    });
    return { shareToken: updated.shareToken! };
  }

  async revokeShareToken(userId: string): Promise<void> {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
    });
    if (!wishlist) throw new NotFoundException('Wishlist not found');
    await this.prisma.wishlist.update({
      where: { id: wishlist.id },
      data: { shareToken: null },
    });
  }

  async getPublicByToken(token: string) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { shareToken: token },
      include: {
        items: {
          // Public share page hides items whose product was soft-deleted
          // or deactivated. Same reasoning as getWishlist.
          where: { product: { isActive: true, deletedAt: null } },
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                images: true,
                variants: { select: { stock: true } },
              },
            },
          },
        },
      },
    });
    if (!wishlist) throw new NotFoundException('Wishlist not found');

    // TODO(schema): add `sharePublicName Boolean @default(false)` to the
    // Wishlist model so owners can opt in to showing their first name on
    // the public page. Until the field exists, never leak PII — return null.
    const ownerFirstName: string | null = null;
    return {
      ownerFirstName,
      items: wishlist.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        product: item.product,
      })),
    };
  }
}
