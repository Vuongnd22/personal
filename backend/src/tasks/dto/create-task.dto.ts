import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { IsDateOnly } from '../../common/validation';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @IsUUID()
  featureId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsDateOnly()
  startDate?: string;

  @IsOptional()
  @IsDateOnly()
  deadline?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
