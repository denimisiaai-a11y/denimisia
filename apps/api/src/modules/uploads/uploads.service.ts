import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import {
  IMAGE_VARIANTS,
  IMAGE_VARIANT_NAMES,
  type ImageVariantName,
} from '@repo/types';

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
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const MIN_SIZE_BYTES = 1;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB — presigned PUT cap.
// Hard cap on bytes processImage() will Sharp-decode. Mirrors MAX_SIZE_BYTES
// today since admins can't upload larger than that, but kept as a separate
// knob so server-side processing can be tightened independently if needed.
const MAX_PROCESS_BYTES = MAX_SIZE_BYTES;
// Per-variant wall-clock cap. A healthy variant generates in <2s; anything
// longer is a stuck I/O or pathological image. Failing the variant lets the
// other variants still succeed.
const SHARP_TIMEOUT_MS = 15_000;

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
  'returns/',
];

/**
 * Public (guest) presign accepts a narrower MIME allowlist than the admin
 * endpoint. Animated/lossless formats add no value for damage photos and
 * increase R2 storage cost; restrict to the three browsers actually emit
 * from <input type="file">.
 */
const ALLOWED_RETURNS_MIMES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_RETURNS_FILENAME_LEN = 255;

// Variant config (names + widths) is sourced from @repo/types so the
// storefront's getImageVariant() helper picks up rename/add/remove changes
// at build time. Widths are an API-internal concern; clients only need the
// names.
type VariantName = ImageVariantName;
const VARIANT_NAMES = IMAGE_VARIANT_NAMES;

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private config: ConfigService) {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('R2_BUCKET_NAME');

    if (!bucket) {
      // No silent 'denimisia' fallback — drift with R2StorageService was a
      // real bug; fail fast at boot instead of writing to a phantom bucket.
      throw new Error('R2_BUCKET_NAME is required for UploadsService');
    }
    this.bucket = bucket;
    this.publicUrl = this.config.get<string>('R2_PUBLIC_URL') ?? '';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      this.s3 = null;
      return;
    }

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      // R2 is S3-compatible but doesn't accept the CRC32 checksum query params
      // that AWS SDK v3 adds by default since 3.730+. Without this, presigned
      // PUTs fail with SignatureDoesNotMatch because the client can't recreate
      // the signed `x-amz-checksum-crc32` value at request time.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
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
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
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

    // Best-effort cascade: delete the original AND every variant. Variant
    // failures don't block the original deletion (they may not exist yet if
    // processing never ran). Errors are logged for ops triage.
    const variantKeys = VARIANT_NAMES.map((name) => buildVariantKey(key, name));
    const deletions = [key, ...variantKeys].map((k) =>
      this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: k })),
    );
    const results = await Promise.allSettled(deletions);
    const failed = results
      .map((r, i) =>
        r.status === 'rejected'
          ? `${[key, ...variantKeys][i]}: ${String(r.reason)}`
          : null,
      )
      .filter(Boolean);
    if (failed.length > 0) {
      this.logger.warn(
        `deleteFile(${key}) variant cleanup had ${failed.length} failures: ${failed.join('; ')}`,
      );
    }
  }

  /**
   * Generate resized WebP variants for an uploaded image and push them back
   * to R2 under sibling keys. Called by the admin after the direct-browser-
   * to-R2 PUT completes. The original stays in place; variants land at
   * `{key-without-ext}-{variantName}.webp`.
   *
   * Reprocessing: safe to call multiple times for the same key. Variants
   * overwrite. Use this when processing partially failed or when variant
   * config changed and you want to regenerate.
   *
   * Memory: Sharp decodes the full image in RAM. An 18MB JPEG can spike to
   * ~80MB resident. Variants run SEQUENTIALLY now to avoid 3x parallel peaks
   * that would OOM small instances. Total wall-clock cost is ~2x sequential
   * vs parallel, traded for predictable memory.
   */
  async processImage(
    key: string,
  ): Promise<{ variants: Record<VariantName, string>; failures: string[] }> {
    if (!this.s3) {
      throw new BadRequestException('Image uploads are not configured.');
    }
    this.assertSafeKey(key);

    const startTs = Date.now();

    let originalBuffer: Buffer;
    try {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) {
        throw new InternalServerErrorException('R2 returned empty body');
      }
      const bytes = await response.Body.transformToByteArray();
      originalBuffer = Buffer.from(bytes);
    } catch (err: unknown) {
      this.logger.error(`Failed to read original ${key} from R2`, err);
      throw new BadRequestException(
        'Original image not found in storage; upload may have failed.',
      );
    }

    if (originalBuffer.length > MAX_PROCESS_BYTES) {
      throw new BadRequestException(
        `Original is ${(originalBuffer.length / 1024 / 1024).toFixed(1)}MB; processing capped at ${MAX_PROCESS_BYTES / 1024 / 1024}MB.`,
      );
    }

    // Validate the bytes are actually a decodable image before spending CPU.
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(originalBuffer).metadata();
    } catch (err: unknown) {
      this.logger.error(`Sharp failed to decode ${key}`, err);
      throw new BadRequestException('File is not a valid image.');
    }
    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('Image has no detectable dimensions.');
    }

    const variants = {} as Record<VariantName, string>;
    const failures: string[] = [];
    const sizes: Record<string, number> = {};

    // Sequential to bound memory; see method docstring.
    for (const name of VARIANT_NAMES) {
      try {
        const { url, bytes } = await withTimeout(
          this.makeAndUploadVariant(key, originalBuffer, name),
          SHARP_TIMEOUT_MS,
          `Variant ${name} timed out after ${SHARP_TIMEOUT_MS}ms`,
        );
        variants[name] = url;
        sizes[name] = bytes;
      } catch (err: unknown) {
        failures.push(
          `${name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const durationMs = Date.now() - startTs;
    if (failures.length === VARIANT_NAMES.length) {
      this.logger.error(
        `processImage(${key}) all variants failed in ${durationMs}ms: ${failures.join('; ')}`,
      );
      throw new InternalServerErrorException(
        `All variant generations failed: ${failures.join('; ')}`,
      );
    }
    if (failures.length > 0) {
      this.logger.warn(
        `processImage(${key}) partial: durationMs=${durationMs} failures=${failures.join('; ')} sizes=${JSON.stringify(sizes)}`,
      );
    } else {
      this.logger.log(
        `processImage(${key}) ok: durationMs=${durationMs} originalKB=${Math.round(originalBuffer.length / 1024)} sizes=${JSON.stringify(sizes)}`,
      );
    }

    return { variants, failures };
  }

  private async makeAndUploadVariant(
    originalKey: string,
    originalBuffer: Buffer,
    variantName: VariantName,
  ): Promise<{ url: string; bytes: number }> {
    const opts = IMAGE_VARIANTS[variantName];
    const resized = await sharp(originalBuffer, {
      // Hard cap on Sharp's pixel/density limits; defends against decompression
      // bombs (e.g. a 100×100 PNG that decodes to a 50000×50000 canvas).
      limitInputPixels: 50_000_000,
    })
      .rotate() // honor EXIF orientation before resize so portrait phone shots aren't sideways
      .resize({ width: opts.width, withoutEnlargement: true })
      .webp({ quality: opts.quality, effort: 4 })
      .toBuffer();

    const variantKey = buildVariantKey(originalKey, variantName);

    await this.s3!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: variantKey,
        Body: resized,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { url: `${this.publicUrl}/${variantKey}`, bytes: resized.length };
  }

  /**
   * Presign a PUT for a customer return photo.
   *
   * Differs from `getPresignedUrl` (admin) in three ways:
   * - Folder is forced to `returns/`; caller cannot influence it.
   * - MIME allowlist is JPEG/PNG/WebP only (no GIF/AVIF).
   * - Object key embeds a sanitized form of the original filename for
   *   ops/customer-support traceability (a UUID still anchors it so
   *   filename collisions can't overwrite). The on-disk extension is still
   *   driven by the signed Content-Type, not the filename, so a guest
   *   cannot rename `script.html` → `script.jpg` and bypass the MIME map.
   *
   * No auth: guarded by the controller's `@Throttle` decorator, which keys
   * on caller IP via the global ThrottlerGuard.
   */
  async presignForReturns(input: {
    filename: string;
    contentType: string;
    contentLength: number;
  }): Promise<{ uploadUrl: string; key: string; fileUrl: string }> {
    if (!this.s3) {
      throw new BadRequestException(
        'Image uploads are not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.',
      );
    }

    if (
      typeof input.filename !== 'string' ||
      input.filename.length === 0 ||
      input.filename.length > MAX_RETURNS_FILENAME_LEN
    ) {
      throw new BadRequestException('filename is required (max 255 chars)');
    }

    if (!ALLOWED_RETURNS_MIMES.has(input.contentType)) {
      throw new BadRequestException(
        `File type not allowed. Allowed: ${Array.from(ALLOWED_RETURNS_MIMES).join(', ')}`,
      );
    }

    if (
      !Number.isInteger(input.contentLength) ||
      input.contentLength < MIN_SIZE_BYTES
    ) {
      throw new BadRequestException(
        'contentLength must be a positive integer',
      );
    }
    if (input.contentLength > MAX_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const ext = MIME_TO_EXT[input.contentType];
    if (!ext) {
      throw new BadRequestException('Unsupported content type');
    }

    const safeFilename = sanitizeReturnsFilename(input.filename);
    // UUID first ensures uniqueness even when two guests upload the same
    // phone-camera default name (`IMG_1234.jpg`). The sanitized filename is
    // appended for operator-side debugging only; extension is still derived
    // from the signed Content-Type, not the filename.
    const key = `returns/${randomUUID()}-${safeFilename}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const fileUrl = `${this.publicUrl}/${key}`;

    return { uploadUrl, key, fileUrl };
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

/**
 * Variant-key naming convention. Storefront helper `getImageVariant()` MUST
 * produce the same shape — both consume IMAGE_VARIANT_NAMES from @repo/types,
 * but the path arithmetic is duplicated here intentionally (no module-graph
 * coupling from frontend → backend internals).
 *
 *   products/abc.jpg → products/abc-card.webp
 *   reviews/xyz.png  → reviews/xyz-thumb.webp
 */
export function buildVariantKey(
  originalKey: string,
  variant: VariantName,
): string {
  const lastSlash = originalKey.lastIndexOf('/');
  const folder = originalKey.slice(0, lastSlash);
  const filename = originalKey.slice(lastSlash + 1);
  const lastDot = filename.lastIndexOf('.');
  const baseName = lastDot === -1 ? filename : filename.slice(0, lastDot);
  return `${folder}/${baseName}-${variant}.webp`;
}

/**
 * Sanitize a guest-supplied filename for inclusion in an R2 object key.
 *
 * Strips the extension (we drive that from MIME), then collapses to a
 * conservative `[A-Za-z0-9._-]` set so the key stays URL-safe and can't
 * inject path traversal, query strings, or shell metacharacters. Empty
 * results fall back to `photo` so the key always has a stable shape.
 */
export function sanitizeReturnsFilename(raw: string): string {
  const lastSlash = Math.max(raw.lastIndexOf('/'), raw.lastIndexOf('\\'));
  const base = lastSlash === -1 ? raw : raw.slice(lastSlash + 1);
  const lastDot = base.lastIndexOf('.');
  const stem = lastDot === -1 ? base : base.slice(0, lastDot);
  const cleaned = stem
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 64);
  return cleaned.length > 0 ? cleaned : 'photo';
}

/**
 * Run a promise with a wall-clock deadline. Rejects with the supplied message
 * if `ms` passes before the promise settles. Used to bound Sharp operations
 * that could in theory hang on a corrupt input.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}
