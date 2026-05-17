import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsObject,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

// Accepts absolute http(s) URLs or root-relative paths starting with '/'.
// class-validator's @IsUrl does not accept root-relative paths, so we use
// a regex guard for the combined case and @MaxLength to bound the input.
const URL_OR_ROOT_RELATIVE = /^(?:https?:\/\/[^\s]+|\/[^\s]*)$/;
const URL_MESSAGE =
  'Must be an absolute http(s) URL or root-relative path (e.g. /bundles/foo)';

// ─── Homepage Sections ────────────────────────────────────────────────────────

export class CreateSectionDto {
  @IsString()
  @MaxLength(120)
  key: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  link?: string;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  link?: string;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Banners ──────────────────────────────────────────────────────────────────

export class CreateBannerDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  image: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  link?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export class CreateBlogPostDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  @MaxLength(200)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @Transform(({ value }) =>
    typeof value === 'string'
      ? DOMPurify.sanitize(value, { USE_PROFILES: { html: true } })
      : value,
  )
  @IsString()
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  coverImage?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  excerpt?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? DOMPurify.sanitize(value, { USE_PROFILES: { html: true } })
      : value,
  )
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(URL_OR_ROOT_RELATIVE, { message: URL_MESSAGE })
  coverImage?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
