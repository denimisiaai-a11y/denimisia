import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsAdminController } from './returns-admin.controller';
import { ReturnsService } from './returns.service';
import { ReturnsRefundService } from './returns.refund.service';
import { RtnIdService } from './rtn-id.service';

@Module({
  controllers: [ReturnsController, ReturnsAdminController],
  providers: [ReturnsService, ReturnsRefundService, RtnIdService],
  exports: [ReturnsService, ReturnsRefundService],
})
export class ReturnsModule {}
