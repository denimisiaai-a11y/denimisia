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
    // Public listing: only APPROVED reviews. Pending + rejected reviews are
    // invisible to the storefront. Admin uses listAllReviews() for the
    // moderation queue. See @@index([productId, isApproved]) on schema for
    // the matching index.
    const where = { productId, isApproved: true };
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    const ratingBreakdown = await this.prisma.review.groupBy({
      by: ['rating'],
      where,
      _count: { rating: true },
    });

    return { reviews, total, page, limit, ratingBreakdown };
  }

  async createReview(userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // Verify the user has purchased the product. Only DELIVERED counts —
    // SHIPPED is in-transit and can still be refused/returned. LR-001
    // amendment S8 hard-requires this gate: no purchase, no review. The
    // verified-buyer badge is preserved as `isVerified` for UI use, but
    // it's now always true (any review that exists must be from a buyer).
    //
    // Guest-checkout orders attach to the new account via the C2 flow
    // (verified email signup); only after that attach does the orderItem
    // match userId here, so guests can review their own purchases as
    // soon as they finish account creation.
    const hasPurchased = await this.prisma.orderItem.findFirst({
      where: {
        productId: dto.productId,
        order: { userId, status: 'DELIVERED' },
      },
    });
    if (!hasPurchased) {
      throw new ForbiddenException(
        'Only customers who have received this product can review it.',
      );
    }

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
        // Always true under S8 enforcement; kept on the row so the UI
        // can render a verified-buyer badge without a join.
        isVerified: true,
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
   *
   * Optional `approved` filter targets the moderation queue:
   *   - undefined (default) -> all reviews regardless of status
   *   - false -> the pending queue (admin's working list)
   *   - true -> already-approved set (for audit / un-approve)
   */
  async getAllReviewsAdmin(page = 1, limit = 20, approved?: boolean) {
    const where = approved === undefined ? {} : { isApproved: approved };
    const skip = (page - 1) * limit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          // ADMIN-ONLY: includes PII. Never call from public endpoints.
          user: { select: { email: true, firstName: true, lastName: true } },
          product: { select: { name: true, slug: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { reviews, total, page, limit };
  }

  /**
   * Admin moderation: approve or un-approve a review. Approval is the
   * publish action; un-approval pulls a previously-public review back into
   * pending (use deleteReview to remove a bad one entirely).
   */
  async setReviewApproval(reviewId: string, isApproved: boolean) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { isApproved },
      include: {
        user: { select: { firstName: true, lastName: true } },
        product: { select: { name: true, slug: true } },
      },
    });
  }

  /** @deprecated Use getAllReviewsAdmin. Kept for backwards compatibility. */
  async getAllReviews(page = 1, limit = 20) {
    return this.getAllReviewsAdmin(page, limit);
  }
}
