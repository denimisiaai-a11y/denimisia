import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.decorator';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let redis: { set: jest.Mock };

  const mockReview = {
    id: 'rev-1',
    userId: 'user-1',
    productId: 'prod-1',
    rating: 5,
    title: 'Great product',
    body: 'Love these jeans',
    images: [],
    isVerified: true,
    helpfulCount: 0,
    createdAt: new Date('2025-01-01'),
    user: { firstName: 'Test', lastName: 'User' },
  };

  beforeEach(async () => {
    prisma = {
      review: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      orderItem: {
        findFirst: jest.fn(),
      },
    };

    redis = { set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(ReviewsService);
  });

  // ─── getProductReviews ────────────────────────────────────────────────────

  describe('getProductReviews', () => {
    it('only returns isApproved=true reviews on the public listing', async () => {
      prisma.review.findMany.mockResolvedValue([mockReview]);
      prisma.review.count.mockResolvedValue(1);
      prisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { rating: 1 } },
      ]);

      const result = await service.getProductReviews('prod-1', 1, 10);

      // The public listing filters on isApproved=true - pending and
      // rejected (deleted) reviews must not surface on the storefront.
      // findMany, count, and groupBy must all share the same where shape.
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod-1', isApproved: true },
          skip: 0,
          take: 10,
        }),
      );
      expect(prisma.review.count).toHaveBeenCalledWith({
        where: { productId: 'prod-1', isApproved: true },
      });
      expect(prisma.review.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'prod-1', isApproved: true },
        }),
      );
      expect(result).toEqual({
        reviews: [mockReview],
        total: 1,
        page: 1,
        limit: 10,
        ratingBreakdown: [{ rating: 5, _count: { rating: 1 } }],
      });
    });
  });

  // ─── createReview ─────────────────────────────────────────────────────────

  describe('createReview', () => {
    it('should create a verified review when user has purchased', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi-1' });
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue(mockReview);

      const dto = {
        productId: 'prod-1',
        rating: 5,
        title: 'Great product',
        body: 'Love these jeans',
      };

      const result = await service.createReview('user-1', dto as any);

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          productId: 'prod-1',
          rating: 5,
          title: 'Great product',
          body: 'Love these jeans',
          images: [],
          isVerified: true,
        },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      });
      expect(result).toEqual(mockReview);
    });

    // S8 enforcement: a non-purchaser cannot review. The lenient "create
    // unverified review" path was dropped 2026-05-17 — the previous behavior
    // (any logged-in user could review with isVerified=false) made fake
    // reviews trivial. Now POST /reviews returns 403 if the user has no
    // DELIVERED OrderItem for the product.
    it('rejects review when user has not purchased the product (S8)', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.orderItem.findFirst.mockResolvedValue(null);

      await expect(
        service.createReview('user-1', {
          productId: 'prod-1',
          rating: 4,
          body: 'Looks nice',
        } as any),
      ).rejects.toThrow(ForbiddenException);
      // Must not even read review.findUnique — the gate trips first.
      expect(prisma.review.findUnique).not.toHaveBeenCalled();
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.createReview('user-1', { productId: 'prod-999' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user already reviewed', async () => {
      // Purchase confirmed (mockResolvedValue returns the orderItem) so we
      // can reach the "already reviewed" check.
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi-1' });
      prisma.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.createReview('user-1', { productId: 'prod-1' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── updateReview ─────────────────────────────────────────────────────────

  describe('updateReview', () => {
    it('should update review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReview);
      prisma.review.update.mockResolvedValue({ ...mockReview, rating: 4 });

      const result = await service.updateReview('user-1', 'rev-1', {
        rating: 4,
      } as any);

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
        data: { rating: 4 },
      });
      expect(result.rating).toBe(4);
    });

    it('should throw NotFoundException when review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(
        service.updateReview('user-1', 'rev-999', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when editing another user review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReview);

      await expect(
        service.updateReview('other-user', 'rev-1', {} as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── deleteReview ─────────────────────────────────────────────────────────

  describe('deleteReview', () => {
    it('should delete own review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReview);
      prisma.review.delete.mockResolvedValue(mockReview);

      await service.deleteReview('user-1', 'rev-1');

      expect(prisma.review.delete).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
      });
    });

    it('should allow admin to delete any review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReview);
      prisma.review.delete.mockResolvedValue(mockReview);

      await service.deleteReview('admin-1', 'rev-1', true);

      expect(prisma.review.delete).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
      });
    });

    it('should throw NotFoundException when review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.deleteReview('user-1', 'rev-999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when deleting another user review', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReview);

      await expect(service.deleteReview('other-user', 'rev-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── markHelpful ──────────────────────────────────────────────────────────

  describe('markHelpful', () => {
    it('should increment helpful count on first vote per user', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReview);
      // Redis SET NX returns 'OK' for first-time votes.
      redis.set.mockResolvedValue('OK');
      prisma.review.update.mockResolvedValue({
        ...mockReview,
        helpfulCount: 1,
      });

      const result = await service.markHelpful('rev-1', 'user-1');

      expect(redis.set).toHaveBeenCalledWith(
        'review_helpful:rev-1:user-1',
        '1',
        'EX',
        expect.any(Number),
        'NX',
      );
      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
        data: { helpfulCount: { increment: 1 } },
      });
      expect(result.helpfulCount).toBe(1);
    });

    it('should NOT increment again when same user votes twice (dedup)', async () => {
      prisma.review.findUnique.mockResolvedValue(mockReview);
      // SET NX returns null when key already exists → user already voted.
      redis.set.mockResolvedValue(null);

      const result = await service.markHelpful('rev-1', 'user-1');

      expect(prisma.review.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockReview);
    });

    it('should throw NotFoundException when review not found', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.markHelpful('rev-999', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getAllReviews ────────────────────────────────────────────────────────

  describe('getAllReviewsAdmin', () => {
    const adminReview = {
      ...mockReview,
      user: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      },
      product: { name: 'Jeans', slug: 'jeans' },
    };

    it('returns all statuses when approved filter is undefined', async () => {
      prisma.review.findMany.mockResolvedValue([adminReview]);
      prisma.review.count.mockResolvedValue(1);

      const result = await service.getAllReviewsAdmin(1, 20);

      // No isApproved key in the where clause when no filter passed.
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result).toEqual({
        reviews: [adminReview],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('filters to pending-only when approved=false (moderation queue)', async () => {
      prisma.review.findMany.mockResolvedValue([adminReview]);
      prisma.review.count.mockResolvedValue(1);

      await service.getAllReviewsAdmin(1, 20, false);

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isApproved: false } }),
      );
      expect(prisma.review.count).toHaveBeenCalledWith({
        where: { isApproved: false },
      });
    });

    it('filters to approved-only when approved=true', async () => {
      prisma.review.findMany.mockResolvedValue([adminReview]);
      prisma.review.count.mockResolvedValue(1);

      await service.getAllReviewsAdmin(1, 20, true);

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isApproved: true } }),
      );
    });
  });

  // ─── setReviewApproval (admin moderation) ─────────────────────────────────

  describe('setReviewApproval', () => {
    it('approves a pending review', async () => {
      prisma.review.findUnique.mockResolvedValue({
        ...mockReview,
        isApproved: false,
      });
      prisma.review.update.mockResolvedValue({
        ...mockReview,
        isApproved: true,
      });

      const result = await service.setReviewApproval('rev-1', true);

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev-1' },
        data: { isApproved: true },
        include: expect.any(Object),
      });
      expect(result.isApproved).toBe(true);
    });

    it('un-approves a published review (pull it back to pending)', async () => {
      prisma.review.findUnique.mockResolvedValue({
        ...mockReview,
        isApproved: true,
      });
      prisma.review.update.mockResolvedValue({
        ...mockReview,
        isApproved: false,
      });

      await service.setReviewApproval('rev-1', false);

      expect(prisma.review.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isApproved: false } }),
      );
    });

    it('throws NotFoundException when review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.setReviewApproval('rev-999', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
