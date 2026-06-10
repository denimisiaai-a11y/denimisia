import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CollectionTypeDto {
  DROP = 'DROP',
  EDIT = 'EDIT',
  AUTO = 'AUTO',
  PROMO = 'PROMO',
}

export enum HeroLayoutDto {
  FULL_BLEED = 'FULL_BLEED',
  SPLIT = 'SPLIT',
  VIDEO = 'VIDEO',
  MINIMAL = 'MINIMAL',
}

export enum CollectionSortDto {
  MANUAL = 'MANUAL',
  NEWEST = 'NEWEST',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  BESTSELLING = 'BESTSELLING',
}

export class AutoRulesDto {
  @IsOptional() @IsArray() @IsString({ each: true })
  includeCategoryIds?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  includeTags?: string[];

  @IsOptional() @IsBoolean()
  includeIfBestseller?: boolean;

  @IsOptional() @IsBoolean()
  includeIfNewArrival?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(365)
  newArrivalDays?: number;

  @IsOptional() @IsBoolean()
  onSaleOnly?: boolean;

  @IsOptional() @IsBoolean()
  inStockOnly?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true })
  excludeProductIds?: string[];

  @IsOptional() @IsInt() @Min(1) @Max(200)
  maxProducts?: number;
}

export class FilterConfigDto {
  @IsOptional() @IsBoolean() size?: boolean;
  @IsOptional() @IsBoolean() color?: boolean;
  @IsOptional() @IsBoolean() price?: boolean;
  @IsOptional() @IsBoolean() fit?: boolean;
}

export class CreateCollectionDto {
  @IsString() @Length(2, 80)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens only',
  })
  slug!: string;

  @IsOptional() @IsEnum(CollectionTypeDto)
  type?: CollectionTypeDto;

  @IsOptional() @IsString()
  subtitle?: string;

  @IsOptional() @IsString()
  description?: string;
}

export class UpdateCollectionDto {
  // BASICS
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/) slug?: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() internalNote?: string;
  @IsOptional() @IsEnum(CollectionTypeDto) type?: CollectionTypeDto;

  // VISUALS
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() heroImageDesktop?: string;
  @IsOptional() @IsString() heroImageMobile?: string;
  @IsOptional() @IsString() heroVideo?: string;
  @IsOptional() @IsString() heroTextColor?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) heroOverlay?: number;
  @IsOptional() @IsString() heroAlign?: string;
  @IsOptional() @IsString() backgroundColor?: string;

  // LAYOUT
  @IsOptional() @IsEnum(HeroLayoutDto) heroLayout?: HeroLayoutDto;
  @IsOptional() @IsInt() @Min(1) @Max(6) gridColumnsDesktop?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3) gridColumnsMobile?: number;
  @IsOptional() @IsEnum(CollectionSortDto) defaultSort?: CollectionSortDto;
  @IsOptional() @IsBoolean() showFilters?: boolean;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => FilterConfigDto)
  filterConfig?: FilterConfigDto;
  @IsOptional() @IsBoolean() showCountdown?: boolean;
  @IsOptional() @IsBoolean() showSocialProof?: boolean;
  @IsOptional() @IsBoolean() showRelated?: boolean;

  // SCHEDULE & VISIBILITY
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsBoolean() prelaunchTeaser?: boolean;
  @IsOptional() @IsString() postEndBehavior?: string;
  @IsOptional() @IsString() postEndRedirect?: string;
  @IsOptional() @IsString() visibility?: string;

  // PRODUCTS / AUTO
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AutoRulesDto)
  autoRules?: AutoRulesDto;

  // SEO / MARKETING
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsString() ogImage?: string;
  @IsOptional() @IsBoolean() showInNav?: boolean;
  @IsOptional() @IsInt() navOrder?: number;
  @IsOptional() @IsBoolean() isFeaturedHome?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(5) homepageSlot?: number;
  @IsOptional() @IsBoolean() showAsRail?: boolean;
  @IsOptional() @IsString() railTitle?: string;
  @IsOptional() @IsString() promoCode?: string;
  @IsOptional() @IsString() utmSource?: string;
}

export class AddProductsToCollectionDto {
  @IsArray() @IsString({ each: true })
  productIds!: string[];
}

export class ReorderProductsDto {
  @IsArray() @IsString({ each: true })
  productIds!: string[];
}

export class LookbookHotspotDto {
  @IsOptional() x?: number;
  @IsOptional() y?: number;
  @IsOptional() @IsString() productId?: string;
}

export class UpsertLookbookItemDto {
  @IsString()
  imageUrl!: string;

  @IsOptional() @IsString() caption?: string;
  @IsOptional() @IsString() altText?: string;
  @IsOptional() @IsInt() position?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LookbookHotspotDto)
  hotspots?: LookbookHotspotDto[];
}
