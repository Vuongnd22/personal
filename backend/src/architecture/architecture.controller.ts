import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ArchitectureService } from './architecture.service';
import { SaveDiagramDto } from './architecture.dto';

@Controller('products/:productId/architecture')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ArchitectureController {
  constructor(private architecture: ArchitectureService) {}

  @Get()
  get(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return this.architecture.get(productId);
  }

  @Put()
  @Roles('ADMIN', 'MANAGER')
  save(@Param('productId', new ParseUUIDPipe()) productId: string, @Body() dto: SaveDiagramDto) {
    return this.architecture.save(productId, dto);
  }
}
