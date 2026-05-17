import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService, AdjustStockDto } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { InventoryType } from '@prisma/client';

const CUID_PATTERN = /^c[a-z0-9]{24}$/;

class AdjustStockBody {
  @IsString()
  @IsNotEmpty()
  @Matches(CUID_PATTERN, { message: 'variantId must be a valid cuid' })
  variantId!: string;

  @IsNumber()
  @Min(-10000)
  @Max(10000)
  quantity!: number;

  @IsEnum(InventoryType)
  type!: InventoryType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  note?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('summary')
  getSummary() {
    return this.inventoryService.getInventorySummary();
  }

  @Get('low-stock')
  getLowStock(@Query('threshold') threshold?: string) {
    return this.inventoryService.getLowStockVariants(Number(threshold) || 5);
  }

  @Get('logs/:variantId')
  getVariantLogs(
    @Param('variantId') variantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(Number(limit) || 20, 200);
    return this.inventoryService.getVariantLogs(
      variantId,
      Number(page) || 1,
      parsedLimit,
    );
  }

  @Post('adjust')
  adjustStock(@Body() dto: AdjustStockBody) {
    return this.inventoryService.adjustStock(dto as AdjustStockDto);
  }
}
