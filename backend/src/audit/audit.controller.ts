import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  findAll(
    @Query('orderId') orderId?: string,
    @Query('operator') operator?: string,
  ) {
    return this.auditService.findAll({ orderId, operator });
  }
}
