import { Module } from '@nestjs/common';
import { SilhouettesController } from './silhouettes.controller';
import { SilhouettesAdminController } from './silhouettes-admin.controller';
import { SilhouettesService } from './silhouettes.service';

@Module({
  controllers: [SilhouettesController, SilhouettesAdminController],
  providers: [SilhouettesService],
  exports: [SilhouettesService],
})
export class SilhouettesModule {}
