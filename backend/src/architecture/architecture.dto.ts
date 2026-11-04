import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsHexColor, IsNumber, IsOptional, IsString, IsUUID, MaxLength, ValidateNested,
} from 'class-validator';
import { EdgeDirection, NodeKind } from '@prisma/client';

class PositionDto {
  @IsNumber() x!: number;
  @IsNumber() y!: number;
}

export class NodeDto {
  @IsUUID() id!: string;
  @IsEnum(NodeKind) kind!: NodeKind;
  @IsOptional() @IsString() @MaxLength(2000) label?: string;
  @IsOptional() @IsUUID() refProductId?: string | null;
  @IsOptional() @IsUUID() featureId?: string | null;
  @ValidateNested() @Type(() => PositionDto) position!: PositionDto;
  @IsOptional() @IsNumber() width?: number | null;
  @IsOptional() @IsNumber() height?: number | null;
  @IsOptional() @IsBoolean() isCenter?: boolean;
  @IsOptional() @IsHexColor() color?: string | null;
}

export class ConnectionDto {
  @IsUUID() id!: string;
  @IsUUID() sourceNodeId!: string;
  @IsUUID() targetNodeId!: string;
  @IsOptional() @IsString() sourceHandle?: string | null;
  @IsOptional() @IsString() targetHandle?: string | null;
  @IsOptional() @IsString() @MaxLength(200) label?: string;
  @IsOptional() @IsEnum(EdgeDirection) direction?: EdgeDirection;
}

export class SaveDiagramDto {
  @IsOptional() @IsString() baseUpdatedAt?: string | null;
  @IsArray() @ValidateNested({ each: true }) @Type(() => NodeDto) nodes!: NodeDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ConnectionDto) connections!: ConnectionDto[];
}
