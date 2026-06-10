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

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsEnum(CampaignType)
  type: CampaignType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
