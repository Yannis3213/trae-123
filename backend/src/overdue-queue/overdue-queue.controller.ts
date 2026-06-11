import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { OverdueQueueService } from './overdue-queue.service';

interface OverdueTaskItem {
  id: string;
  taskNo: string;
  title: string;
  status: string;
  statusLabel: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeRole?: string;
  deadline: string;
  overdueStatus: string;
  overdueStatusLabel: string;
  daysRemaining: number;
  version: number;
  nextAction?: string;
  nextActionLabel?: string;
  canAdvance: boolean;
  blockReason?: string;
}

interface OverdueGroupResult {
  count: number;
  items: OverdueTaskItem[];
}

interface OverdueQueueResult {
  normal: OverdueGroupResult;
  nearExpiry: OverdueGroupResult;
  overdue: OverdueGroupResult;
  byAssignee: Array<{
    assigneeId: string;
    assigneeName: string;
    normalCount: number;
    nearExpiryCount: number;
    overdueCount: number;
  }>;
  totalCount: number;
}

interface BatchAdvanceResultItem {
  taskId: string;
  taskNo: string;
  success: boolean;
  reason?: string;
  beforeStatus?: string;
  afterStatus?: string;
  action?: string;
}

interface BatchAdvanceResult {
  total: number;
  successCount: number;
  failCount: number;
  results: BatchAdvanceResultItem[];
}

@Controller('overdue-queue')
export class OverdueQueueController {
  constructor(private readonly service: OverdueQueueService) {}

  @Get()
  async list(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ): Promise<OverdueQueueResult> {
    return this.service.list(userId, userRole);
  }

  @Post('batch-advance')
  async batchAdvance(
    @Body() body: { taskIds: string[]; evidence?: string },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ): Promise<BatchAdvanceResult> {
    return this.service.batchAdvance(body.taskIds, body.evidence, userId, userRole);
  }
}
