import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { PublicCache } from '../../common/decorators/cache.decorator';
import { CmsService } from './cms.service';
import {
  CreateBannerDto,
  UpdateBannerDto,
  CreateHomepageSectionDto,
  UpdateHomepageSectionDto,
  ReorderHomepageSectionsDto,
  UpdateGlobalStylesDto,
} from './cms.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import type { Request } from 'express';

interface AuthedRequest extends Request {
  user?: { id: string };
}

@Controller('cms')
export class CmsController {
  constructor(private cmsService: CmsService) {}

  // ─── Public ────────────────────────────────────────────────────────────────

  @Get('banners')
  @PublicCache(60, 300)
  listBanners() {
    return this.cmsService.listActiveBanners();
  }

  @Get('homepage/sections/active')
  @PublicCache(60, 300)
  listActiveHomepageSections() {
    return this.cmsService.listActiveSections();
  }

  @Get('homepage/styles')
  @PublicCache(300, 1800)
  getStyles() {
    return this.cmsService.getStyles();
  }

  // ─── Admin: Homepage Section Composer ──────────────────────────────────────

  @Get('homepage/sections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  listAllHomepageSections() {
    return this.cmsService.listAllSections();
  }

  @Post('homepage/sections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  createHomepageSection(
    @Body() dto: CreateHomepageSectionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.cmsService.createSection(dto, req.user?.id);
  }

  @Patch('homepage/sections/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  reorderHomepageSections(
    @Body() dto: ReorderHomepageSectionsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.cmsService.reorderSections(dto, req.user?.id);
  }

  @Patch('homepage/sections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  updateHomepageSection(
    @Param('id') id: string,
    @Body() dto: UpdateHomepageSectionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.cmsService.updateSection(id, dto, req.user?.id);
  }

  @Delete('homepage/sections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteHomepageSection(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.cmsService.deleteSection(id, req.user?.id);
  }

  @Patch('homepage/styles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  updateStyles(
    @Body() dto: UpdateGlobalStylesDto,
    @Req() req: AuthedRequest,
  ) {
    return this.cmsService.updateStyles(dto, req.user?.id);
  }

  // ─── Admin: Banners ─────────────────────────────────────────────────────────

  @Post('banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  createBanner(@Body() dto: CreateBannerDto) {
    return this.cmsService.createBanner(dto);
  }

  @Patch('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.cmsService.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBanner(@Param('id') id: string) {
    return this.cmsService.deleteBanner(id);
  }
}
