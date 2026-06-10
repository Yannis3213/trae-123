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
}
