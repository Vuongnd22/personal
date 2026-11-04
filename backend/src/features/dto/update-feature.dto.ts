import { IsInt, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateFeatureDto } from './create-feature.dto';

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
