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
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AddCampaignProductDto } from './dto/add-campaign-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('campaigns')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  // ─── Public ───────────────────────────────────────────────────────────────────

  @Get()
  findActive(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.campaignsService.findActive(
      Math.max(Number(page) || 1, 1),
      Math.min(Number(limit) || 20, 100),
    );
  }

  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.campaignsService.findBySlugPublic(slug);
  }

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  findAllAdmin(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.campaignsService.findAllAdmin(
      Math.max(Number(page) || 1, 1),
      Math.min(Number(limit) || 20, 100),
    );
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  findOneAdmin(@Param('id') id: string) {
    return this.campaignsService.findOneAdmin(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOnePublic(id);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  // ─── Campaign Products (Admin) ────────────────────────────────────────────────

  @Post(':id/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  addProduct(@Param('id') id: string, @Body() dto: AddCampaignProductDto) {
    return this.campaignsService.addProduct(id, dto);
  }

  @Delete(':id/products/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.campaignsService.removeProduct(id, productId);
  }
}
