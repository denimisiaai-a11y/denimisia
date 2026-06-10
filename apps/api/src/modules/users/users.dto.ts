import {
  IsEmail,
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsIn,
  IsObject,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ProductType } from '@prisma/client';

export enum AddressType {
  HOME = 'HOME',
  WORK = 'WORK',
  OTHER = 'OTHER',
}

/**
 * Admin-only customer creation. Role is always CUSTOMER on the server
 * (no admin can mint another admin through this endpoint) and the password
 * is generated server-side — the customer sets their own via the password
 * reset email triggered after creation.
 */
export class CreateCustomerByAdminDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}

/**
 * Admin-only profile edit. Lets a staff member fix typos in a customer's
 * name, swap their email, or update their phone (dedup-prepended to phones[]
 * by the service). Email change on a CLAIMED account bumps tokenVersion so
 * the customer is forced to log in again — same security guarantee as a
 * password reset. Role / isActive / passwordHash are never editable here.
 */
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  // SUPER_ADMIN-only. Service rejects role changes from any other actor.
  @IsOptional()
  @IsIn(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT_STAFF', 'CUSTOMER'])
  role?: string;

  // Page-slug allowlist. Empty array = full access (matches schema default).
  @IsOptional()
  @IsString({ each: true })
  permissions?: string[];
}

/**
 * Admin-creates a staff account (SUPER_ADMIN only). Sets a starter password
 * directly — no invite email yet. Account is created claimed + verified so
 * the staff member can log in immediately with the credentials shown to the
 * SUPER_ADMIN at create time.
 */
export class CreateStaffDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  // 12-char minimum — same floor as the customer register endpoint.
  @IsString()
  @MaxLength(128)
  password!: string;

  @IsIn(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT_STAFF'])
  role!: string;

  // Empty / omitted = all pages (full access).
  @IsOptional()
  @IsString({ each: true })
  permissions?: string[];
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

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(32)
  phone?: string | null;
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
