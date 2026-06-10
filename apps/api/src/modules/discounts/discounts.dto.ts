import {
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsDateString,
  IsInt,
  IsPositive,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_SHIPPING = 'FREE_SHIPPING',
}

export class CreateDiscountDto {
  @IsString()
  code: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  @IsPositive()
  @ValidateIf((dto: CreateDiscountDto) => dto.type === DiscountType.PERCENTAGE)
  @Max(100, { message: 'PERCENTAGE discount cannot exceed 100' })
  @ValidateIf(
    (dto: CreateDiscountDto) => dto.type === DiscountType.FIXED_AMOUNT,
  )
  @Max(10_000_000, { message: 'FIXED_AMOUNT discount is unreasonably large' })
  value: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10_000_000)
  minOrderAmount?: number;

  @IsInt()
  @IsPositive()
  @Max(1_000_000)
  @IsOptional()
  maxUses?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsArray()
  @IsOptional()
  applicableProductIds?: string[];

  @IsArray()
  @IsOptional()
  applicableCategoryIds?: string[];
}

export class UpdateDiscountDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsPositive()
  @Max(10_000_000)
  @IsOptional()
  value?: number;

  @IsInt()
  @IsPositive()
  @Max(1_000_000)
  @IsOptional()
  maxUses?: number;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class ValidateDiscountDto {
  @IsString()
  code: string;

  @IsNumber()
  @IsPositive()
  @Max(10_000_000)
  orderAmount: number;

  // Carts pass the product/category IDs they intend to apply the discount
  // against. If the discount was created with applicability lists, the
  // service will refuse it unless at least one cart item matches.
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  productIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];
}
