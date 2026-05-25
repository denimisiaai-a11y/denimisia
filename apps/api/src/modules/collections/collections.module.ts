import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { CollectionsAutoService } from './collections.auto.service';

@Module({
  controllers: [CollectionsController],
  providers: [CollectionsService, CollectionsAutoService],
  exports: [CollectionsService, CollectionsAutoService],
})
export class CollectionsModule {}
