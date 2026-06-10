// Browser-side image resize + recompress, run before upload.
//
// Why: phone cameras produce 18-25 MB JPEGs and our R2 upload cap is 10 MB.
// More importantly, even if the upload succeeded, a 25 MB original would
// waste storage forever — the storefront only needs at most a 1024px wide
// variant, derived from a much smaller source.
//
// Strategy: cap originals at 2000 px wide (still 2x what the storefront ever
// requests) and re-encode as JPEG q=85. Skip animated GIFs and already-
// compact formats (WebP/AVIF/small files) that wouldn't benefit.
//
// EXIF orientation: drawImage() respects EXIF rotation when given an
// ImageBitmap, baking the corrected orientation into the canvas. The output
// JPEG has no EXIF tag, but pixels are already rotated correctly.

const DEFAULT_MAX_WIDTH = 2000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB — anything under this is "small enough already".
const DEFAULT_QUALITY = 0.85;

export interface ResizeOptions {
  maxWidth?: number;
  maxBytes?: number;
  /** JPEG quality 0..1. */
  quality?: number;
}

export interface ResizeResult {
  /** The (possibly) resized file, ready to upload. Same identity as input if no resize ran. */
  file: File;
  /** True when the helper actually modified the file. */
  resized: boolean;
  /** Bytes before/after for telemetry + UI feedback. Equal when resized=false. */
  beforeBytes: number;
  afterBytes: number;
}

/** Format types we deliberately pass through unchanged. */
const PASSTHROUGH_TYPES = new Set([
  'image/gif', // may be animated — resizing would freeze to one frame
  'image/webp', // already efficient; admins choosing webp probably know what they're doing
  'image/avif', // ditto
]);

/**
 * Resize+recompress a File if it exceeds either dimension or byte budget.
 * Returns the same File reference (and `resized: false`) when no work is needed.
 */
export async function maybeResizeImage(
  file: File,
  options: ResizeOptions = {},
): Promise<ResizeResult> {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const beforeBytes = file.size;

  if (PASSTHROUGH_TYPES.has(file.type)) {
    return { file, resized: false, beforeBytes, afterBytes: beforeBytes };
  }

  // Cheap fast-path: if the file is under the byte budget AND we haven't
  // decoded the image yet, assume dimensions are fine too. Decoding a JPEG
  // header to peek dimensions costs the same as decoding the whole thing.
  if (beforeBytes <= maxBytes) {
    return { file, resized: false, beforeBytes, afterBytes: beforeBytes };
  }

  // Need to decode + measure.
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  if (width <= maxWidth) {
    // File is bigger than maxBytes but dimensions are already fine. The
    // re-encode at q=85 will shrink it anyway.
  }

  const scale = Math.min(maxWidth / width, 1);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  // OffscreenCanvas keeps the work off the main thread's compositor.
  // Browser support: Safari ≥16.4 (2023), Chrome ≥69, Firefox ≥105.
  let blob: Blob;
  try {
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  } finally {
    bitmap.close();
  }

  const nameWithoutExt = file.name.replace(/\.[^.]+$/, '') || 'image';
  const resizedFile = new File([blob], `${nameWithoutExt}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

  return {
    file: resizedFile,
    resized: true,
    beforeBytes,
    afterBytes: resizedFile.size,
  };
}
