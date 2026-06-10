import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  CreateAddressDto,
  UpdateAddressDto,
  FitProfileDto,
  CreateCustomerByAdminDto,
  AdminUpdateUserDto,
  CreateStaffDto,
} from './users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  // ─── Addresses ────────────────────────────────────────────────────────────

  @Get('me/addresses')
  getAddresses(@CurrentUser() user: any) {
    return this.usersService.getAddresses(user.id);
  }

  @Post('me/addresses')
  createAddress(@CurrentUser() user: any, @Body() dto: CreateAddressDto) {
    return this.usersService.createAddress(user.id, dto);
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @CurrentUser() user: any,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.usersService.updateAddress(user.id, addressId, dto);
  }

  @Delete('me/addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAddress(@CurrentUser() user: any, @Param('id') addressId: string) {
    return this.usersService.deleteAddress(user.id, addressId);
  }

  // ─── Fit profile ─────────────────────────────────────────────────────────

  // Persists ONE product-type sub-profile (e.g. PANTS measurements +
  // fitPref) under the caller's User.fitProfile JSON. Idempotent: posting
  // the same type twice overwrites the prior sub-profile. The class-level
  // JwtAuthGuard already covers auth, so no per-route guard is needed.
  @Post('me/fit-profile')
  saveFitProfile(@CurrentUser() user: any, @Body() dto: FitProfileDto) {
    return this.usersService.saveFitProfile(user.id, dto);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  // Admin-create a customer record. Role is forced to CUSTOMER server-side
  // (DTO doesn't accept role) so this endpoint can never mint another admin.
  // Creates a shadow record (no password, no email sent); customer claims
  // it later by self-registering with the same email.
  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  createCustomer(
    @Body() dto: CreateCustomerByAdminDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.usersService.createCustomerAsAdmin(dto, admin.id);
  }

  @Post('staff')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  createStaff(
    @Body() dto: CreateStaffDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.usersService.createStaff(dto, admin.id);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB, matches parser cap
    }),
  )
  bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() admin: { id: string },
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'No file uploaded; expected multipart field "file"',
      );
    }
    return this.usersService.bulkImport(file.buffer, admin.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.usersService.getAllUsers(page, limit);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  getUserById(@Param('id') userId: string) {
    return this.usersService.getUserById(userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivateUser(@Param('id') userId: string) {
    return this.usersService.deactivateUser(userId);
  }

  // ─── Admin edit + address CRUD ────────────────────────────────────────────

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  adminUpdateUser(
    @Param('id') userId: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.usersService.adminUpdateUser(userId, admin.id, dto);
  }

  @Post(':id/addresses')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  adminCreateAddress(
    @Param('id') userId: string,
    @Body() dto: CreateAddressDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.usersService.adminCreateAddress(userId, admin.id, dto);
  }

  @Patch(':id/addresses/:addressId')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  adminUpdateAddress(
    @Param('id') userId: string,
    @Param('addressId') addressId: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.usersService.adminUpdateAddress(
      userId,
      addressId,
      admin.id,
      dto,
    );
  }

  @Delete(':id/addresses/:addressId')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  adminDeleteAddress(
    @Param('id') userId: string,
    @Param('addressId') addressId: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.usersService.adminDeleteAddress(userId, addressId, admin.id);
  }
}
