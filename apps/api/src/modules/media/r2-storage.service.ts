/**
 * Cloudflare R2 storage service — S3-compatible backing for media assets.
 *
 * Replaces SupabaseStorageService. Buckets:
 *   R2_BUCKET_NAME             single bucket with prefix-based segregation:
 *                                originals/  (not served publicly; no CDN)
 *                                public/     (served via R2_PUBLIC_URL / CDN domain)
 *
 * Env (see .env.example):
 *   R2_ACCOUNT_ID              used in the S3 endpoint URL
 *   R2_ACCESS_KEY_ID           R2 API token
 *   R2_SECRET_ACCESS_KEY       R2 API secret
 *   R2_BUCKET_NAME             bucket name
 *   R2_PUBLIC_URL              custom domain fronting R2 (e.g. https://cdn.denimisia.com)
 *
 * If R2 is not configured at boot, every upload throws a clean error — the
 * API itself still starts so admin routes that don't touch storage keep
 * working.
 */

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { env, isProd } from '../../common/env';

export interface UploadResult {
  readonly path: string;
  readonly bucket: string;
  readonly publicUrl: string;
}

@Injectable()
export class R2StorageService implements OnModuleInit {
  private readonly logger = new Logger(R2StorageService.name);
  private client: S3Client | null = null;
  private readonly originalsPrefix = 'originals/';
  private readonly publicPrefix = 'public/';

  onModuleInit(): void {
    const missing =
      !env.R2_ACCOUNT_ID ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY ||
      !env.R2_BUCKET_NAME ||
      !env.R2_PUBLIC_URL;

    if (missing) {
      const level = isProd() ? 'error' : 'warn';
      this.logger[level](
        'R2 not fully configured — uploads will fail. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL.',
      );
      return;
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
    this.logger.log(
      `R2 configured: bucket=${env.R2_BUCKET_NAME} cdn=${env.R2_PUBLIC_URL}`,
    );
  }

  isReady(): boolean {
    return this.client !== null;
  }

  getPublicBucket(): string {
    return env.R2_BUCKET_NAME ?? '';
  }

  getOriginalsBucket(): string {
    // Same bucket, different prefix.
    return env.R2_BUCKET_NAME ?? '';
  }

  async uploadOriginal(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    return this.put(
      this.originalsPrefix + path,
      body,
      contentType,
      /* public */ false,
    );
  }

  async uploadPublic(
    path: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    return this.put(
      this.publicPrefix + path,
      body,
      contentType,
      /* public */ true,
    );
  }

  async delete(_bucket: string, path: string): Promise<void> {
    const client = this.mustHaveClient();
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: env.R2_BUCKET_NAME!,
          Key: path,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`R2 delete failed: ${path} — ${msg}`);
      throw new InternalServerErrorException(`R2 delete failed: ${msg}`);
    }
  }

  private async put(
    key: string,
    body: Buffer,
    contentType: string,
    isPublic: boolean,
  ): Promise<UploadResult> {
    const client = this.mustHaveClient();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME!,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: isPublic
            ? 'public, max-age=31536000, immutable'
            : 'private, max-age=0',
        }),
      );
      return {
        path: key,
        bucket: env.R2_BUCKET_NAME!,
        publicUrl: isPublic
          ? `${env.R2_PUBLIC_URL}/${key}`
          : `r2://${env.R2_BUCKET_NAME}/${key}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`R2 upload failed: ${key} — ${msg}`);
      throw new InternalServerErrorException(`R2 upload failed: ${msg}`);
    }
  }

  private mustHaveClient(): S3Client {
    if (!this.client) {
      throw new InternalServerErrorException(
        'R2 not configured. Set R2_* env vars.',
      );
    }
    return this.client;
  }
}
