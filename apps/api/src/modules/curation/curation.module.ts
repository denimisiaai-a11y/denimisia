import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CurationController } from './curation.controller';
import { CurationService } from './curation.service';

@Module({
  imports: [PrismaModule],
  controllers: [CurationController],
  providers: [CurationService],
  exports: [CurationService],
})
export class CurationModule {}
