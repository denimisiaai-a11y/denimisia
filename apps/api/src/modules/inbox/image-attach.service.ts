import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { R2StorageService } from '../media/r2-storage.service';
import { ImageRef } from './inbox.types';

const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LONG_EDGE = 1600;
const JPEG_QUALITY = 75;

export interface InputImage {
  buffer: Buffer;
  mime: string;
}

@Injectable()
export class ImageAttachService {
  constructor(private readonly r2: R2StorageService) {}

  async attachMany(images: InputImage[]): Promise<ImageRef[]> {
    if (images.length > MAX_IMAGES) {
      throw new BadRequestException(`maximum 4 images per message`);
    }
    for (const img of images) {
      if (!ALLOWED_MIME.has(img.mime)) {
        throw new BadRequestException(`unsupported mime: ${img.mime}`);
      }
      if (img.buffer.length > MAX_BYTES) {
        throw new BadRequestException(`image size exceeds 5MB`);
      }
    }
    const refs: ImageRef[] = [];
    for (const img of images) {
      const processed = await sharp(img.buffer, { failOn: 'truncated' })
        .rotate()
        .resize(LONG_EDGE, LONG_EDGE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      const path = `inbox/${randomUUID()}.jpg`;
      const upload = await this.r2.uploadPublic(path, processed.data, 'image/jpeg');
      refs.push({
        url: upload.publicUrl,
        width: processed.info.width,
        height: processed.info.height,
        bytes: processed.data.length,
      });
    }
    return refs;
  }
}
