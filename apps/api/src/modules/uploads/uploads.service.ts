import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

/**
 * Image-only presigned uploads (direct-browser → R2).
 *
 * We cannot probe content on a presigned flow (client uploads bypass the API),
 * so security relies on: (1) a strict MIME allowlist, (2) a static MIME→ext
 * map so the client cannot influence the stored object key extension,
 * (3) ContentLengthRange + ContentType baked into the signed command so R2
 * rejects uploads that don't match what we signed.
 */
const ALLOWED_IMAGE_MIMES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
  'image/avif': 'avif',
};

const MIN_SIZE_BYTES = 1;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Allowed top-level folder prefixes for object keys. Used to constrain both
 * presigned PUT targets (folder DTO field) and deleteFile(key) input so that
 * an authenticated admin cannot target arbitrary bucket objects.
 */
const ALLOWED_KEY_PREFIXES: ReadonlyArray<string> = [
  'products/',
  'reviews/',
  'cms/',
  'banners/',
  'bundles/',
  'sections/',
];

@Injectable()
export class UploadsService {
  private s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private config: ConfigService) {
    const accountId       = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId     = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket          = this.config.get<string>('R2_BUCKET_NAME');

    if (!bucket) {
      // No silent 'denimisia' fallback — drift with R2StorageService was a
      // real bug; fail fast at boot instead of writing to a phantom bucket.
      throw new Error('R2_BUCKET_NAME is required for UploadsService');
    }
    this.bucket    = bucket;
    this.publicUrl = this.config.get<string>('R2_PUBLIC_URL') ?? '';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      this.s3 = null;
      return;
    }

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async getPresignedUrl(
    folder: string,
    contentType: string,
    expectedSize: number,
  ): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
    if (!this.s3) {
      throw new BadRequestException(
        'Image uploads are not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.',
      );
    }

    // Folder must map to an allowed prefix.
    const folderPrefix = `${folder}/`;
    if (!ALLOWED_KEY_PREFIXES.includes(folderPrefix)) {
      throw new BadRequestException(
        `Folder not allowed. Allowed: ${ALLOWED_KEY_PREFIXES.map((p) => p.replace('/', '')).join(', ')}`,
      );
    }

    if (!ALLOWED_IMAGE_MIMES.has(contentType)) {
      throw new BadRequestException(
        `File type not allowed. Allowed: ${Array.from(ALLOWED_IMAGE_MIMES).join(', ')}`,
      );
    }

    if (!Number.isInteger(expectedSize) || expectedSize < MIN_SIZE_BYTES) {
      throw new BadRequestException('expectedSize must be a positive integer');
    }
    if (expectedSize > MAX_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const ext = MIME_TO_EXT[contentType];
    if (!ext) {
      // Defence-in-depth: allowlist + map must stay in sync.
      throw new BadRequestException('Unsupported content type');
    }

    const key = `${folderPrefix}${randomUUID()}.${ext}`;

    // ContentType + ContentLength are signed into the URL, so R2/S3 will
    // reject a PUT whose headers don't match. We also set a range so the
    // client can't upload a zero-byte or oversized file even if it lies.
    const command = new PutObjectCommand({
      Bucket:        this.bucket,
      Key:           key,
      ContentType:   contentType,
      ContentLength: expectedSize,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const publicFileUrl = `${this.publicUrl}/${key}`;

    return { uploadUrl, key, publicUrl: publicFileUrl };
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.s3) {
      throw new BadRequestException('Image uploads are not configured.');
    }

    this.assertSafeKey(key);

    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.s3.send(command);
  }

  /**
   * Reject keys that escape our allowed prefixes, contain path-traversal
   * sequences, null bytes, or look like absolute URLs.
   */
  private assertSafeKey(key: string): void {
    if (typeof key !== 'string' || key.length === 0 || key.length > 1024) {
      throw new BadRequestException('Invalid key');
    }
    if (
      key.includes('..') ||
      key.includes('//') ||
      key.includes('\0') ||
      key.startsWith('/') ||
      /^[a-z]+:\/\//i.test(key)
    ) {
      throw new BadRequestException('Invalid key');
    }
    if (!ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      throw new BadRequestException(
        `Key must start with one of: ${ALLOWED_KEY_PREFIXES.join(', ')}`,
      );
    }
  }
}
