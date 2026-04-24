import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../redis/redis.decorator';
import Redis from 'ioredis';
import { AddToCartDto, UpdateCartItemDto } from './cart.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private static readonly MAX_QUANTITY_PER_ITEM = 99;

  constructor(
    private prisma: PrismaService,
    @InjectRedis() private redis: Redis,
  ) {}

  async getCart(userId?: string, sessionId?: string) {
    if (userId) {
      return this.getUserCart(userId);
    }
    if (sessionId) {
      return this.getGuestCart(sessionId);
    }
    return { items: [], total: 0 };
  }

  async addItem(dto: AddToCartDto, userId?: string, sessionId?: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    if (variant.stock < dto.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    if (userId) {
      return this.addToUserCart(userId, dto);
    }
    if (sessionId) {
      return this.addToGuestCart(sessionId, dto, variant);
    }
    throw new BadRequestException('No session or user provided');
  }

  async updateItem(itemId: string, dto: UpdateCartItemDto, userId?: string) {
    if (userId) {
      const item = await this.prisma.cartItem.findFirst({
        where: { id: itemId, cart: { userId } },
      });
      if (!item) throw new NotFoundException('Cart item not found');
      return this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: dto.quantity },
      });
    }
  }

  async removeItem(itemId: string, userId?: string) {
    if (userId) {
      const item = await this.prisma.cartItem.findFirst({
        where: { id: itemId, cart: { userId } },
      });
      if (!item) throw new NotFoundException('Cart item not found');
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    }
  }

  async clearCart(userId?: string, sessionId?: string) {
    if (userId) {
      const cart = await this.prisma.cart.findUnique({ where: { userId } });
      if (cart) {
        await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
    }
    if (sessionId) {
      await this.redis.del(`cart:${sessionId}`);
    }
  }

  async mergeGuestCart(userId: string, sessionId: string) {
    const guestCartData = await this.redis.get(`cart:${sessionId}`);
    if (!guestCartData) return;

    const guestItems: AddToCartDto[] = JSON.parse(guestCartData);
    for (const item of guestItems) {
      // Re-validate stock at merge time — guest cart may be days old.
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
        select: { id: true, stock: true },
      });
      if (!variant) {
        this.logger.warn(`mergeGuestCart: skipping missing variant ${item.variantId}`);
        continue;
      }
      if (variant.stock <= 0) {
        this.logger.warn(`mergeGuestCart: skipping out-of-stock variant ${item.variantId}`);
        continue;
      }
      const cappedQty = Math.min(
        item.quantity,
        variant.stock,
        CartService.MAX_QUANTITY_PER_ITEM,
      );
      if (cappedQty !== item.quantity) {
        this.logger.log(
          `mergeGuestCart: capped variant ${item.variantId} from ${item.quantity} to ${cappedQty}`,
        );
      }
      await this.addToUserCart(userId, { ...item, quantity: cappedQty });
    }
    await this.redis.del(`cart:${sessionId}`);
  }

  // ─── User Cart ────────────────────────────────────────────────────────────

  private async getUserCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: { select: { id: true, name: true, slug: true, images: true, price: true } },
              },
            },
          },
        },
      },
    });
    if (!cart) return { items: [], total: 0 };
    const total = cart.items.reduce((sum, item) => {
      const price = Number(item.variant.price ?? item.variant.product.price ?? 0);
      return sum + price * item.quantity;
    }, 0);
    return { ...cart, total };
  }

  private async addToUserCart(userId: string, dto: AddToCartDto) {
    let cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await this.prisma.cart.create({ data: { userId } });
    }

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, variantId: dto.variantId },
    });

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + dto.quantity },
      });
    }

    // Derive productId from variant — never trust client-supplied productId
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      select: { productId: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    return this.prisma.cartItem.create({
      data: { cartId: cart.id, productId: variant.productId, variantId: dto.variantId, quantity: dto.quantity },
    });
  }

  // ─── Guest Cart ───────────────────────────────────────────────────────────

  private async getGuestCart(sessionId: string) {
    const data = await this.redis.get(`cart:${sessionId}`);
    return { items: data ? JSON.parse(data) : [], total: 0 };
  }

  private async addToGuestCart(sessionId: string, dto: AddToCartDto, variant: any) {
    const data = await this.redis.get(`cart:${sessionId}`);
    const items = data ? JSON.parse(data) : [];

    const existing = items.find((i: any) => i.variantId === dto.variantId);
    if (existing) {
      existing.quantity += dto.quantity;
    } else {
      items.push({ ...dto, variantName: `${variant.size} / ${variant.color}` });
    }

    const ttl = 7 * 24 * 60 * 60;
    await this.redis.setex(`cart:${sessionId}`, ttl, JSON.stringify(items));
    return { items };
  }
}
