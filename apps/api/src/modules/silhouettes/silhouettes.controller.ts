import { Controller, Get } from '@nestjs/common';
import { SilhouettesService } from './silhouettes.service';

@Controller('silhouettes')
export class SilhouettesController {
  constructor(private readonly service: SilhouettesService) {}

  @Get()
  list() {
    return this.service.findAll();
  }
}
