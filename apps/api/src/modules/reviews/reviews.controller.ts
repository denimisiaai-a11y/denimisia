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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  getAllReviews(@Query('page') page?: string, @Query('limit') limit?: string) {
    const safeLimit = Math.min(Number(limit) || 20, 100);
    return this.reviewsService.getAllReviews(Number(page) || 1, safeLimit);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  adminDeleteReview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reviewsService.deleteReview(user.id, id, true);
  }
}
