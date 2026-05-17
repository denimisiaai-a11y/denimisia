import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let reviewsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    reviewsService = {
      getProductReviews: jest.fn(),
      createReview: jest.fn(),
      updateReview: jest.fn(),
      deleteReview: jest.fn(),
      markHelpful: jest.fn(),
      getAllReviews: jest.fn(),
      getAllReviewsAdmin: jest.fn(),
      setReviewApproval: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: reviewsService }],
    }).compile();

    controller = module.get(ReviewsController);
  });

  it('should get product reviews', async () => {
    reviewsService.getProductReviews.mockResolvedValue({
      reviews: [],
      total: 0,
    });
    const result = await controller.getProductReviews('prod-1', '2', '5');
    expect(reviewsService.getProductReviews).toHaveBeenCalledWith(
      'prod-1',
      2,
      5,
    );
  });

  it('should create review', async () => {
    reviewsService.createReview.mockResolvedValue({ id: 'rev-1' });
    const dto = { productId: 'prod-1', rating: 5, body: 'Great' } as any;
    const result = await controller.createReview({ id: 'user-1' }, dto);
    expect(reviewsService.createReview).toHaveBeenCalledWith('user-1', dto);
  });

  it('should update review', async () => {
    reviewsService.updateReview.mockResolvedValue({ id: 'rev-1' });
    const result = await controller.updateReview({ id: 'user-1' }, 'rev-1', {
      rating: 4,
    } as any);
    expect(reviewsService.updateReview).toHaveBeenCalledWith(
      'user-1',
      'rev-1',
      { rating: 4 },
    );
  });

  it('should delete review', async () => {
    reviewsService.deleteReview.mockResolvedValue(undefined);
    await controller.deleteReview({ id: 'user-1' }, 'rev-1');
    expect(reviewsService.deleteReview).toHaveBeenCalledWith('user-1', 'rev-1');
  });

  it('should mark helpful and forward authenticated userId', async () => {
    reviewsService.markHelpful.mockResolvedValue({
      id: 'rev-1',
      helpfulCount: 1,
    });
    const result = await controller.markHelpful({ id: 'user-1' }, 'rev-1');
    // userId is a mandatory 2nd arg so the service can dedup votes per user.
    expect(reviewsService.markHelpful).toHaveBeenCalledWith('rev-1', 'user-1');
  });

  it('should get all reviews for admin with undefined approved filter', async () => {
    reviewsService.getAllReviewsAdmin.mockResolvedValue({
      reviews: [],
      total: 0,
    });
    await controller.getAllReviews('1', '20');
    expect(reviewsService.getAllReviewsAdmin).toHaveBeenCalledWith(
      1,
      20,
      undefined,
    );
  });

  it('passes approved=false through to the service for the moderation queue', async () => {
    reviewsService.getAllReviewsAdmin.mockResolvedValue({
      reviews: [],
      total: 0,
    });
    await controller.getAllReviews('1', '20', 'false');
    expect(reviewsService.getAllReviewsAdmin).toHaveBeenCalledWith(
      1,
      20,
      false,
    );
  });

  it('passes approved=true through to the service for the approved-only view', async () => {
    reviewsService.getAllReviewsAdmin.mockResolvedValue({
      reviews: [],
      total: 0,
    });
    await controller.getAllReviews('1', '20', 'true');
    expect(reviewsService.getAllReviewsAdmin).toHaveBeenCalledWith(1, 20, true);
  });

  it('admin approves a review via PATCH /admin/:id/approval', async () => {
    reviewsService.setReviewApproval.mockResolvedValue({
      id: 'rev-1',
      isApproved: true,
    });
    const result = await controller.setReviewApproval('rev-1', {
      isApproved: true,
    });
    expect(reviewsService.setReviewApproval).toHaveBeenCalledWith(
      'rev-1',
      true,
    );
    expect(result.isApproved).toBe(true);
  });

  it('admin un-approves a review (pull back to pending)', async () => {
    reviewsService.setReviewApproval.mockResolvedValue({
      id: 'rev-1',
      isApproved: false,
    });
    await controller.setReviewApproval('rev-1', { isApproved: false });
    expect(reviewsService.setReviewApproval).toHaveBeenCalledWith(
      'rev-1',
      false,
    );
  });

  it('should admin delete review', async () => {
    reviewsService.deleteReview.mockResolvedValue(undefined);
    await controller.adminDeleteReview({ id: 'admin-1' }, 'rev-1');
    expect(reviewsService.deleteReview).toHaveBeenCalledWith(
      'admin-1',
      'rev-1',
      true,
    );
  });
});
