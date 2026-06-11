import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { PlantingTaskService } from './planting-task.service';
import { RoleGuard } from './role.guard';

@Controller('planting-tasks')
export class PlantingTaskController {
  constructor(private readonly taskService: PlantingTaskService) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('role') role?: string,
    @Query('keyword') keyword?: string,
    @Query('overdueStatus') overdueStatus?: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') userRole?: string,
  ) {
    return this.taskService.list({
      status,
      assigneeId,
      role,
      keyword,
      overdueStatus,
      userId,
      userRole,
    });
  }

  @Get('statistics')
  async statistics(@Headers('x-user-id') userId?: string, @Headers('x-user-role') userRole?: string) {
    return this.taskService.statistics(userId, userRole);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.taskService.detail(id);
  }

  @Post()
  async create(
    @Body()
    body: {
      title: string;
      description?: string;
      planName?: string;
      planYear?: number;
      planMonth?: number;
      deadline?: string;
    },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.taskService.create(body, userId, userRole);
  }

  @Patch(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body() body: { assigneeId: string; version: number },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.taskService.assign(id, body.assigneeId, body.version, userId, userRole);
  }

  @Patch(':id/process')
  async process(
    @Param('id') id: string,
    @Body() body: { action: string; evidence?: string; version: number },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.taskService.process(id, body.action, body.evidence, body.version, userId, userRole);
  }

  @Patch(':id/transfer')
  async transfer(
    @Param('id') id: string,
    @Body() body: { targetAssigneeId: string; remarks?: string; version: number },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.taskService.transfer(
      id,
      body.targetAssigneeId,
      body.remarks,
      body.version,
      userId,
      userRole,
    );
  }

  @Patch(':id/follow-up')
  async followUp(
    @Param('id') id: string,
    @Body() body: { result: string; version: number },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.taskService.followUp(id, body.result, body.version, userId, userRole);
  }

  @Patch(':id/archive')
  async archive(
    @Param('id') id: string,
    @Body() body: { version: number },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.taskService.archive(id, body.version, userId, userRole);
  }

  @Patch(':id/return')
  async returnForCorrection(
    @Param('id') id: string,
    @Body() body: { reason: string; version: number },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.taskService.returnForCorrection(id, body.reason, body.version, userId, userRole);
  }

  @Post('batch-process')
  async batchProcess(
    @Body()
    body: {
      taskIds: string[];
      action: string;
      evidence?: string;
    },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.taskService.batchProcess(body.taskIds, body.action, body.evidence, userId, userRole);
  }

  @Get(':id/audit-logs')
  async auditLogs(@Param('id') id: string) {
    return this.taskService.auditLogs(id);
  }

  @Get(':id/processing-records')
  async processingRecords(@Param('id') id: string) {
    return this.taskService.processingRecords(id);
  }
}
