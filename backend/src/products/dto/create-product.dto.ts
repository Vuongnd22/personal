import { IsEnum, IsHexColor, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { IsDateOnly } from '../../common/validation';
import { ProductStatus } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

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
