import { Controller, Get, Post, Put, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { RecordsService } from './records.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateRecordDto, UpdateStatusDto, AddAuditNoteDto, AddAttachmentDto } from '../common/dto';

@Controller('records')
@UseGuards(JwtGuard, RolesGuard)
export class RecordsController {
  constructor(private recordsService: RecordsService) {}

  @Get()
  list(
    @Query('status') status: string,
    @Query('role') role: string,
    @Query('handler') handler: string,
    @Query('expiry_status') expiryStatus: string,
    @Req() req: any,
  ) {
    return { records: this.recordsService.list({ status, role, handler, expiry_status: expiryStatus }, req.user) };
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    const result = this.recordsService.getDetail(parseInt(id, 10));
    if (!result) {
      return { error: '记录不存在' };
    }
    return result;
  }

  @Post()
  @Roles('financial_advisor')
  create(@Body() dto: CreateRecordDto, @Req() req: any) {
    return this.recordsService.create(dto, req.user);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req: any) {
    return this.recordsService.updateStatus(parseInt(id, 10), dto, req.user);
  }

  @Put(':id/correction')
  submitCorrection(@Param('id') id: string, @Req() req: any, @Body() body?: { comment?: string }) {
    return this.recordsService.submitCorrection(parseInt(id, 10), req.user, body?.comment);
  }

  @Post(':id/attachments')
  addAttachment(@Param('id') id: string, @Body() dto: AddAttachmentDto, @Req() req: any) {
    return this.recordsService.addAttachment(parseInt(id, 10), dto, req.user);
  }

  @Post(':id/audit-notes')
  addAuditNote(@Param('id') id: string, @Body() dto: AddAuditNoteDto, @Req() req: any) {
    return this.recordsService.addAuditNote(parseInt(id, 10), dto, req.user);
  }
}
