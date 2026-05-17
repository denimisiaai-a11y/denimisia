import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../redis/redis.decorator';
import Redis from 'ioredis';
import { CreateReviewDto, UpdateReviewDto } from './reviews.dto';

@Injectable()
export class ReviewsService {
  // 30-day TTL for per-user "helpful" dedup
  private static readonly HELPFUL_TTL_SECONDS = 30 * 24 * 60 * 60;

  constructor(
    private prisma: PrismaService,
    @InjectRedis() private redis: Redis,
  ) {}

  async getProductReviews(productId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    const ratingBreakdown = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId },
      _count: { rating: true },
    });

    return { reviews, total, page, limit, ratingBreakdown };
  }

  async createReview(userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Verify the user has purchased the product.
    // Only DELIVERED counts as verified-buyer — SHIPPED is in-transit and
    // can still be refused/returned. TODO: recompute isVerified if the
    // order is later RETURNED/REFUNDED.
    const hasPurchased = await this.prisma.orderItem.findFirst({
      where: {
        productId: dto.productId,
        order: { userId, status: 'DELIVERED' },
      },
    });

    const existing = await this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId: dto.productId } },
    });
    if (existing)
      throw new ConflictException('You have already reviewed this product');

    return this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        images: dto.images ?? [],
        isVerified: !!hasPurchased,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async updateReview(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId)
      throw new ForbiddenException("Cannot edit another user's review");

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.images !== undefined ? { images: dto.images } : {}),
      },
    });
  }

  async deleteReview(userId: string, reviewId: string, isAdmin = false) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (!isAdmin && review.userId !== userId)
      throw new ForbiddenException('Access denied');

    await this.prisma.review.delete({ where: { id: reviewId } });
  }

  async markHelpful(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');

    // Per-user dedup via Redis: SET NX with 30-day TTL.
    // Schema has no ReviewHelpfulVote table yet — Redis is the simplest correct fix.
    const dedupKey = `review_helpful:${reviewId}:${userId}`;
    const result = await this.redis.set(
      dedupKey,
      '1',
      'EX',
      ReviewsService.HELPFUL_TTL_SECONDS,
      'NX',
    );
    if (result !== 'OK') {
      // Already voted; return current review without incrementing.
      return review;
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { helpfulCount: { increment: 1 } },
    });
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  /**
   * Admin-scope review listing for moderation tooling.
   * ADMIN-ONLY: includes PII (user email). Never call from public endpoints.
   */
  async getAllReviewsAdmin(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          // ADMIN-ONLY: includes PII. Never call from public endpoints.
          user: { select: { email: true, firstName: true, lastName: true } },
          product: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.review.count(),
    ]);
    return { reviews, total, page, limit };
  }

  /** @deprecated Use getAllReviewsAdmin. Kept for backwards compatibility. */
  async getAllReviews(page = 1, limit = 20) {
    return this.getAllReviewsAdmin(page, limit);
  }
}
