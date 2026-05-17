import { IsArray, IsString } from 'class-validator';

export class AddBundleItemsDto {
  @IsArray()
  @IsString({ each: true })
  productIds: string[];
}
