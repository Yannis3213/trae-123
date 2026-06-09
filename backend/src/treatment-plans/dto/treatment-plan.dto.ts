import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, IsBoolean, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { AttachmentType, ExceptionType } from '../../common/types';

export class AttachmentDto {
  @IsString()
  @IsNotEmpty()
  type: AttachmentType;

  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  url: string;
}

export class ExceptionCauseDto {
  @IsString()
  @IsNotEmpty()
  type: ExceptionType;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class ProcessPlanDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsNumber()
  @IsNotEmpty()
  version: number;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  evidence?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  @IsBoolean()
  materialsComplete?: boolean;

  @IsOptional()
  @IsBoolean()
  planComplete?: boolean;

  @IsOptional()
  @IsBoolean()
  reminderComplete?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExceptionCauseDto)
  exceptionCause?: ExceptionCauseDto;
}

export class BatchProcessItemDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @IsString()
  @IsNotEmpty()
  action: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  version: number;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsString()
  evidence?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  @IsOptional()
  @IsBoolean()
  materialsComplete?: boolean;

  @IsOptional()
  @IsBoolean()
  planComplete?: boolean;

  @IsOptional()
  @IsBoolean()
  reminderComplete?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExceptionCauseDto)
  exceptionCause?: ExceptionCauseDto;
}

export class BatchProcessDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchProcessItemDto)
  items: BatchProcessItemDto[];
}

export class AuditNoteDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}

export class ProcessPlanByPlanIdDto extends ProcessPlanDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  planId: number;
}

export class AuditNoteByPlanIdDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  planId: number;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export type CorrectModule =
  | AttachmentType
  | 'patient_profile'
  | 'treatment_plan'
  | 'follow_up_reminder';

export class CorrectDto {
  @IsString()
  @IsNotEmpty()
  module: CorrectModule;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  planId: number;

  @IsOptional()
  @IsObject()
  data?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
