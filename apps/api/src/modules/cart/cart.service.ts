import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../redis/redis.decorator';
import Redis from 'ioredis';
import {
  AddToCartDto,
  UpdateCartItemDto,
  AddBundleToCartDto,
} from './cart.dto';

const GUEST_CART_TTL_SECONDS = 7 * 24 * 60 * 60;

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

  async addBundleItem(
    dto: AddBundleToCartDto,
    userId?: string,
    sessionId?: string,
  ) {
    const bundle = await this.prisma.productBundle.findUnique({
      where: { slug: dto.bundleSlug },
      include: { items: true },
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    if (!bundle.isActive) {
      throw new BadRequestException('Bundle is not currently available');
    }
    if (!bundle.availableSizes.includes(dto.size)) {
      throw new BadRequestException(
        `Size ${dto.size} is not offered for this bundle`,
      );
    }
    await this.assertBundleStock(bundle.items, dto.size, dto.quantity);

    if (userId) {
      return this.addBundleToUserCart(
        userId,
        bundle.id,
        dto.size,
        dto.quantity,
      );
    }
    if (sessionId) {
      return this.addBundleToGuestCart(
        sessionId,
        bundle,
        dto.size,
        dto.quantity,
      );
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

    const guestItems: GuestCartItem[] = JSON.parse(guestCartData);

    // Pre-fetch every variant referenced by variant lines in one query
    // (LR-001 BUG #11). The pre-LR-001 shape did one findUnique per item
    // which was O(N) DB calls during signup-time merge — bounded by a
    // small typical cart today but unbounded as catalog growth pushes
    // larger guest carts. Bundle lines skip this lookup; they route
    // through addBundleItem which does its own bundle-scoped validation.
    const variantItems = guestItems.filter(
      (item): item is GuestCartItem & { variantId: string } =>
        !item.bundleId && !!item.variantId,
    );
    const variantStockMap = new Map<
      string,
      { stock: number; productId: string }
    >();
    if (variantItems.length > 0) {
      const variants = await this.prisma.productVariant.findMany({
        where: { id: { in: variantItems.map((i) => i.variantId) } },
        select: { id: true, stock: true, productId: true },
      });
      for (const v of variants) {
        variantStockMap.set(v.id, {
          stock: v.stock,
          productId: v.productId,
        });
      }
    }

    for (const item of guestItems) {
      if (item.bundleId && item.bundleSlug && item.bundleSize) {
        try {
          await this.addBundleItem(
            {
              bundleSlug: item.bundleSlug,
              size: item.bundleSize,
              quantity: item.quantity,
            },
            userId,
            undefined,
          );
        } catch (err) {
          this.logger.warn(
            `mergeGuestCart: skipping bundle ${item.bundleSlug} size ${item.bundleSize}: ${(err as Error).message}`,
          );
        }
        continue;
      }
      if (!item.variantId) {
        this.logger.warn(
          'mergeGuestCart: skipping malformed item (no variantId, no bundle)',
        );
        continue;
      }
      const meta = variantStockMap.get(item.variantId);
      if (!meta) {
        this.logger.warn(
          `mergeGuestCart: skipping missing variant ${item.variantId}`,
        );
        continue;
      }
      if (meta.stock <= 0) {
        this.logger.warn(
          `mergeGuestCart: skipping out-of-stock variant ${item.variantId}`,
        );
        continue;
      }
      const cappedQty = Math.min(
        item.quantity,
        meta.stock,
        CartService.MAX_QUANTITY_PER_ITEM,
      );
      if (cappedQty !== item.quantity) {
        this.logger.log(
          `mergeGuestCart: capped variant ${item.variantId} from ${item.quantity} to ${cappedQty}`,
        );
      }
      await this.addToUserCart(userId, {
        productId: meta.productId,
        variantId: item.variantId,
        quantity: cappedQty,
      });
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
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    images: true,
                    price: true,
                  },
                },
              },
            },
            bundle: {
              include: {
                items: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        images: true,
                        price: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!cart) return { items: [], total: 0 };
    const total = cart.items.reduce((sum, item) => {
      if (item.bundleId && item.bundle) {
        return sum + item.bundle.bundlePrice * item.quantity;
      }
      if (item.variant) {
        const price = Number(
          item.variant.price ?? item.variant.product.price ?? 0,
        );
        return sum + price * item.quantity;
      }
      return sum;
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

    // Derive productId from variant — never trust client-supplied productId.
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      select: { productId: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: variant.productId,
        variantId: dto.variantId,
        quantity: dto.quantity,
      },
    });
  }

  private async addBundleToUserCart(
    userId: string,
    bundleId: string,
    bundleSize: string,
    quantity: number,
  ) {
    let cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await this.prisma.cart.create({ data: { userId } });
    }

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, bundleId, bundleSize },
    });
    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        bundleId,
        bundleSize,
        quantity,
      },
    });
  }

  // ─── Guest Cart ───────────────────────────────────────────────────────────

  private async getGuestCart(sessionId: string) {
    const data = await this.redis.get(`cart:${sessionId}`);
    return {
      items: data ? (JSON.parse(data) as GuestCartItem[]) : [],
      total: 0,
    };
  }

  private async addToGuestCart(
    sessionId: string,
    dto: AddToCartDto,
    variant: { size: string; color: string },
  ) {
    const data = await this.redis.get(`cart:${sessionId}`);
    const items: GuestCartItem[] = data ? JSON.parse(data) : [];

    const existing = items.find(
      (i) => !i.bundleId && i.variantId === dto.variantId,
    );
    if (existing) {
      existing.quantity += dto.quantity;
    } else {
      items.push({
        productId: dto.productId,
        variantId: dto.variantId,
        variantName: `${variant.size} / ${variant.color}`,
        quantity: dto.quantity,
      });
    }

    await this.redis.setex(
      `cart:${sessionId}`,
      GUEST_CART_TTL_SECONDS,
      JSON.stringify(items),
    );
    return { items };
  }

  private async addBundleToGuestCart(
    sessionId: string,
    bundle: {
      id: string;
      slug: string;
      name: string;
      bundlePrice: number;
      image: string | null;
    },
    bundleSize: string,
    quantity: number,
  ) {
    const data = await this.redis.get(`cart:${sessionId}`);
    const items: GuestCartItem[] = data ? JSON.parse(data) : [];

    const existing = items.find(
      (i) => i.bundleId === bundle.id && i.bundleSize === bundleSize,
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        bundleId: bundle.id,
        bundleSlug: bundle.slug,
        bundleName: bundle.name,
        bundleSize,
        bundlePrice: bundle.bundlePrice,
        bundleImage: bundle.image ?? null,
        quantity,
      });
    }

    await this.redis.setex(
      `cart:${sessionId}`,
      GUEST_CART_TTL_SECONDS,
      JSON.stringify(items),
    );
    return { items };
  }

  // ─── Bundle stock validation ──────────────────────────────────────────────

  private async assertBundleStock(
    items: { productId: string; color: string }[],
    size: string,
    quantity: number,
  ): Promise<void> {
    // OR of exact (productId, color, size) tuples — fetches only the
    // constituent variants we care about, not the cross-product of
    // productIds x colors. Matches the bundle's own unique key shape
    // (BundleItem (bundleId, productId, color)).
    const variants = await this.prisma.productVariant.findMany({
      where: {
        OR: items.map((item) => ({
          productId: item.productId,
          color: item.color,
          size,
          deletedAt: null,
        })),
      },
      select: { productId: true, color: true, stock: true },
    });
    const stockMap = new Map<string, number>(
      variants.map((v) => [`${v.productId}:${v.color}`, v.stock]),
    );
    for (const item of items) {
      const stock = stockMap.get(`${item.productId}:${item.color}`);
      if (stock === undefined) {
        throw new ConflictException(
          `Bundle item ${item.productId} ${item.color}/${size} has no matching variant`,
        );
      }
      if (stock < quantity) {
        throw new ConflictException(
          `Bundle item ${item.productId} ${item.color}/${size} has insufficient stock (have ${stock}, need ${quantity})`,
        );
      }
    }
  }
}

export interface GuestCartItem {
  // Variant-line fields.
  productId?: string;
  variantId?: string;
  variantName?: string;
  // Bundle-line fields.
  bundleId?: string;
  bundleSlug?: string;
  bundleName?: string;
  bundleSize?: string;
  bundlePrice?: number;
  bundleImage?: string | null;
  // Common.
  quantity: number;
}
