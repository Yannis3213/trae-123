import { Controller, Get, Post, Patch, Body, Param, Headers } from '@nestjs/common';
import { MaterialRequisitionService } from './material-requisition.service';

@Controller('material-requisitions')
export class MaterialRequisitionController {
  constructor(private readonly service: MaterialRequisitionService) {}

  @Get('task/:taskId')
  async listByTask(@Param('taskId') taskId: string) {
    return this.service.listByTask(taskId);
  }

  @Post()
  async create(
    @Body() body: { taskId: string; materialName: string; quantity: number; unit: string; remarks?: string },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.service.create(body, userId, userRole);
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.service.approve(id, userId, userRole);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: { remarks: string },
    @Headers('x-user-id') userId: string,
    @Headers('x-user-role') userRole: string,
  ) {
    return this.service.reject(id, body.remarks, userId, userRole);
  }
}
