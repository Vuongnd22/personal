import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function toArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as string[];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export class QueryTasksDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  featureId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string; // uuid or "me"

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  status?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  priority?: string[];

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  overdue?: boolean;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['deadline', 'priority', 'createdAt', 'updatedAt', 'title', 'sortOrder'])
  sort?: 'deadline' | 'priority' | 'createdAt' | 'updatedAt' | 'title' | 'sortOrder';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}
