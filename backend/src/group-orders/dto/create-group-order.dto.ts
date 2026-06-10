import { IsString, IsNumber, IsDateString, IsOptional, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupOrderDto {
  @ApiProperty({ description: '商品名称' })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiProperty({ description: 'SKU编码' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ description: '上架日期', type: String })
  @IsDateString()
  shelfDate: string;

  @ApiProperty({ description: '团购价格' })
  @IsNumber()
  @Min(0)
  grouponPrice: number;

  @ApiProperty({ description: '数量' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: '订单凭证' })
  @IsString()
  @IsOptional()
  orderEvidence?: string;

  @ApiPropertyOptional({ description: '上架凭证' })
  @IsString()
  @IsOptional()
  shelfEvidence?: string;

  @ApiProperty({ description: '创建人' })
  @IsString()
  @IsNotEmpty()
  createdBy: string;
}
