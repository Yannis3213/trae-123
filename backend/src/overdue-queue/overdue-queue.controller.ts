import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { OverdueQueueService } from './overdue-queue.service';

@Controller('overdue-queue')
export class OverdueQueueController {
  constructor(private readonly service: OverdueQueueService) {}

  @Get()
  async list(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.service.list(userId, userRole);
  }

  @Post('batch-advance')
  async batchAdvance(
    @Body() body: { taskIds: string[]; evidence?: string },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ): Promise<{
    total: number;
    successCount: number;
    failCount: number;
    results: Array<{ taskId: string; taskNo: string; success: boolean; reason?: string }>;
  }> {
    return this.service.batchAdvance(body.taskIds, body.evidence, userId, userRole);
  }
}
