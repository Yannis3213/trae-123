import { IsString, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../../common/enums/order-status.enum';

export class UpdateGroupOrderDto {
  @ApiPropertyOptional({ description: '订单状态', enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsOptional()
  orderStatus?: OrderStatus;

  @ApiPropertyOptional({ description: '当前处理人' })
  @IsString()
  @IsOptional()
  currentHandler?: string;

  @ApiPropertyOptional({ description: '截止日期', type: String })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({ description: '材料是否完整' })
  @IsBoolean()
  @IsOptional()
  isMaterialComplete?: boolean;

  @ApiPropertyOptional({ description: '上架凭证' })
  @IsString()
  @IsOptional()
  shelfEvidence?: string;

  @ApiPropertyOptional({ description: '订单凭证' })
  @IsString()
  @IsOptional()
  orderEvidence?: string;

  @ApiPropertyOptional({ description: '履约凭证' })
  @IsString()
  @IsOptional()
  deliveryEvidence?: string;

  @ApiProperty({ description: '版本号' })
  @IsNumber()
  @IsNotEmpty()
  version: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({ description: '操作人' })
  @IsString()
  @IsNotEmpty()
  operator: string;

  @ApiProperty({ description: '操作人角色' })
  @IsString()
  @IsNotEmpty()
  operatorRole: string;
}
