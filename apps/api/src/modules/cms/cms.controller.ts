import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CmsService } from './cms.service';
import {
  CreateSectionDto,
  UpdateSectionDto,
  CreateBannerDto,
  UpdateBannerDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from './cms.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('cms')
export class CmsController {
  constructor(private cmsService: CmsService) {}

  // ─── Public Routes ──────────────────────────────────────────────────────────

  @Get('sections')
  listSections() {
    return this.cmsService.listSections();
  }

  @Get('sections/:key')
  getSectionByKey(@Param('key') key: string) {
    return this.cmsService.getSectionByKey(key);
  }

  @Get('banners')
  listBanners() {
    return this.cmsService.listActiveBanners();
  }

  @Get('blog')
  listBlogPosts(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.cmsService.listPublishedPosts(
      Number(page) || 1,
      Number(limit) || 10,
    );
  }

  @Get('blog/:slug')
  getBlogPost(@Param('slug') slug: string) {
    return this.cmsService.getPostBySlug(slug);
  }

  // ─── Admin: Sections ────────────────────────────────────────────────────────

  @Post('sections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  createSection(@Body() dto: CreateSectionDto) {
    return this.cmsService.createSection(dto);
  }

  @Patch('sections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.cmsService.updateSection(id, dto);
  }

  @Delete('sections/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSection(@Param('id') id: string) {
    return this.cmsService.deleteSection(id);
  }

  // ─── Admin: Banners ─────────────────────────────────────────────────────────

  @Post('banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  createBanner(@Body() dto: CreateBannerDto) {
    return this.cmsService.createBanner(dto);
  }

  @Patch('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.cmsService.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBanner(@Param('id') id: string) {
    return this.cmsService.deleteBanner(id);
  }

  // ─── Admin: Blog Posts ──────────────────────────────────────────────────────

  @Post('blog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  createBlogPost(@CurrentUser() user: any, @Body() dto: CreateBlogPostDto) {
    return this.cmsService.createPost(user.id, dto);
  }

  @Patch('blog/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  updateBlogPost(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.cmsService.updatePost(id, dto);
  }

  @Delete('blog/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBlogPost(@Param('id') id: string) {
    return this.cmsService.deletePost(id);
  }
}
