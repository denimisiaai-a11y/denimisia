import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateSlotDto {
  @IsOptional() @IsString() assetId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) heading?: string;
  @IsOptional() @IsString() @MaxLength(1000) subheading?: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string;
  @IsOptional() @IsString() @MaxLength(200) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) ctaHref?: string;
  @IsOptional() @IsString() @MaxLength(500) altText?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() position?: number;
}

export class ReorderSlotsDto {
  @IsString() groupKey!: string;
  @IsString({ each: true }) orderedSlotIds!: string[];
}
