import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { SilhouetteGender } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SilhouettesService } from './silhouettes.service';
import {
  updateSilhouetteSchema,
  type UpdateSilhouetteDto,
} from './dto/update-silhouette.dto';

const ALLOWED_GENDERS = new Set<SilhouetteGender>(['MALE', 'FEMALE']);

@Controller('admin/silhouettes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
export class SilhouettesAdminController {
  constructor(private readonly service: SilhouettesService) {}

  @Put(':gender')
  update(
    @Param('gender') gender: string,
    @Body(new ZodValidationPipe(updateSilhouetteSchema)) dto: UpdateSilhouetteDto,
  ) {
    const normalised = gender.toUpperCase() as SilhouetteGender;
    if (!ALLOWED_GENDERS.has(normalised)) {
      throw new BadRequestException(
        `Gender must be one of: ${Array.from(ALLOWED_GENDERS).join(', ')}`,
      );
    }
    return this.service.updateByGender(normalised, dto);
  }
}
