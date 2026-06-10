import { IsString, IsOptional, IsNotEmpty, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchProcessDto {
  @ApiProperty({ description: '订单ID数组', type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  ids: number[];

  @ApiProperty({ description: '操作类型' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ description: '操作人' })
  @IsString()
  @IsNotEmpty()
  operator: string;

  @ApiProperty({ description: '操作人角色' })
  @IsString()
  @IsNotEmpty()
  operatorRole: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ description: '派发目标角色' })
  @IsString()
  @IsOptional()
  targetRole?: string;

  @ApiPropertyOptional({ description: '派发目标处理人' })
  @IsString()
  @IsOptional()
  targetHandler?: string;

  @ApiPropertyOptional({ description: '批量处理时的订单凭证' })
  @IsString()
  @IsOptional()
  orderEvidence?: string;

  @ApiPropertyOptional({ description: '批量关闭时的履约签收凭证' })
  @IsString()
  @IsOptional()
  deliveryEvidence?: string;

  @ApiPropertyOptional({ description: '批量退回原因' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: '批量退回到哪个角色' })
  @IsString()
  @IsOptional()
  returnToRole?: string;
}
