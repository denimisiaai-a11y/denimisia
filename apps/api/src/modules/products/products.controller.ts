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
import { Throttle } from '@nestjs/throttler';
import { PublicCache } from '../../common/decorators/cache.decorator';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
  ProductQueryDto,
} from './products.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Get()
  @PublicCache()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('facets')
  @PublicCache(300, 900)
  getFacets() {
    return this.productsService.getFacets();
  }

  /**
   * Lean slug feed for sitemap generation. Cursor-paginated to stay under
   * Vercel's function duration limits and to keep SEO crawlers fast. Throttled
   * aggressively — legitimate sitemap generation calls this at most a few
   * times per hour; anything more is abuse.
   */
  @Get('slugs')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @PublicCache(600, 1800)
  getSlugs(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
    return this.productsService.getSlugFeed({ cursor, limit: take });
  }

  @Get('featured')
  @PublicCache(120, 600)
  findFeatured() {
    return this.productsService.findFeatured();
  }

  @Get('new-arrivals')
  @PublicCache(120, 600)
  findNewArrivals() {
    return this.productsService.findNewArrivals();
  }

  @Get('trending')
  @PublicCache(120, 600)
  findTrending() {
    return this.productsService.findTrending();
  }

  @Get(':slug')
  @PublicCache()
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // Size-chart by product id (NOT slug). Powered by ProductSizeChart rows
  // populated via the admin CRUD. Public so the bot + PDP size guide can
  // both render it without auth.
  @Get(':id/size-chart')
  @PublicCache(600, 1800)
  getSizeChart(@Param('id') id: string) {
    return this.productsService.getSizeChart(id);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  // Admin-only list: returns active AND inactive products (Prisma middleware
  // still filters soft-deleted). Public `/products` deliberately hides
  // inactive items from the storefront; this endpoint exists so admins can
  // see and re-activate them.
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  findAllForAdmin(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query, { includeInactive: true });
  }

  // Admin GET-by-id: the edit page passes a cuid here. Public storefront
  // uses `/products/:slug` instead — that route 404s for cuids, hence this
  // dedicated admin lookup.
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  findOneForAdmin(@Param('id') id: string) {
    return this.productsService.findByIdForAdmin(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@Param('id') id: string) {
    return this.productsService.softDelete(id);
  }

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  addVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.productsService.addVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
  ) {
    return this.productsService.deleteVariant(id, variantId);
  }
}
