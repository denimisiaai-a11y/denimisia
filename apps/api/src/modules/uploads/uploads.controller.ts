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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  returnsUploadPresignSchema,
  type ReturnsUploadPresignDto,
} from './dto/returns-upload-presign.dto';
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
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
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

class ProcessImageDto {
  @IsString()
  @IsNotEmpty()
  key!: string;
}

@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post('presign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.uploadsService.getPresignedUrl(
      dto.folder,
      dto.contentType,
      dto.expectedSize,
    );
  }

  @Post('process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  processImage(@Body() dto: ProcessImageDto) {
    return this.uploadsService.processImage(dto.key);
  }

  @Delete('file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFile(@Body() dto: DeleteFileDto) {
    return this.uploadsService.deleteFile(dto.key);
  }

  /**
   * Public (no auth) presign for customer return photos. Rate-limited per
   * IP by the global ThrottlerGuard: 20 uploads / 10 minutes is enough for
   * a thorough damage report (5 photos × ~2 retries) but tight enough that
   * a scraper or storage-attacker can't burn through R2 cheaply.
   *
   * Server forces the `returns/` folder; MIME/size are validated by the
   * Zod schema AND by `presignForReturns` for defence-in-depth.
   */
  @Post('returns/presign')
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  async returnsPresign(
    @Body(new ZodValidationPipe(returnsUploadPresignSchema))
    dto: ReturnsUploadPresignDto,
  ) {
    return this.uploadsService.presignForReturns(dto);
  }
}
