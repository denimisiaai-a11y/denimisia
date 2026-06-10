import { Injectable } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  FIT_PREF_PENALTY,
  SIZE_TIE_TOLERANCE,
  MAX_PRODUCTS_RETURNED,
  MAX_SIZING_CANDIDATES,
} from './bot.constants';
import { formatFitStyleNote } from './bot.fit-style';

type FitPref = 'slim' | 'regular' | 'baggy' | 'fitted' | 'oversized';

export interface RecommendInput {
  type: ProductType;
  measurements: Record<string, number>;
  fitPref: FitPref;
}

export interface RecommendResult {
  recommendedSize: string | null;
  alternativeSize?: string;
  products: unknown[];
}

interface SizeChartRow {
  sizeKey: string;
  dimension: string;
  bodyValueIn: number;
}

interface VariantRow {
  size: string;
  stock: number;
}

interface ProductWithCharts {
  sizeCharts: SizeChartRow[];
  variants: VariantRow[];
}

@Injectable()
export class BotSizingService {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(input: RecommendInput): Promise<RecommendResult> {
    const products = (await this.prisma.product.findMany({
      where: { type: input.type, isActive: true, deletedAt: null },
      include: {
        sizeCharts: {
          select: { sizeKey: true, dimension: true, bodyValueIn: true },
        },
        variants: { select: { size: true, stock: true } },
      },
      take: MAX_SIZING_CANDIDATES,
      orderBy: { createdAt: 'desc' },
    })) as unknown as ProductWithCharts[];

    const scoresBySize = new Map<string, number>();
    const countBySize = new Map<string, number>();

    for (const p of products) {
      const variantSizes = new Set(
        p.variants.filter((v) => v.stock > 0).map((v) => v.size),
      );
      if (variantSizes.size === 0 || p.sizeCharts.length === 0) continue;

      const sizeMap = new Map<string, Map<string, number>>();
      for (const c of p.sizeCharts) {
        if (!sizeMap.has(c.sizeKey)) sizeMap.set(c.sizeKey, new Map());
        sizeMap.get(c.sizeKey)!.set(c.dimension, c.bodyValueIn);
      }

      for (const [sizeKey, dims] of sizeMap) {
        if (!variantSizes.has(sizeKey)) continue;
        let score = 0;
        let dimensionsMatched = 0;
        for (const [dim, body] of Object.entries(input.measurements)) {
          const chart = dims.get(dim);
          if (chart === undefined) continue;
          dimensionsMatched += 1;
          const diff = Math.abs(chart - body);
          score += diff;
          // Fit preference biases the score against the "wrong" direction
          // so the recommendation prefers smaller (slim) or larger (baggy)
          // sizes even when an exact match exists.
          if (input.fitPref === 'slim' && chart >= body) {
            score += diff + FIT_PREF_PENALTY + 1;
          }
          if (input.fitPref === 'baggy' && chart <= body) {
            score += diff + FIT_PREF_PENALTY + 1;
          }
          if (input.fitPref === 'fitted' && chart > body) {
            score += FIT_PREF_PENALTY;
          }
          if (input.fitPref === 'oversized' && chart < body) {
            score += FIT_PREF_PENALTY;
          }
        }
        if (dimensionsMatched === 0) continue;
        const acc = scoresBySize.get(sizeKey) ?? 0;
        scoresBySize.set(sizeKey, acc + score);
        countBySize.set(sizeKey, (countBySize.get(sizeKey) ?? 0) + 1);
      }
    }

    if (scoresBySize.size === 0) {
      return { recommendedSize: null, products: [] };
    }

    const averaged: Array<[string, number]> = [];
    for (const [size, totalScore] of scoresBySize) {
      averaged.push([size, totalScore / (countBySize.get(size) ?? 1)]);
    }
    averaged.sort((a, b) => a[1] - b[1]);
    const [bestSize, bestScore] = averaged[0];
    let alternativeSize: string | undefined;
    if (
      averaged.length > 1 &&
      averaged[1][1] - bestScore <= SIZE_TIE_TOLERANCE
    ) {
      alternativeSize = averaged[1][0];
    }

    const matched = await this.prisma.product.findMany({
      where: {
        type: input.type,
        isActive: true,
        deletedAt: null,
        variants: { some: { size: bestSize, stock: { gt: 0 } } },
      },
      include: { variants: true, sizeCharts: true, productTags: true },
      take: MAX_PRODUCTS_RETURNED,
      orderBy: { createdAt: 'desc' },
    });

    const matchedWithStyle = matched.map((p) => ({
      ...p,
      styleNote: formatFitStyleNote(p.fitLandmarks),
    }));

    return {
      recommendedSize: bestSize,
      alternativeSize,
      products: matchedWithStyle,
    };
  }
}
