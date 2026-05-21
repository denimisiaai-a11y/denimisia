import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsObject,
  IsEnum,
  ValidateNested,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HomepageSectionType } from '@prisma/client';

// Accepts absolute http(s) URLs or root-relative paths starting with '/'.
// class-validator's @IsUrl does not accept root-relative paths, so we use
// a regex guard for the combined case and @MaxLength to bound the input.
const URL_OR_ROOT_RELATIVE = /^(?:https?:\/\/[^\s]+|\/[^\s]*)$/;
const URL_MESSAGE =
  'Must be an absolute http(s) URL or root-relative path (e.g. /bundles/foo)';

// ─── Homepage Section Composer ────────────────────────────────────────────────

export class CreateHomepageSectionDto {
  @IsEnum(HomepageSectionType)
  type!: HomepageSectionType;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateHomepageSectionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class SectionOrderItemDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(0)
  position!: number;
}

export class ReorderHomepageSectionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionOrderItemDto)
  orders!: SectionOrderItemDto[];
}

// ─── Global Storefront Styles ─────────────────────────────────────────────────

// 0 = tight, 1 = default, 2 = airy
export class UpdateGlobalStylesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  negativeSpace?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  typographyFlow?: number;
}

// ─── Banners ──────────────────────────────────────────────────────────────────

export class CreateBannerDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  image: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
