import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class QueryProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsIn(['progress', 'updated', 'name', 'created'])
  sort?: 'progress' | 'updated' | 'name' | 'created';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
