import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsPositive,
  IsIn,
  Max,
  Min,
} from 'class-validator';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

class PresignedUrlDto {
  @IsString()
  @IsIn(['products', 'reviews', 'cms', 'banners', 'bundles', 'sections'])
  folder!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ])
  contentType!: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(MAX_SIZE_BYTES)
  expectedSize!: number;
}

class DeleteFileDto {
  @IsString()
  @IsNotEmpty()
  key!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('presign')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.uploadsService.getPresignedUrl(
      dto.folder,
      dto.contentType,
      dto.expectedSize,
    );
  }

  @Delete('file')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFile(@Body() dto: DeleteFileDto) {
    return this.uploadsService.deleteFile(dto.key);
  }
}
