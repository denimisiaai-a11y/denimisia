import { z } from 'zod';

/**
 * Public (no auth) presign request for customer return photos.
 *
 * Constraints intentionally tighter than the admin endpoint:
 * - MIME allowlist is JPEG/PNG/WebP only (no GIF/AVIF — animated formats add
 *   no value for damage photos and increase R2 storage cost).
 * - 10 MB cap matches the admin endpoint and R2 PUT presign ceiling.
 * - Folder is forced to `returns/` server-side; this DTO carries no folder
 *   field so a guest cannot influence the storage prefix.
 */
export const returnsUploadPresignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024), // 10 MB
});

export type ReturnsUploadPresignDto = z.infer<
  typeof returnsUploadPresignSchema
>;
