import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { IsDateOnly } from '../../common/validation';

export class CreateFeatureDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateOnly()
  startDate?: string;

  @IsOptional()
  @IsDateOnly()
  deadline?: string;
}
