import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class AddToCartDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  variantId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class AddBundleToCartDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  bundleSlug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  size!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
