import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { IsDateOnly } from '../../common/validation';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @IsDateOnly()
  startDate?: string | null;

  @IsOptional()
  @IsDateOnly()
  deadline?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsUUID()
  featureId?: string;
}
