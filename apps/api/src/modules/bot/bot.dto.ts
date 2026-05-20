import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ProductType } from '@prisma/client';

export class BotContextFlowDto {
  @IsString() name!: 'sizing';
  @IsString() step!: string;
  @IsEnum(ProductType) type!: ProductType;
  @IsObject() collected!: Record<string, number | string>;
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
