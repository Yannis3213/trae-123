import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { BatchService } from './batch.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BatchProcessDto, BatchOverdueAdvanceDto } from '../common/dto';

@Controller('batch')
@UseGuards(JwtGuard, RolesGuard)
export class BatchController {
  constructor(private batchService: BatchService) {}

  @Post('process')
  process(@Body() dto: BatchProcessDto, @Req() req: any) {
    return { results: this.batchService.batchProcess(dto, req.user) };
  }

  @Post('overdue-advance')
  overdueAdvance(@Body() dto: BatchOverdueAdvanceDto, @Req() req: any) {
    return { results: this.batchService.batchOverdueAdvance(dto, req.user) };
  }
}
