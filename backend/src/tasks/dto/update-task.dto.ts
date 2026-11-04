import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateIf((o) => o.assigneeId !== null)
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ValidateIf((o) => o.startDate !== null)
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ValidateIf((o) => o.deadline !== null)
  @IsOptional()
  @IsDateString()
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
