import {
  IsString,
  IsArray,
  IsInt,
  IsPositive,
  IsOptional,
  ValidateNested,
  IsObject,
  IsEmail,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// An OrderItemDto represents EITHER a variant line (productId + variantId
// set, bundleId + bundleSize null) OR a bundle line (bundleId + bundleSize
// set, productId + variantId null). The service-level guard rejects rows
// that satisfy neither shape; the DB-level CHECK OrderItem_line_kind_check
// is the last line of defense.
export class OrderItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsOptional()
  bundleId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(16)
  bundleSize?: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsObject()
  shippingAddress!: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  billingAddress?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  discountCode?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  // ─── Guest-checkout fields ─────────────────────────────────────────────
  // Required ONLY when the request is anonymous (no auth). When the caller
  // is authenticated the service ignores these and writes userId instead.
  // The DTO marks them optional so a logged-in customer doesn't have to
  // resend their contact details on every order; the service-level guard
  // throws BadRequest when the user is anonymous AND any field is missing.
  @IsEmail()
  @IsOptional()
  guestEmail?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(120)
  guestName?: string;

  @IsString()
  @IsOptional()
  @MinLength(5)
  @MaxLength(20)
  guestPhone?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  status!: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
