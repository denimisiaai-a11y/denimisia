import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurationService } from './curation.service';
import {
  AddSectionProductDto,
  BulkAddProductsDto,
  ReorderSectionProductsDto,
  UpdateSectionProductDto,
  UpsertCurationDto,
} from './curation.dto';

@Controller('curation')
export class CurationController {
  constructor(private readonly curation: CurationService) {}

  // ─── Admin: product typeahead search ─────────────────────────────────────
  //
  // IMPORTANT: All admin/* routes MUST be declared BEFORE the public
  // `:pageKey/:sectionKey` catch-all below, otherwise NestJS matches the
  // dynamic route first and treats 'admin' as a pageKey (shadowing this
  // route). Same applies to any future literal-prefixed routes.

  @Get('admin/search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  search(@Query('q') q = '', @Query('limit') limit = '10') {
    return this.curation.searchProducts(q, Number(limit) || 10);
  }

  // ─── Public: storefront reads resolved section ───────────────────────────

  @Get(':pageKey/:sectionKey')
  resolve(
    @Param('pageKey') pageKey: string,
    @Param('sectionKey') sectionKey: string,
  ) {
    return this.curation.resolve(pageKey, sectionKey);
  }

  // ─── Admin: list all sections on a page ──────────────────────────────────

  @Get('admin/page/:pageKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  listByPage(@Param('pageKey') pageKey: string) {
    return this.curation.listByPage(pageKey);
  }

  // ─── Admin: get raw curation config ──────────────────────────────────────

  @Get('admin/:pageKey/:sectionKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  getAdmin(
    @Param('pageKey') pageKey: string,
    @Param('sectionKey') sectionKey: string,
    @Query('label') label?: string,
  ) {
    return this.curation.getOrCreate(pageKey, sectionKey, label);
  }

  // ─── Admin: upsert curation config ───────────────────────────────────────

  @Put('admin/:pageKey/:sectionKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  upsert(
    @Param('pageKey') pageKey: string,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: UpsertCurationDto,
  ) {
    return this.curation.upsert(pageKey, sectionKey, dto);
  }

  // ─── Admin: section-product operations ───────────────────────────────────

  @Post('admin/:pageKey/:sectionKey/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  addProduct(
    @Param('pageKey') pageKey: string,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: AddSectionProductDto,
  ) {
    return this.curation.addProduct(pageKey, sectionKey, dto);
  }

  @Patch('admin/products/:sectionProductId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  updateProduct(
    @Param('sectionProductId') sectionProductId: string,
    @Body() dto: UpdateSectionProductDto,
  ) {
    return this.curation.updateProduct(sectionProductId, dto);
  }

  @Delete('admin/products/:sectionProductId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  removeProduct(@Param('sectionProductId') sectionProductId: string) {
    return this.curation.removeProduct(sectionProductId);
  }

  @Post('admin/:pageKey/:sectionKey/products/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  bulkAdd(
    @Param('pageKey') pageKey: string,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: BulkAddProductsDto,
  ) {
    return this.curation.addProductsBulk(pageKey, sectionKey, dto.productIds);
  }

  @Post('admin/:pageKey/:sectionKey/fill-from-collection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  fillFromCollection(
    @Param('pageKey') pageKey: string,
    @Param('sectionKey') sectionKey: string,
  ) {
    return this.curation.fillFromCollection(pageKey, sectionKey);
  }

  @Put('admin/:pageKey/:sectionKey/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  reorder(
    @Param('pageKey') pageKey: string,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: ReorderSectionProductsDto,
  ) {
    return this.curation.reorder(pageKey, sectionKey, dto.orderedProductIds);
  }
}
