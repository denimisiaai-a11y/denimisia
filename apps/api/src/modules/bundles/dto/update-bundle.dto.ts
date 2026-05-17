import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class UpdateBundleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  badgeText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  bundlePrice?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(16, { each: true })
  availableSizes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
