import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDiscountDto,
  UpdateDiscountDto,
  ValidateDiscountDto,
  DiscountType,
} from './discounts.dto';

export interface DiscountValidationSuccess {
  readonly valid: true;
  readonly code: string;
  readonly type: DiscountType;
  readonly value: number;
  readonly discountAmount: number;
}

export interface DiscountValidationFailure {
  readonly valid: false;
  readonly reason: 'INVALID';
}

export type DiscountValidationResult =
  | DiscountValidationSuccess
  | DiscountValidationFailure;

const OPAQUE_FAILURE: DiscountValidationFailure = {
  valid: false,
  reason: 'INVALID',
};

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate a discount code for a given order amount.
   *
   * SECURITY: All failure modes collapse to a single opaque response so that
   * attackers cannot enumerate valid codes by comparing error messages
   * (inactive vs. expired vs. usage-capped vs. min-order-not-met all look
   * identical). Only successful validations return specific details.
   */
  async validate(dto: ValidateDiscountDto): Promise<DiscountValidationResult> {
    const discount = await this.prisma.discount.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (!discount || !discount.isActive) {
      return OPAQUE_FAILURE;
    }

    const now = new Date();
    if (discount.startDate && discount.startDate > now) {
      return OPAQUE_FAILURE;
    }
    if (discount.endDate && discount.endDate < now) {
      return OPAQUE_FAILURE;
    }
    if (
      discount.maxUses !== null &&
      discount.maxUses !== undefined &&
      discount.usedCount >= discount.maxUses
    ) {
      return OPAQUE_FAILURE;
    }
    if (
      discount.minOrderAmount &&
      dto.orderAmount < Number(discount.minOrderAmount)
    ) {
      return OPAQUE_FAILURE;
    }

    // Enforce applicability scopes. A discount created with a non-empty
    // applicableProductIds/applicableCategoryIds list is restricted to those
    // products/categories; failing to match collapses to OPAQUE_FAILURE so the
    // checkout UI cannot fingerprint scoped codes.
    const hasProductScope = discount.applicableProductIds.length > 0;
    const hasCategoryScope = discount.applicableCategoryIds.length > 0;
    if (hasProductScope || hasCategoryScope) {
      const cartProductIds = dto.productIds ?? [];
      const cartCategoryIds = dto.categoryIds ?? [];
      const productMatch =
        hasProductScope &&
        cartProductIds.some((id) => discount.applicableProductIds.includes(id));
      const categoryMatch =
        hasCategoryScope &&
        cartCategoryIds.some((id) =>
          discount.applicableCategoryIds.includes(id),
        );
      if (!productMatch && !categoryMatch) {
        return OPAQUE_FAILURE;
      }
    }

    const value = Number(discount.value);
    const discountAmount =
      discount.type === 'PERCENTAGE'
        ? dto.orderAmount * (value / 100)
        : discount.type === 'FIXED_AMOUNT'
          ? value
          : 0; // FREE_SHIPPING handled at shipping level

    return {
      valid: true,
      code: discount.code,
      type: discount.type as DiscountType,
      value,
      discountAmount: Math.min(discountAmount, dto.orderAmount),
    };
  }

  /**
   * Atomically reserve one use of a discount code. Used by the orders service
   * inside its creation transaction to prevent TOCTOU races on `usedCount`:
   * two concurrent orders can no longer both observe `usedCount < maxUses`
   * and both succeed past the cap.
   *
   * NOTE (for orders.service.ts): call this method inside your order-creation
   * transaction. If `consumed` is false, abort the order with
   * BadRequestException — the code is either gone, inactive, or exhausted.
   */
  async tryConsume(discountId: string): Promise<{ consumed: boolean }> {
    const result = await this.prisma.discount.updateMany({
      where: {
        id: discountId,
        isActive: true,
        OR: [
          { maxUses: null },
          { usedCount: { lt: this.prisma.discount.fields.maxUses } },
        ],
      },
      data: { usedCount: { increment: 1 } },
    });
    return { consumed: result.count > 0 };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  async findAll(page = 1, limit = 20) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const skip = (safePage - 1) * safeLimit;
    const [discounts, total] = await Promise.all([
      this.prisma.discount.findMany({
        orderBy: { id: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.discount.count(),
    ]);
    return { discounts, total, page: safePage, limit: safeLimit };
  }

  async findOne(id: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  async create(dto: CreateDiscountDto) {
    this.assertValueBounds(dto.type, dto.value);

    const code = dto.code.toUpperCase();
    const existing = await this.prisma.discount.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Discount code already exists');

    return this.prisma.discount.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        minOrderAmount: dto.minOrderAmount,
        maxUses: dto.maxUses,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        applicableProductIds: dto.applicableProductIds ?? [],
        applicableCategoryIds: dto.applicableCategoryIds ?? [],
      },
    });
  }

  async update(id: string, dto: UpdateDiscountDto) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');

    if (dto.value !== undefined) {
      this.assertValueBounds(discount.type as DiscountType, dto.value);
    }

    return this.prisma.discount.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.maxUses !== undefined ? { maxUses: dto.maxUses } : {}),
        ...(dto.endDate !== undefined
          ? { endDate: new Date(dto.endDate) }
          : {}),
      },
    });
  }

  async remove(id: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw new NotFoundException('Discount not found');
    await this.prisma.discount.delete({ where: { id } });
  }

  /**
   * Enforce business-logic bounds on discount `value` at the service level as
   * defence-in-depth behind the DTO validators. Percentage discounts over
   * 100% would make orders free (or negative), and absurd fixed amounts can
   * be used to zero out arbitrary order totals.
   */
  private assertValueBounds(type: DiscountType | string, value: number): void {
    if (type === 'PERCENTAGE' && value > 100) {
      throw new BadRequestException('PERCENTAGE discount cannot exceed 100');
    }
    if (type === 'FIXED_AMOUNT' && value > 10_000_000) {
      throw new BadRequestException(
        'FIXED_AMOUNT discount is unreasonably large',
      );
    }
  }
}
