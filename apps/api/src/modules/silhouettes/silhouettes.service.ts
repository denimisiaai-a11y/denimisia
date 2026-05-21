import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SilhouetteGender } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSilhouetteDto } from './dto/update-silhouette.dto';

@Injectable()
export class SilhouettesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.silhouette.findMany({ orderBy: { gender: 'asc' } });
  }

  async updateByGender(gender: SilhouetteGender, dto: UpdateSilhouetteDto) {
    const exists = await this.prisma.silhouette.findUnique({ where: { gender } });
    if (!exists) {
      throw new NotFoundException(`Silhouette for gender ${gender} not found`);
    }
    const data: Prisma.SilhouetteUpdateInput = {
      version: { increment: 1 },
    };
    if (dto.svgPath !== undefined) data.svgPath = dto.svgPath;
    if (dto.viewBox !== undefined) data.viewBox = dto.viewBox;
    if (dto.landmarks !== undefined) data.landmarks = dto.landmarks;
    return this.prisma.silhouette.update({ where: { gender }, data });
  }
}
