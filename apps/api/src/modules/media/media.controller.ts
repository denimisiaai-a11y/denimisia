import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MediaService } from './media.service';
import { UpdateSlotDto } from './media.dto';
import { SLOT_SPECS } from './media.config';

interface AuthedRequest extends Request {
  user?: { id?: string };
}

/**
 * Public-facing slot shape — stripped to only what the storefront renders.
 * Keeps internal storage keys, bucket names, content hashes, uploader IDs,
 * and history pointers out of unauthenticated responses.
 */
interface PublicSlot {
  readonly id: string;
  readonly slotKey: string;
  readonly pageKey: string;
  readonly label: string;
  readonly mediaKind: string;
  readonly acceptsVideo: boolean;
  readonly groupKey: string | null;
  readonly specWidth: number;
  readonly specHeight: number;
  readonly specAspect: string;
  readonly maxBytes: number;
  readonly altText: string | null;
  readonly isActive: boolean;
  readonly heading: string | null;
  readonly subheading: string | null;
  readonly body: string | null;
  readonly ctaLabel: string | null;
  readonly ctaHref: string | null;
  readonly position: number;
  readonly assetId: string | null;
  readonly asset: {
    readonly id: string;
    readonly publicUrl: string;
    readonly posterUrl: string | null;
    readonly width: number | null;
    readonly height: number | null;
    readonly kind: string;
    readonly mime: string;
    readonly bytes: number;
  } | null;
}

type RawSlot = Awaited<ReturnType<MediaService['listPage']>>['slots'][number];

function toPublicSlot(slot: RawSlot): PublicSlot {
  return {
    id: slot.id,
    slotKey: slot.slotKey,
    pageKey: slot.pageKey,
    label: slot.label,
    mediaKind: slot.mediaKind,
    acceptsVideo: slot.acceptsVideo,
    groupKey: slot.groupKey,
    specWidth: slot.specWidth,
    specHeight: slot.specHeight,
    specAspect: slot.specAspect,
    maxBytes: slot.maxBytes,
    altText: slot.altText,
    isActive: slot.isActive,
    heading: slot.heading,
    subheading: slot.subheading,
    body: slot.body,
    ctaLabel: slot.ctaLabel,
    ctaHref: slot.ctaHref,
    position: slot.position,
    assetId: slot.assetId,
    asset: slot.asset
      ? {
          id: slot.asset.id,
          publicUrl: slot.asset.publicUrl,
          posterUrl: slot.asset.posterUrl,
          width: slot.asset.width,
          height: slot.asset.height,
          kind: slot.asset.kind,
          mime: slot.asset.mime,
          bytes: slot.asset.bytes,
        }
      : null,
  };
}

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  // ─── Public read: storefront pulls slots by page ──────────────────────────

  @Get('slots')
  async listByPage(@Query('page') page: string) {
    if (!page) return { slots: [], specs: SLOT_SPECS };
    const result = await this.media.listPage(page);
    return {
      slots: result.slots.map(toPublicSlot),
      specs: result.specs,
    };
  }

  @Get('specs')
  specs() {
    return { specs: SLOT_SPECS };
  }

  // ─── Admin operations ─────────────────────────────────────────────────────

  @Get('admin/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  adminListAll() {
    return this.media.listAll();
  }

  @Get('admin/storage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  storage() {
    return this.media.storageStats();
  }

  @Post('admin/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  // Image uploads go through sharp; video uploads pass through transcodeVideo
  // from the same handler. The tighter video cap is enforced inside the
  // service via rate-limit key; here we apply the general upload limit.
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 40 * 1024 * 1024 },
    }),
  )
  async upload(
    @Query('page') pageKey: string,
    @Query('slot') slotKey: string,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    @Req() req: AuthedRequest,
  ) {
    return this.media.upload({
      pageKey,
      slotKey,
      buffer: file.buffer,
      originalFilename: file.originalname,
      uploadedById: req.user?.id,
    });
  }

  @Post('admin/upload-asset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  // Tighter cap: this endpoint may transcode video and is the most expensive
  // route in the module. 3/min/IP protects the ffmpeg pool from abuse.
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 40 * 1024 * 1024 } }),
  )
  async uploadAsset(
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: { buffer: Buffer; originalname: string },
    @Req() req: AuthedRequest,
  ) {
    // TODO(media-schema): add originalFilename column to MediaAsset so the
    // filename is queryable for forensics. For now it's logged via pino-equivalent.
    return this.media.uploadAsset(file.buffer, req.user?.id, file.originalname);
  }

  @Patch('admin/slots/:pageKey/:slotKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  async updateSlot(
    @Param('pageKey') pageKey: string,
    @Param('slotKey') slotKey: string,
    @Body() dto: UpdateSlotDto,
    @Req() req: AuthedRequest,
  ) {
    return this.media.updateSlot(pageKey, slotKey, dto, req.user?.id);
  }

  @Get('admin/history/:slotId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  history(@Param('slotId') slotId: string) {
    return this.media.historyFor(slotId);
  }

  @Put('admin/rollback/:slotId/:historyId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  rollback(
    @Param('slotId') slotId: string,
    @Param('historyId') historyId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.media.rollback(slotId, historyId, req.user?.id);
  }
}
