import type { PrismaService } from '../prisma/prisma.service';
import { DiscountType } from '@prisma/client';

export interface CampaignPriceInfo {
  readonly campaignId: string;
  readonly campaignSlug: string;
  readonly campaignName: string;
  readonly campaignType: string;
  readonly discountType: DiscountType;
  readonly discountValue: number;
  // Already-computed final price for this product under the campaign.
  // Decimal types from Prisma are coerced to number via `.toNumber()` at
  // the call site for stable comparison/arithmetic across the codebase.
  readonly finalPrice: number;
  readonly savingsPercent: number;
}

/**
 * Compute the discounted price for one product under one campaign rule.
 * Floors negatives at 0 — a $50 FIXED_AMOUNT discount on a $30 product
 * yields $0, not -$20. Caller decides whether to floor at a minimum
 * order value or honour the zero.
 */
function applyDiscount(
  basePrice: number,
  type: DiscountType,
  value: number,
): number {
  if (type === DiscountType.PERCENTAGE) {
    const off = (basePrice * value) / 100;
    return Math.max(0, basePrice - off);
  }
  if (type === DiscountType.FIXED_AMOUNT) {
    return Math.max(0, basePrice - value);
  }
  // FREE_SHIPPING doesn't affect product price — leave as-is. (Campaign
  // currently has no shipping context; included for completeness.)
  return basePrice;
}

/**
 * Fetch the active-now campaign discount (if any) for each productId in
 * the input list. Returns a map keyed by productId. Products without an
 * active campaign are absent from the map.
 *
 * "Active now" means: Campaign.isActive AND now is within [startDate, endDate].
 * If a product is in multiple active campaigns the cheapest finalPrice wins
 * — customers always see the best offer the store has on right now.
 */
export async function fetchActiveCampaignPrices(
  prisma: PrismaService,
  productIds: readonly string[],
): Promise<Map<string, CampaignPriceInfo>> {
  if (productIds.length === 0) return new Map();
  const now = new Date();
  const rows = await prisma.campaignProduct.findMany({
    where: {
      productId: { in: [...productIds] },
      campaign: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    },
    include: {
      product: { select: { price: true } },
      campaign: {
        select: { id: true, slug: true, name: true, type: true },
      },
    },
  });

  const result = new Map<string, CampaignPriceInfo>();
  for (const row of rows) {
    const basePrice = Number(row.product.price);
    const finalPrice = applyDiscount(
      basePrice,
      row.discountType,
      Number(row.discountValue),
    );
    if (finalPrice >= basePrice) continue; // never "increase" a price
    const info: CampaignPriceInfo = {
      campaignId: row.campaign.id,
      campaignSlug: row.campaign.slug,
      campaignName: row.campaign.name,
      campaignType: row.campaign.type,
      discountType: row.discountType,
      discountValue: Number(row.discountValue),
      finalPrice,
      savingsPercent:
        basePrice > 0
          ? Math.round(((basePrice - finalPrice) / basePrice) * 100)
          : 0,
    };
    const existing = result.get(row.productId);
    if (!existing || info.finalPrice < existing.finalPrice) {
      result.set(row.productId, info);
    }
  }
  return result;
}

/**
 * Convenience for the single-product hot path (PDP). Returns null if no
 * active campaign applies.
 */
export async function fetchActiveCampaignPriceForProduct(
  prisma: PrismaService,
  productId: string,
): Promise<CampaignPriceInfo | null> {
  const map = await fetchActiveCampaignPrices(prisma, [productId]);
  return map.get(productId) ?? null;
}
