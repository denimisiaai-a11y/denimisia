import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
  IsObject,
} from 'class-validator';
import { ProductType } from '@prisma/client';

/**
 * Allowlist of keys permitted inside `BotContextFlowDto.collected`.
 * Mirrors the union of `SIZING_FLOW_STEPS` and `SIZE_CHART_DIMENSIONS_FOR_TYPE`
 * (waist/hip/inseam/thigh for pants, chest/shoulder/length/sleeve for tops),
 * plus the `fitPref` string. Anything outside this set — including dangerous
 * keys like `__proto__` or `constructor` — is rejected at the DTO boundary.
 */
const ALLOWED_COLLECTED_KEYS: ReadonlySet<string> = new Set([
  'waist',
  'hip',
  'inseam',
  'thigh',
  'chest',
  'shoulder',
  'sleeve',
  'length',
  'fitPref',
]);

const VALID_FLOW_STEPS = [
  'type',
  'waist',
  'hip',
  'inseam',
  'chest',
  'shoulder',
  'sleeve',
  'fitPref',
] as const;

/**
 * Custom class-validator decorator for `collected`. Enforces a bounded
 * key/value shape so the bot can never be coerced into accepting unbounded
 * arbitrary input via the context blob.
 *
 * Rules:
 *   - Must be a plain object (not null, not array).
 *   - At most 10 keys.
 *   - Each key must be in `ALLOWED_COLLECTED_KEYS`.
 *   - Each value is either a finite number in [0, 200] OR a string ≤ 32 chars.
 */
function IsValidCollected(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCollected',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null || typeof value !== 'object') return false;
          if (Array.isArray(value)) return false;
          const obj = value as Record<string, unknown>;
          const keys = Object.keys(obj);
          if (keys.length > 10) return false;
          for (const k of keys) {
            if (!ALLOWED_COLLECTED_KEYS.has(k)) return false;
            const v = obj[k];
            if (typeof v === 'number') {
              if (!Number.isFinite(v) || v < 0 || v > 200) return false;
            } else if (typeof v === 'string') {
              if (v.length > 32) return false;
            } else {
              return false;
            }
          }
          return true;
        },
        defaultMessage(_args: ValidationArguments) {
          return 'collected must be an object with at most 10 valid measurement keys';
        },
      },
    });
  };
}

export class BotContextFlowDto {
  @IsIn(['sizing']) name!: 'sizing';
  @IsIn(VALID_FLOW_STEPS as unknown as string[]) step!: string;
  @IsEnum(ProductType) type!: ProductType;
  @IsValidCollected() collected!: Record<string, number | string>;
}

export class BotContextDto {
  @IsString() @MaxLength(64) sessionId!: string;
  @IsOptional() @IsIn(['M', 'F', null]) gender?: 'M' | 'F' | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => BotContextFlowDto)
  flow?: BotContextFlowDto;
}

export class BotMessageDto {
  @IsString() @MaxLength(500) text!: string;
  @ValidateNested() @Type(() => BotContextDto) context!: BotContextDto;
}

export class RecommendSizeDto {
  @IsEnum(ProductType) type!: ProductType;
  @IsObject() measurements!: Record<string, number>;
  @IsIn(['slim', 'regular', 'baggy', 'fitted', 'oversized']) fitPref!: string;
}
