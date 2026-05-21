import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReturnsService } from './returns.service';
import { createReturnSchema } from './dto/create-return.dto';
import type { CreateReturnDto } from './dto/create-return.dto';
import { cancelReturnSchema } from './dto/cancel-return.dto';
import type { CancelReturnDto } from './dto/cancel-return.dto';
import { guestLookupSchema } from './dto/guest-lookup.dto';
import type { GuestLookupDto } from './dto/guest-lookup.dto';

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(
    @CurrentUser() user: { id: string } | null,
    @Body(new ZodValidationPipe(createReturnSchema)) dto: CreateReturnDto,
  ) {
    return this.returns.createReturn({ userId: user?.id ?? null, dto });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async myReturns(@CurrentUser() user: { id: string }) {
    return this.returns.getMyReturns(user.id);
  }

  @Get(':rtnNumber')
  @UseGuards(JwtAuthGuard)
  async lookupAuth(
    @Param('rtnNumber') rtnNumber: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.returns.getByRtnNumber({
      rtnNumber,
      userId: user.id,
    });
  }

  @Post(':rtnNumber/lookup')
  async lookupGuest(
    @Param('rtnNumber') rtnNumber: string,
    @Body(new ZodValidationPipe(guestLookupSchema)) body: GuestLookupDto,
  ) {
    return this.returns.getByRtnNumber({
      rtnNumber,
      userId: null,
      guestEmail: body.email,
      guestPhone: body.phone,
    });
  }

  @Post(':rtnNumber/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  async cancel(
    @Param('rtnNumber') rtnNumber: string,
    @CurrentUser() user: { id: string } | null,
    @Body(new ZodValidationPipe(cancelReturnSchema)) body: CancelReturnDto,
  ) {
    await this.returns.cancelReturn({
      userId: user?.id ?? null,
      rtnNumber,
      guestEmail: body.email,
      guestPhone: body.phone,
    });
    return { success: true };
  }
}
