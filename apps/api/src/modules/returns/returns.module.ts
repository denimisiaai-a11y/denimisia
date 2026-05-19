import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsAdminController } from './returns-admin.controller';
import { ReturnsService } from './returns.service';
import { RtnIdService } from './rtn-id.service';

@Module({
  controllers: [ReturnsController, ReturnsAdminController],
  providers: [ReturnsService, RtnIdService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
