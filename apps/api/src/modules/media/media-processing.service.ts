/**
 * Image + video post-processing.
 *
 * Images: read metadata via Sharp. We DO NOT re-encode — we upload the
 * original to Supabase and rely on Supabase's on-the-fly transform URLs
 * (?width=…&quality=…&format=webp) for delivery. This keeps pristine
 * quality in storage and lets the frontend choose the right size per
 * viewport without us pre-generating variants.
 *
 * Videos: transcode to H.264 MP4 (web-safe baseline) + extract a JPEG
 * poster frame. The original is kept too, in case we need to re-derive.
 *
 * Security posture:
 *   - Strict MIME allowlist (no prefix matching → SVG/XML are rejected).
 *   - ffprobe is run BEFORE transcoding to cap duration and bitrate,
 *     which bounds worst-case CPU / disk usage per request.
 *   - Every ffmpeg operation is wrapped in a 2-minute timeout so a pathological
 *     input cannot tie up a worker indefinitely.
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { fileTypeFromBuffer } from 'file-type';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, createHash } from 'node:crypto';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);

// Strict allowlists — do NOT use startsWith(). `image/svg+xml` must never
// pass through: Sharp will render it and a malicious SVG embeds JS that
// browsers execute if served with the image/svg+xml content-type.
const ALLOWED_IMAGE_MIMES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const ALLOWED_VIDEO_MIMES: ReadonlySet<string> = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const MAX_VIDEO_DURATION_SEC = 300; // 5 minutes
const MAX_VIDEO_BITRATE_BPS = 20_000_000; // 20 Mbps
const FFMPEG_TIMEOUT_MS = 120_000; // 2 minutes per ffmpeg op

export interface ImageMeta {
  readonly width: number;
  readonly height: number;
  readonly mime: string;
  readonly bytes: number;
}

export interface VideoResult {
  readonly mp4: Buffer;
  readonly poster: Buffer;
  readonly width: number;
  readonly height: number;
  readonly durationMs: number;
  readonly bytes: number;
}

@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);

  async detectMime(buf: Buffer): Promise<string> {
    const detected = await fileTypeFromBuffer(buf);
    if (!detected) throw new BadRequestException('Could not detect file type.');
    return detected.mime;
  }

  contentHash(buf: Buffer): string {
    return createHash('sha256').update(buf).digest('hex');
  }

  isImage(mime: string): boolean {
    return ALLOWED_IMAGE_MIMES.has(mime);
  }

  isVideo(mime: string): boolean {
    return ALLOWED_VIDEO_MIMES.has(mime);
  }

  async readImageMeta(buf: Buffer): Promise<ImageMeta> {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) {
      throw new BadRequestException('Image dimensions could not be read.');
    }
    return {
      width: meta.width,
      height: meta.height,
      mime: `image/${meta.format ?? 'jpeg'}`,
      bytes: buf.byteLength,
    };
  }

  async transcodeVideo(buf: Buffer): Promise<VideoResult> {
    const jobDir = join(
      tmpdir(),
      `denim-video-${randomBytes(8).toString('hex')}`,
    );
    await fs.mkdir(jobDir, { recursive: true });
    const inPath = join(jobDir, 'in');
    const outPath = join(jobDir, 'out.mp4');
    const posterPath = join(jobDir, 'poster.jpg');
    await fs.writeFile(inPath, buf);

    try {
      // ── Pre-flight probe: reject oversized inputs before touching CPU.
      const inputProbe = await this.withTimeout(
        this.probe(inPath),
        FFMPEG_TIMEOUT_MS,
        'ffprobe timed out',
      );
      const inputDurationSec = inputProbe.format.duration ?? 0;
      const inputBitrate =
        typeof inputProbe.format.bit_rate === 'string'
          ? Number.parseInt(inputProbe.format.bit_rate, 10)
          : (inputProbe.format.bit_rate ?? 0);

      if (inputDurationSec > MAX_VIDEO_DURATION_SEC) {
        throw new BadRequestException(
          `Video duration ${Math.round(inputDurationSec)}s exceeds ${MAX_VIDEO_DURATION_SEC}s cap.`,
        );
      }
      if (inputBitrate > MAX_VIDEO_BITRATE_BPS) {
        throw new BadRequestException(
          `Video bitrate ${inputBitrate} bps exceeds ${MAX_VIDEO_BITRATE_BPS} bps cap.`,
        );
      }

      await this.withTimeout(
        new Promise<void>((resolve, reject) => {
          ffmpeg(inPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
              '-preset medium',
              '-crf 23',
              '-pix_fmt yuv420p',
              '-movflags +faststart',
              "-vf scale='min(1920,iw)':-2",
            ])
            .on('end', () => resolve())
            .on('error', (err: Error) => reject(err))
            .save(outPath);
        }),
        FFMPEG_TIMEOUT_MS,
        'ffmpeg transcode timed out',
      );

      await this.withTimeout(
        new Promise<void>((resolve, reject) => {
          ffmpeg(outPath)
            .screenshots({
              count: 1,
              timemarks: ['10%'],
              filename: 'poster.jpg',
              folder: jobDir,
            })
            .on('end', () => resolve())
            .on('error', (err: Error) => reject(err));
        }),
        FFMPEG_TIMEOUT_MS,
        'ffmpeg poster timed out',
      );

      const probe = await this.withTimeout(
        this.probe(outPath),
        FFMPEG_TIMEOUT_MS,
        'ffprobe (output) timed out',
      );
      const stream = probe.streams.find((s) => s.codec_type === 'video');
      const width = stream?.width ?? 0;
      const height = stream?.height ?? 0;
      const durSec = probe.format.duration ?? 0;

      const mp4 = await fs.readFile(outPath);
      const poster = await fs.readFile(posterPath);

      return {
        mp4,
        poster,
        width,
        height,
        durationMs: Math.round(durSec * 1000),
        bytes: mp4.byteLength,
      };
    } catch (err: unknown) {
      // Preserve BadRequestException (client-correctable); collapse everything
      // else into a single sanitized message.
      if (err instanceof BadRequestException) throw err;
      const msg = err instanceof Error ? err.message : 'transcode failed';
      this.logger.error(`Video transcode failed: ${msg}`);
      throw new BadRequestException(`Video processing failed: ${msg}`);
    } finally {
      await fs
        .rm(jobDir, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }

  private probe(path: string): Promise<ffmpeg.FfprobeData> {
    return new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(path, (err, data) => (err ? reject(err) : resolve(data)));
    });
  }

  private withTimeout<T>(
    p: Promise<T>,
    ms: number,
    message: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BadRequestException(message)), ms);
    });
    return Promise.race([p, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    }) as Promise<T>;
  }
}
