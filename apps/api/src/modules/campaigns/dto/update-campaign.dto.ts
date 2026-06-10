import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsDateString,
} from 'class-validator';

enum CampaignType {
  FLASH_SALE = 'FLASH_SALE',
  SEASONAL = 'SEASONAL',
  PROMO = 'PROMO',
}

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(CampaignType)
  @IsOptional()
  type?: CampaignType;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
