import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurationSource } from '@prisma/client';

const CUID_PATTERN = /^c[a-z0-9]{24}$/;

export class UpsertCurationDto {
  @IsString() @MaxLength(100) label!: string;
  @IsEnum(CurationSource) sourceMode!: CurationSource;
  @IsOptional() @IsString() collectionId?: string | null;
  @IsOptional() @IsString() @MaxLength(200) heading?: string;
  @IsOptional() @IsString() @MaxLength(500) subheading?: string;
  @IsOptional() @IsString() @MaxLength(100) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) ctaHref?: string;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxItems?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AddSectionProductDto {
  @IsString()
  @Matches(CUID_PATTERN, { message: 'productId must be a valid cuid' })
  productId!: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsBoolean() isPinned?: boolean;
}

export class UpdateSectionProductDto {
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsString() customImageAssetId?: string | null;
}

export class ReorderSectionProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Matches(CUID_PATTERN, {
    each: true,
    message: 'each orderedProductId must be a valid cuid',
  })
  orderedProductIds!: string[];
}

export class BulkAddProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Matches(CUID_PATTERN, {
    each: true,
    message: 'each productId must be a valid cuid',
  })
  productIds!: string[];
}
