import {
  IsString,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  IsPositive,
  IsEnum,
  ValidateNested,
  Min,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '@prisma/client';

/**
 * Single (dimension, value) tag attached to a product — drives the bot's
 * attribute-based product finder. `dimension` is a TagDimension enum value
 * (kept as string here so this file doesn't import Prisma enums into the
 * DTO surface; the service narrows it before insert).
 */
export class ProductTagDto {
  @IsString()
  @IsNotEmpty()
  dimension!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

/**
 * Single row of a product's size chart. `sizeKey` matches a variant `size`
 * (e.g. "30", "M") so the bot can join from a recommended size back to the
 * variant on the PDP. `dimension` is free-form ("waist", "chest", etc.).
 */
export class SizeChartEntryDto {
  @IsString()
  @IsNotEmpty()
  sizeKey!: string;

  @IsString()
  @IsNotEmpty()
  dimension!: string;

  @IsNumber()
  bodyValueIn!: number;

  @IsNumber()
  garmentValueIn!: number;
}

// Same cuid shape used by CreateBundleDto. Duplicated here so the inline
// bundle field on CreateProductDto stays self-contained — class-validator
// doesn't share constraint metadata across files cleanly.
const CUID_PATTERN = /^c[a-z0-9]{24}$/;

/**
 * Inline bundle composer payload — when present on CreateProductDto, the
 * service wraps product + bundle creation in a single $transaction so a
 * failed bundle never leaves the new product orphaned.
 *
 * `additionalProductIds` excludes the new product itself; the service
 * prepends `created.id` after the product row is created.
 */
export class InlineBundleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  badgeText: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsArray()
  @ArrayMaxSize(49)
  @Matches(CUID_PATTERN, {
    each: true,
    message: 'each additionalProductId must be a valid cuid',
  })
  additionalProductIds: string[];
}

export class CreateVariantDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsString()
  @IsNotEmpty()
  size: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  // Optional hex (e.g. "#94a2b2") shown as a solid storefront swatch.
  // Validated as a 3- or 6-digit CSS hex so admin-input garbage cannot
  // leak into inline `style.backgroundColor` on the PDP.
  @IsOptional()
  @IsString()
  @Matches(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'colorHex must be a CSS hex color like #abc or #aabbcc',
  })
  colorHex?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  compareAtPrice?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  showStarBadge?: boolean;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => InlineBundleDto)
  bundle?: InlineBundleDto;

  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductTagDto)
  productTags?: ProductTagDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeChartEntryDto)
  sizeCharts?: SizeChartEntryDto[];

  @IsOptional()
  @IsObject()
  fitLandmarks?: Record<string, any>;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  compareAtPrice?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  showStarBadge?: boolean;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductTagDto)
  productTags?: ProductTagDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeChartEntryDto)
  sizeCharts?: SizeChartEntryDto[];

  @IsOptional()
  @IsObject()
  fitLandmarks?: Record<string, any>;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'colorHex must be a CSS hex color like #abc or #aabbcc',
  })
  colorHex?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  /**
   * Comma-separated category slugs, OR-combined (e.g.
   * "pants-denims,pants-trousers"). Drives the multi-select Product Type
   * filter on /series/[type]. If both `category` and `categories` are sent,
   * the single `category` takes precedence.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^[a-z0-9-]+(?:,[a-z0-9-]+){0,19}$/, {
    message:
      'categories must be 1-20 comma-separated lowercase slugs ([a-z0-9-])',
  })
  categories?: string;

  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @IsBoolean()
  newArrival?: boolean;

  @IsOptional()
  @IsString()
  minPrice?: string;

  @IsOptional()
  @IsString()
  maxPrice?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  /**
   * Free-text search. Comma-separated tokens are OR-combined. Each token
   * matches against product name, product slug, and any variant SKU
   * (prefix match) so admins can paste a list like "20007,2121" to pull
   * a few specific products.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
