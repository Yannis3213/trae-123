import { IsString, IsBoolean, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CorrectMaterialsDto {
  @ApiProperty({ description: '材料是否完整' })
  @IsBoolean()
  @IsNotEmpty()
  isMaterialComplete: boolean;

  @ApiPropertyOptional({ description: '上架凭证' })
  @IsString()
  @IsOptional()
  shelfEvidence?: string;

  @ApiPropertyOptional({ description: '订单凭证' })
  @IsString()
  @IsOptional()
  orderEvidence?: string;

  @ApiPropertyOptional({ description: '履约签收凭证' })
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
}
