import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CheckPermissionDto } from './permissions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, Role } from '../../common/decorators/roles.decorator';

@Controller('permissions')
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  @Get('role/:role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  getPermissionsByRole(@Param('role') role: string) {
    return this.permissionsService.getPermissionsByRole(role);
  }

  @Post('check')
  @UseGuards(JwtAuthGuard)
  checkPermission(@CurrentUser() user: any, @Body() dto: CheckPermissionDto) {
    const allowed = this.permissionsService.checkPermission(
      user.role,
      dto.resource,
      dto.action,
    );
    return {
      allowed,
      role: user.role,
      resource: dto.resource,
      action: dto.action,
    };
  }
}
