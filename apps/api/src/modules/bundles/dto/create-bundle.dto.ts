import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BundleItemInputDto } from './bundle-item-input.dto';

export class CreateBundleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  badgeText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  image?: string;

  // bundlePrice is whole BDT (Int) — matches Product.price + Variant.price
  // which are stored as Decimal whole units, no subunits. Min 1 so a
  // placeholder bundle can never reach the storefront with a ৳0 "free"
  // price. Max 1,000,000 BDT is an overflow guard well above any
  // realistic bundle for this shop.
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  bundlePrice!: number;

  // The set of sizes the customer can pick from when buying this bundle.
  // Service-layer integrity check (assertBundleIntegrity) verifies that
  // every (item.productId, item.color, size) tuple resolves to a real
  // ProductVariant before the create succeeds.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(16, { each: true })
  availableSizes!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items!: BundleItemInputDto[];
}
