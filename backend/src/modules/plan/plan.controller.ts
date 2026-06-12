import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { PlanService } from './plan.service';
import {
  CreatePlanDto,
  ReviewPlanDto,
  VerifyPlanDto,
  CorrectPlanDto,
  BatchSignDto,
  BatchVerifyDto,
  QueryPlanDto,
} from './dto';

@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Post('seed')
  async seed() {
    const data = await this.planService.seedDemoData();
    return { code: 0, message: 'ok', data };
  }

  @Get()
  async findAll(@Query() query: QueryPlanDto) {
    const data = await this.planService.findAll(query);
    return { code: 0, message: 'ok', data };
  }

  @Get('stats')
  async getStats() {
    const data = await this.planService.getStats();
    return { code: 0, message: 'ok', data };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.planService.findOne(id);
    return { code: 0, message: 'ok', data };
  }

  @Post()
  async create(@Body() dto: CreatePlanDto) {
    const data = await this.planService.create(dto);
    return { code: 0, message: 'ok', data };
  }

  @Post(':id/sign')
  async sign(@Param('id', ParseIntPipe) id: number, @Body() body: { version: number }) {
    const data = await this.planService.sign(id, body.version);
    return { code: 0, message: 'ok', data };
  }

  @Post(':id/review')
  async review(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewPlanDto) {
    const data = await this.planService.review(id, dto);
    return { code: 0, message: 'ok', data };
  }

  @Post(':id/return')
  async returnPlan(@Param('id', ParseIntPipe) id: number, @Body() body: { returnReason: string; version: number }) {
    const data = await this.planService.review(id, {
      result: 'return',
      returnReason: body.returnReason,
      version: body.version,
    });
    return { code: 0, message: 'ok', data };
  }

  @Post(':id/correct')
  async correct(@Param('id', ParseIntPipe) id: number, @Body() dto: CorrectPlanDto) {
    const data = await this.planService.correct(id, dto);
    return { code: 0, message: 'ok', data };
  }

  @Post(':id/verify')
  async verify(@Param('id', ParseIntPipe) id: number, @Body() dto: VerifyPlanDto) {
    const data = await this.planService.verify(id, dto);
    return { code: 0, message: 'ok', data };
  }

  @Post(':id/reject')
  async reject(@Param('id', ParseIntPipe) id: number, @Body() body: { rejectReason: string; version: number }) {
    const data = await this.planService.verify(id, {
      result: 'reject',
      rejectReason: body.rejectReason,
      version: body.version,
    });
    return { code: 0, message: 'ok', data };
  }

  @Post('batch-sign')
  async batchSign(@Body() dto: BatchSignDto) {
    const data = await this.planService.batchSign(dto);
    return { code: 0, message: 'ok', data };
  }

  @Post('batch-verify')
  async batchVerify(@Body() dto: BatchVerifyDto) {
    const data = await this.planService.batchVerify(dto);
    return { code: 0, message: 'ok', data };
  }

  @Get(':id/audit-trail')
  async getAuditTrail(@Param('id', ParseIntPipe) id: number) {
    const data = await this.planService.getAuditTrail(id);
    return { code: 0, message: 'ok', data };
  }

  @Get(':id/attachments')
  async getAttachments(@Param('id', ParseIntPipe) id: number) {
    const data = await this.planService.getAttachments(id);
    return { code: 0, message: 'ok', data };
  }

  @Post(':id/attachments')
  async uploadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { fileName: string; fileType: string; fileSize: number },
  ) {
    const data = await this.planService.uploadAttachment(id, body.fileName, body.fileType, body.fileSize);
    return { code: 0, message: 'ok', data };
  }

  @Post(':id/audit-notes')
  async addAuditNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content: string },
  ) {
    const data = await this.planService.addAuditNote(id, body.content);
    return { code: 0, message: 'ok', data };
  }
}
