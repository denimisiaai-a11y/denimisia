import { IsOptional, IsString } from 'class-validator';

export class StatusHistoryQueryDto {
  @IsOptional()
  @IsString()
  orderId?: string;
}
