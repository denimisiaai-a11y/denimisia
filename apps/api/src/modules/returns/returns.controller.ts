import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
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

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @UsePipes(new ZodValidationPipe(createReturnSchema))
  async create(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returns.createReturn({ userId: user?.id ?? null, dto });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async myReturns(@CurrentUser() user: { id: string }) {
    return this.returns.getMyReturns(user.id);
  }

  @Get(':rtnNumber')
  @UseGuards(OptionalJwtAuthGuard)
  async lookup(
    @Param('rtnNumber') rtnNumber: string,
    @CurrentUser() user: { id: string } | null,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    return this.returns.getByRtnNumber({
      rtnNumber,
      userId: user?.id ?? null,
      guestEmail: email,
      guestPhone: phone,
    });
  }

  @Post(':rtnNumber/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  @UsePipes(new ZodValidationPipe(cancelReturnSchema))
  async cancel(
    @Param('rtnNumber') rtnNumber: string,
    @CurrentUser() user: { id: string } | null,
    @Body() body: CancelReturnDto,
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
