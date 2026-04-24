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
import { Throttle } from '@nestjs/throttler';
import { DiscountsService } from './discounts.service';
import {
  CreateDiscountDto,
  UpdateDiscountDto,
  ValidateDiscountDto,
} from './discounts.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('discounts')
export class DiscountsController {
  constructor(private discountsService: DiscountsService) {}

  /**
   * Validate a discount code for a logged-in checkout.
   *
   * SECURITY: Requires authentication so anonymous traffic cannot enumerate
   * codes. Throttled to 5 attempts / minute per IP to make brute-forcing
   * code space infeasible. The service returns an opaque failure shape so
   * no per-attempt feedback leaks which codes exist.
   */
  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  validate(@Body() dto: ValidateDiscountDto) {
    return this.discountsService.validate(dto);
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const parsedLimit = Math.min(Number(limit) || 20, 200);
    return this.discountsService.findAll(Number(page) || 1, parsedLimit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  findOne(@Param('id') id: string) {
    return this.discountsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() dto: CreateDiscountDto) {
    return this.discountsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDiscountDto) {
    return this.discountsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.discountsService.remove(id);
  }
}
