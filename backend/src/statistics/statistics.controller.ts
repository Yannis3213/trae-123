import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { AuthGuard } from '../common/auth.guard';

@Controller('statistics')
@UseGuards(AuthGuard)
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @Get()
  getStatistics() {
    return this.service.getStatistics();
  }

  @Get('due-warning')
  getDueWarning() {
    return this.service.getDueWarning();
  }
}
