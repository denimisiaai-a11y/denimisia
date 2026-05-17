import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
} from 'class-validator';

// Product IDs are Prisma cuid() — lowercase alphanumeric, 25 chars starting
// with "c". Constraining the shape blocks obviously-malformed input at the
// validation layer without coupling to Prisma's exact format.
const CUID_PATTERN = /^c[a-z0-9]{24}$/;

export class CreateBundleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  badgeText: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Matches(CUID_PATTERN, {
    each: true,
    message: 'each productId must be a valid cuid',
  })
  productIds: string[];
}
