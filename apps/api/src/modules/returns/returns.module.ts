import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { RtnIdService } from './rtn-id.service';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService, RtnIdService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
