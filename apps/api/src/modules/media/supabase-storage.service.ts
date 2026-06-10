/**
 * Thin wrapper around Supabase Storage.
 *
 * Two buckets:
 *   media-originals  private — full-quality source, never served directly
 *   media-public     public  — derived/transformed assets for storefront use
 *
 * Env:
 *   SUPABASE_URL                 https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    service-role JWT (bypasses RLS — server-only)
 *   SUPABASE_BUCKET_ORIGINALS    defaults to "media-originals"
 *   SUPABASE_BUCKET_PUBLIC       defaults to "media-public"
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

export interface UploadResult {
  readonly path: string;
  readonly bucket: string;
  readonly publicUrl: string;
}

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private client: SupabaseClient | null = null;
  private readonly originalsBucket: string;
  private readonly publicBucket: string;

  constructor(private readonly config: ConfigService) {
    this.originalsBucket =
      this.config.get<string>('SUPABASE_BUCKET_ORIGINALS') ?? 'media-originals';
    this.publicBucket =
      this.config.get<string>('SUPABASE_BUCKET_PUBLIC') ?? 'media-public';
  }

  onModuleInit(): void {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      this.logger.warn(
        'Supabase Storage not configured — uploads will fail until SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.',
      );
      return;
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  isReady(): boolean {
    return this.client !== null;
  }

  getPublicBucket(): string {
    return this.publicBucket;
  }

  getOriginalsBucket(): string {
    return this.originalsBucket;
  }

  async uploadOriginal(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    return this.upload(this.originalsBucket, path, body, contentType);
  }

  async uploadPublic(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    return this.upload(this.publicBucket, path, body, contentType);
  }

  async delete(bucket: string, path: string): Promise<void> {
    if (!this.client)
      throw new InternalServerErrorException(
        'Supabase Storage not configured.',
      );
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) {
      this.logger.error(`Failed to delete ${bucket}/${path}: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }

  private async upload(
    bucket: string,
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    if (!this.client)
      throw new InternalServerErrorException(
        'Supabase Storage not configured.',
      );
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, body, {
        contentType,
        upsert: false,
        cacheControl: '31536000',
      });
    if (error) {
      this.logger.error(`Upload failed: ${bucket}/${path} — ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return { path, bucket, publicUrl: data.publicUrl };
  }

  /** Supabase image-transform URL. Returns a resized image via transform API. */
  buildTransformUrl(
    path: string,
    opts: { width?: number; height?: number; quality?: number } = {},
  ): string | null {
    if (!this.client) return null;
    const { data } = this.client.storage
      .from(this.publicBucket)
      .getPublicUrl(path, {
        transform: {
          width: opts.width,
          height: opts.height,
          quality: opts.quality ?? 85,
        },
      });
    return data.publicUrl;
  }
}
