import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsIn,
  IsObject,
} from 'class-validator';
import { ProductType } from '@prisma/client';

export enum AddressType {
  HOME = 'HOME',
  WORK = 'WORK',
  OTHER = 'OTHER',
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;
}

export class CreateAddressDto {
  @IsEnum(AddressType)
  label: AddressType;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  line1: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * Per-product-type fit profile saved by the bot's sizing flow. One DTO
 * call saves the measurements + preferred fit for ONE type (e.g. PANTS);
 * the service merges it into the User.fitProfile JSON column without
 * touching profiles for other types.
 *
 * `measurements` is a free-form map (`{ waist: 32, hip: 38, ... }`) — the
 * keys depend on `type` (see SIZE_CHART_DIMENSIONS_FOR_TYPE).
 */
export class FitProfileDto {
  @IsEnum(ProductType)
  type!: ProductType;

  @IsObject()
  measurements!: Record<string, number>;

  @IsIn(['slim', 'regular', 'baggy', 'fitted', 'oversized'])
  fitPref!: string;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsEnum(AddressType)
  label?: AddressType;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  line1?: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
