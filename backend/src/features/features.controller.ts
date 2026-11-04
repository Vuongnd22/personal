import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeaturesController {
  constructor(private featuresService: FeaturesService) {}

  @Get('products/:productId/features')
  findAllForProduct(@Param('productId') productId: string) {
    return this.featuresService.findAllForProduct(productId);
  }

  @Post('products/:productId/features')
  @Roles('ADMIN', 'MANAGER')
  create(@Param('productId') productId: string, @Body() dto: CreateFeatureDto) {
    return this.featuresService.create(productId, dto);
  }

  @Get('features/:id')
  findOne(@Param('id') id: string) {
    return this.featuresService.findOne(id);
  }

  @Patch('features/:id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateFeatureDto) {
    return this.featuresService.update(id, dto);
  }

  @Delete('features/:id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('id') id: string) {
    return this.featuresService.remove(id);
  }
}
