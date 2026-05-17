import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

const CUID_PATTERN = /^c[a-z0-9]{24}$/;
// Color rides as a URL path segment in DELETE /bundles/:id/items/:productId/:color.
// Reject characters that would break or reroute that path: forward slash,
// question mark, hash, and backslash.
const COLOR_PATH_SAFE = /^[^/?#\\]+$/;

export class BundleItemInputDto {
  @IsString()
  @Matches(CUID_PATTERN, { message: 'productId must be a valid cuid' })
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(COLOR_PATH_SAFE, {
    message: 'color cannot contain /, ?, #, or \\',
  })
  color!: string;
}
