import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtGuard } from '../common/guards/jwt.guard';

@Controller('audit')
@UseGuards(JwtGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('record/:id')
  getRecordAuditTrail(@Param('id') id: string) {
    return this.auditService.getRecordAuditTrail(parseInt(id, 10));
  }

  @Get('stats')
  getStats() {
    return this.auditService.getStats();
  }
}
