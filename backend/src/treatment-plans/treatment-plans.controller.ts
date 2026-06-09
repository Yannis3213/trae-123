import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { TreatmentPlansService } from './treatment-plans.service';
import {
  ProcessPlanDto,
  BatchProcessDto,
  AuditNoteDto,
  ProcessPlanByPlanIdDto,
  AuditNoteByPlanIdDto,
  CorrectDto,
} from './dto/treatment-plan.dto';
import { AuthGuard } from '../common/auth.guard';
import { TreatmentPlanStatus, UserRole, DeadlineWarning } from '../common/types';

@Controller('treatment-plans')
@UseGuards(AuthGuard)
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}

  @Get()
  findAll(
    @Query('status') status?: TreatmentPlanStatus,
    @Query('role') role?: UserRole,
    @Query('search') search?: string,
    @Query('keyword') keyword?: string,
    @Query('deadlineWarning') deadlineWarning?: DeadlineWarning,
    @Query('dueStatus') dueStatus?: DeadlineWarning,
  ) {
    const finalSearch = keyword || search;
    const finalDeadlineWarning = dueStatus || deadlineWarning;
    return this.service.findAll({
      status,
      role,
      search: finalSearch,
      deadlineWarning: finalDeadlineWarning,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post('process')
  processByPlanId(@Body() dto: ProcessPlanByPlanIdDto, @Req() req: Request) {
    return this.service.process(dto.planId, dto, req.user);
  }

  @Post(':id/process')
  process(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessPlanDto,
    @Req() req: Request,
  ) {
    return this.service.process(id, dto, req.user);
  }

  @Post('batch-process')
  batchProcess(@Body() dto: BatchProcessDto, @Req() req: Request) {
    return this.service.batchProcess(dto, req.user);
  }

  @Post('audit-note')
  addAuditNoteByPlanId(@Body() dto: AuditNoteByPlanIdDto, @Req() req: Request) {
    const noteText = dto.note || dto.content || '';
    return this.service.addAuditNote(dto.planId, { note: noteText }, req.user);
  }

  @Post(':id/audit-note')
  addAuditNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AuditNoteDto,
    @Req() req: Request,
  ) {
    return this.service.addAuditNote(id, dto, req.user);
  }

  @Post('correct')
  correct(@Body() dto: CorrectDto, @Req() req: Request) {
    return this.service.correct(dto, req.user);
  }
}
