import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurationSource } from '@prisma/client';

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
  @IsString() productId!: string;
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
  @IsString({ each: true })
  orderedProductIds!: string[];
}

export class BulkAddProductsDto {
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];
}
