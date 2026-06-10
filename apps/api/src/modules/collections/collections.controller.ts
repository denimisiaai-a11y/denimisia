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
} from '@nestjs/common';
import { PublicCache } from '../../common/decorators/cache.decorator';
import { CollectionsService } from './collections.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  AddProductsToCollectionDto,
  ReorderProductsDto,
  UpsertLookbookItemDto,
} from './collections.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('collections')
export class CollectionsController {
  constructor(private collectionsService: CollectionsService) {}

  // ─── Public reads ──────────────────────────────────────────────────────────

  @Get()
  @PublicCache(120, 600)
  findAll() {
    return this.collectionsService.findAll();
  }

  @Get(':slug')
  @PublicCache(120, 600)
  findBySlug(@Param('slug') slug: string) {
    return this.collectionsService.findBySlug(slug);
  }

  @Get(':slug/resolved')
  @PublicCache(60, 300)
  findResolved(@Param('slug') slug: string) {
    return this.collectionsService.findBySlugResolved(slug);
  }

  // ─── Admin reads ───────────────────────────────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  findAllAdmin() {
    return this.collectionsService.findAllAdmin();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  findByIdAdmin(@Param('id') id: string) {
    return this.collectionsService.findByIdAdmin(id);
  }

  // ─── Admin writes ──────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  create(@Body() dto: CreateCollectionDto) {
    return this.collectionsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  update(@Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.collectionsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.collectionsService.delete(id);
  }

  // ─── Product attachment ────────────────────────────────────────────────────

  @Post(':id/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  addProducts(
    @Param('id') id: string,
    @Body() dto: AddProductsToCollectionDto,
  ) {
    return this.collectionsService.addProducts(id, dto);
  }

  @Delete(':id/products/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.collectionsService.removeProduct(id, productId);
  }

  @Patch(':id/products/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  reorderProducts(
    @Param('id') id: string,
    @Body() dto: ReorderProductsDto,
  ) {
    return this.collectionsService.reorderProducts(id, dto.productIds);
  }

  // ─── Lookbook ──────────────────────────────────────────────────────────────

  @Post(':id/lookbook')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  addLookbookItem(
    @Param('id') id: string,
    @Body() dto: UpsertLookbookItemDto,
  ) {
    return this.collectionsService.upsertLookbookItem(id, dto);
  }

  @Delete('lookbook/:lookbookId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLookbookItem(@Param('lookbookId') lookbookId: string) {
    return this.collectionsService.removeLookbookItem(lookbookId);
  }
}
