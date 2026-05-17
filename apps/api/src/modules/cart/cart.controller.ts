import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CartService } from './cart.service';
import {
  AddToCartDto,
  UpdateCartItemDto,
  AddBundleToCartDto,
} from './cart.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  getCart(@Req() req: Request, @CurrentUser() user?: any) {
    const sessionId = req.cookies?.session_id;
    return this.cartService.getCart(user?.id, sessionId);
  }

  @Post('items')
  @UseGuards(OptionalJwtAuthGuard)
  addItem(
    @Body() dto: AddToCartDto,
    @Req() req: Request,
    @CurrentUser() user?: any,
  ) {
    const sessionId = req.cookies?.session_id;
    return this.cartService.addItem(dto, user?.id, sessionId);
  }

  @Post('bundles')
  @UseGuards(OptionalJwtAuthGuard)
  addBundle(
    @Body() dto: AddBundleToCartDto,
    @Req() req: Request,
    @CurrentUser() user?: any,
  ) {
    const sessionId = req.cookies?.session_id;
    return this.cartService.addBundleItem(dto, user?.id, sessionId);
  }

  @Patch('items/:id')
  @UseGuards(JwtAuthGuard)
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: any,
  ) {
    return this.cartService.updateItem(id, dto, user.id);
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(@Param('id') id: string, @CurrentUser() user: any) {
    return this.cartService.removeItem(id, user.id);
  }

  @Delete()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  clearCart(@Req() req: Request, @CurrentUser() user?: any) {
    const sessionId = req.cookies?.session_id;
    return this.cartService.clearCart(user?.id, sessionId);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mergeCart(@CurrentUser() user: any, @Req() req: Request) {
    // Read session_id exclusively from the signed/httpOnly cookie; never trust client body.
    const sessionId: string | undefined = req.cookies?.session_id;
    if (!sessionId) {
      return { merged: false };
    }
    await this.cartService.mergeGuestCart(user.id, sessionId);
    return { merged: true };
  }
}
