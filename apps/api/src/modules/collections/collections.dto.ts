import {
  ArrayMaxSize,
  ArrayMinSize,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  Matches,
  MaxLength,
} from 'class-validator';

const CUID_PATTERN = /^c[a-z0-9]{24}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase alphanumeric, hyphen-separated',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase alphanumeric, hyphen-separated',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AddProductsToCollectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Matches(CUID_PATTERN, {
    each: true,
    message: 'each productId must be a valid cuid',
  })
  productIds!: string[];
}
