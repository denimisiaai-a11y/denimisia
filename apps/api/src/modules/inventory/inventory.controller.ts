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
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
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

  // Full paginated inventory list backing the admin stock dashboard.
  // `bucket` filters by stock level, `search` matches SKU or product name.
  @Get('variants')
  listVariants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('bucket') bucket?: string,
  ) {
    const allowedBuckets = ['all', 'out', 'low', 'healthy'] as const;
    const normalizedBucket = allowedBuckets.includes(
      bucket as (typeof allowedBuckets)[number],
    )
      ? (bucket as (typeof allowedBuckets)[number])
      : undefined;
    return this.inventoryService.listVariants({
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      search: search?.trim() || undefined,
      bucket: normalizedBucket,
    });
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
