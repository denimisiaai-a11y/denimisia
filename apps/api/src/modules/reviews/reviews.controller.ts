import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './reviews.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get('product/:productId')
  getProductReviews(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const safeLimit = Math.min(Number(limit) || 10, 100);
    return this.reviewsService.getProductReviews(
      productId,
      Number(page) || 1,
      safeLimit,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createReview(@CurrentUser() user: any, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updateReview(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateReview(user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteReview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reviewsService.deleteReview(user.id, id);
  }

  @Patch(':id/helpful')
  @UseGuards(JwtAuthGuard)
  markHelpful(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reviewsService.markHelpful(id, user.id);
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  getAllReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    // approved=false drives the moderation queue (pending reviews only);
    // omit for the full mixed list.
    @Query('approved') approved?: string,
  ) {
    const safeLimit = Math.min(Number(limit) || 20, 100);
    const approvedFilter =
      approved === 'true' ? true : approved === 'false' ? false : undefined;
    return this.reviewsService.getAllReviewsAdmin(
      Number(page) || 1,
      safeLimit,
      approvedFilter,
    );
  }

  // Admin moderation: approve or un-approve a review. Body shape is
  // { isApproved: boolean }. Hard-rejection (delete) goes through
  // DELETE /admin/:id below.
  @Patch('admin/:id/approval')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  setReviewApproval(
    @Param('id') id: string,
    @Body() body: { isApproved: boolean },
  ) {
    return this.reviewsService.setReviewApproval(id, body.isApproved);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  adminDeleteReview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reviewsService.deleteReview(user.id, id, true);
  }
}
