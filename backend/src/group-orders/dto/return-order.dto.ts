import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReturnOrderDto {
  @ApiProperty({ description: '退回原因' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: '退回到的角色' })
  @IsString()
  @IsNotEmpty()
  returnToRole: string;

  @ApiProperty({ description: '操作人' })
  @IsString()
  @IsNotEmpty()
  operator: string;

  @ApiProperty({ description: '操作人角色' })
  @IsString()
  @IsNotEmpty()
  operatorRole: string;

  @ApiProperty({ description: '版本号' })
  @IsNumber()
  @IsNotEmpty()
  version: number;

  @ApiProperty({ description: '备注' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}
