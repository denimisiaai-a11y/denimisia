import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaProcessingService } from './media-processing.service';
import { R2StorageService } from './r2-storage.service';

/**
 * Media module — manages images + videos for the WYSIWYG admin.
 *
 * Storage backend is Cloudflare R2 via {@link R2StorageService}. The old
 * SupabaseStorageService remains in-tree but is no longer registered; see
 * scripts/migrate-supabase-to-r2.ts to copy legacy assets over before
 * decommissioning the Supabase buckets.
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [MediaController],
  providers: [MediaService, MediaProcessingService, R2StorageService],
  exports: [MediaService, R2StorageService],
})
export class MediaModule {}
