import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
} from 'class-validator';

const CUID_PATTERN = /^c[a-z0-9]{24}$/;

class AddToWishlistDto {
  @IsString()
  @IsNotEmpty()
  @Matches(CUID_PATTERN, { message: 'productId must be a valid cuid' })
  productId!: string;
}

class BulkAddToWishlistDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Matches(CUID_PATTERN, {
    each: true,
    message: 'each productId must be a valid cuid',
  })
  productIds!: string[];
}

@Controller('wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  // ─── Public shared view ────────────────────────────────────────────────────
  @Get('shared/:token')
  getShared(@Param('token') token: string) {
    return this.wishlistService.getPublicByToken(token);
  }

  // ─── Authenticated routes ──────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get()
  getWishlist(@CurrentUser() user: any) {
    return this.wishlistService.getWishlist(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('items')
  addItem(@CurrentUser() user: any, @Body() dto: AddToWishlistDto) {
    return this.wishlistService.addItem(user.id, dto.productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('items/bulk')
  bulkAdd(@CurrentUser() user: any, @Body() dto: BulkAddToWishlistDto) {
    return this.wishlistService.bulkAdd(user.id, dto.productIds);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('items/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(@CurrentUser() user: any, @Param('productId') productId: string) {
    return this.wishlistService.removeItem(user.id, productId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('share')
  createShareToken(@CurrentUser() user: any) {
    return this.wishlistService.getOrCreateShareToken(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('share')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeShare(@CurrentUser() user: any) {
    return this.wishlistService.revokeShareToken(user.id);
  }
}
