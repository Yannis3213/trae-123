import { Controller, Get, Post, Body, Param, Headers } from '@nestjs/common';
import { FieldRecordService } from './field-record.service';

@Controller('field-records')
export class FieldRecordController {
  constructor(private readonly service: FieldRecordService) {}

  @Get('task/:taskId')
  async listByTask(@Param('taskId') taskId: string) {
    return this.service.listByTask(taskId);
  }

  @Post()
  async create(
    @Body()
    body: {
      taskId: string;
      recordDate: string;
      recordType: string;
      content: string;
      weather?: string;
      remarks?: string;
    },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.service.create(body, userId, userRole);
  }
}
