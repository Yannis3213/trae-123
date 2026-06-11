import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  async list(
    @Query('taskId') taskId?: string,
    @Query('operatorId') operatorId?: string,
    @Query('action') action?: string,
  ) {
    return this.service.list({ taskId, operatorId, action });
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.service.detail(id);
  }
}
