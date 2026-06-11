import { Controller, Get, UseGuards } from '@nestjs/common';
import { ExpiryService } from './expiry.service';
import { JwtGuard } from '../common/guards/jwt.guard';

@Controller('expiry')
@UseGuards(JwtGuard)
export class ExpiryController {
  constructor(private expiryService: ExpiryService) {}

  @Get('summary')
  getSummary() {
    return this.expiryService.getSummary();
  }

  @Get('normal')
  getNormalRecords() {
    return { records: this.expiryService.getNormalRecords() };
  }

  @Get('near-expiry')
  getNearExpiryRecords() {
    return { records: this.expiryService.getNearExpiryRecords() };
  }

  @Get('overdue')
  getOverdueRecords() {
    return { records: this.expiryService.getOverdueRecords() };
  }
}
