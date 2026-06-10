import { Controller, Post, Get, Put, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { GroupOrdersService } from './group-orders.service';
import { CreateGroupOrderDto } from './dto/create-group-order.dto';
import { QueryGroupOrderDto } from './dto/query-group-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { BatchProcessDto } from './dto/batch-process.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleGuard } from '../common/guards/role.guard';
import { UserRole } from '../common/enums/user-role.enum';

interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
}

interface AssignDto {
  assignToRole: UserRole;
  assignToHandler: string;
  deadline?: string;
  version: number;
  comment?: string;
}

interface ProcessDto {
  orderEvidence?: string;
  shelfEvidence?: string;
  version: number;
  comment?: string;
}

interface ReviewDto {
  deliveryEvidence: string;
  version: number;
  comment?: string;
}

interface CorrectMaterialsDto {
  isMaterialComplete?: boolean;
  shelfEvidence?: string;
  orderEvidence?: string;
  version: number;
  comment?: string;
}

interface AddAuditNoteDto {
  content: string;
}

interface AddAttachmentDto {
  fileName: string;
  fileType: string;
  fileUrl: string;
  evidenceType: 'shelf' | 'order' | 'delivery';
}

@ApiTags('团购订单')
@Controller('group-orders')
@UseGuards(RoleGuard)
export class GroupOrdersController {
  constructor(private readonly groupOrdersService: GroupOrdersService) {}

  @Post()
  @Roles(UserRole.GROUPON_REGISTRAR, UserRole.LEADER_OPERATOR)
  @ApiOperation({ summary: '创建团购订单' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  create(@Body() dto: CreateGroupOrderDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: '查询订单列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findAll(@Query() query: QueryGroupOrderDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取订单详情' })
  @ApiParam({ name: 'id', description: '订单ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.findOne(+id, user);
  }

  @Post(':id/assign')
  @Roles(UserRole.AUDIT_SUPERVISOR, UserRole.CITY_MANAGER)
  @ApiOperation({ summary: '派发订单' })
  @ApiParam({ name: 'id', description: '订单ID' })
  @ApiBody({
    schema: {
      properties: {
        assignToRole: { type: 'string', enum: Object.values(UserRole) },
        assignToHandler: { type: 'string' },
        deadline: { type: 'string', format: 'date-time', nullable: true },
        version: { type: 'number' },
        comment: { type: 'string', nullable: true },
      },
      required: ['assignToRole', 'assignToHandler', 'version'],
    },
  })
  @ApiResponse({ status: 200, description: '派发成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 409, description: '状态冲突或版本冲突' })
  assign(@Param('id') id: string, @Body() dto: AssignDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.assign(+id, dto, user);
  }

  @Post(':id/process')
  @Roles(UserRole.FULFILLMENT_SPECIALIST)
  @ApiOperation({ summary: '履约专员处理订单' })
  @ApiParam({ name: 'id', description: '订单ID' })
  @ApiBody({
    schema: {
      properties: {
        orderEvidence: { type: 'string' },
        shelfEvidence: { type: 'string', nullable: true },
        version: { type: 'number' },
        comment: { type: 'string', nullable: true },
      },
      required: ['orderEvidence', 'version'],
    },
  })
  @ApiResponse({ status: 200, description: '处理成功' })
  @ApiResponse({ status: 400, description: '缺少必填证据' })
  @ApiResponse({ status: 403, description: '权限不足或非当前处理人' })
  @ApiResponse({ status: 409, description: '状态冲突或版本冲突' })
  process(@Param('id') id: string, @Body() dto: ProcessDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.process(+id, dto, user);
  }

  @Post(':id/review')
  @Roles(UserRole.CITY_MANAGER, UserRole.REVIEW_LEADER)
  @ApiOperation({ summary: '复核归档订单' })
  @ApiParam({ name: 'id', description: '订单ID' })
  @ApiBody({
    schema: {
      properties: {
        deliveryEvidence: { type: 'string' },
        version: { type: 'number' },
        comment: { type: 'string', nullable: true },
      },
      required: ['deliveryEvidence', 'version'],
    },
  })
  @ApiResponse({ status: 200, description: '复核归档成功' })
  @ApiResponse({ status: 400, description: '缺少必填证据' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 409, description: '状态冲突或版本冲突' })
  review(@Param('id') id: string, @Body() dto: ReviewDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.review(+id, dto, user);
  }

  @Post(':id/return')
  @Roles(UserRole.AUDIT_SUPERVISOR, UserRole.REVIEW_LEADER, UserRole.CITY_MANAGER, UserRole.FULFILLMENT_SPECIALIST)
  @ApiOperation({ summary: '退回订单补正' })
  @ApiParam({ name: 'id', description: '订单ID' })
  @ApiResponse({ status: 200, description: '退回成功（含状态冲突提示）' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 409, description: '状态冲突或版本冲突' })
  returnOrder(@Param('id') id: string, @Body() dto: ReturnOrderDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.returnOrder(+id, dto, user);
  }

  @Post(':id/correct')
  @Roles(UserRole.LEADER_OPERATOR, UserRole.GROUPON_REGISTRAR)
  @ApiOperation({ summary: '补齐材料' })
  @ApiParam({ name: 'id', description: '订单ID' })
  @ApiBody({
    schema: {
      properties: {
        isMaterialComplete: { type: 'boolean', nullable: true },
        shelfEvidence: { type: 'string', nullable: true },
        orderEvidence: { type: 'string', nullable: true },
        version: { type: 'number' },
        comment: { type: 'string', nullable: true },
      },
      required: ['version'],
    },
  })
  @ApiResponse({ status: 200, description: '材料补正成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  @ApiResponse({ status: 409, description: '状态冲突或版本冲突' })
  correctMaterials(@Param('id') id: string, @Body() dto: CorrectMaterialsDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.correctMaterials(+id, dto, user);
  }

  @Post('batch')
  @Roles(UserRole.AUDIT_SUPERVISOR, UserRole.FULFILLMENT_SPECIALIST, UserRole.CITY_MANAGER, UserRole.REVIEW_LEADER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量处理订单（派发/处理/关闭/退回）' })
  @ApiBody({
    schema: {
      properties: {
        ids: { type: 'array', items: { type: 'number' } },
        action: { type: 'string', enum: ['assign', 'process', 'close', 'return'] },
        operator: { type: 'string' },
        operatorRole: { type: 'string' },
        comment: { type: 'string', nullable: true },
        targetRole: { type: 'string', nullable: true },
        targetHandler: { type: 'string', nullable: true },
        orderEvidence: { type: 'string', nullable: true },
        deliveryEvidence: { type: 'string', nullable: true },
        reason: { type: 'string', nullable: true },
        returnToRole: { type: 'string', nullable: true },
      },
      required: ['ids', 'action', 'operator', 'operatorRole'],
    },
  })
  @ApiResponse({ status: 200, description: '批量处理完成（含成功/失败逐条结果）' })
  @ApiResponse({ status: 403, description: '权限不足' })
  batchProcess(@Body() dto: BatchProcessDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.batchProcess(dto, user);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: '添加审计备注' })
  @ApiParam({ name: 'id', description: '订单ID' })
  @ApiBody({
    schema: {
      properties: {
        content: { type: 'string' },
      },
      required: ['content'],
    },
  })
  @ApiResponse({ status: 201, description: '备注添加成功' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  addAuditNote(@Param('id') id: string, @Body() dto: AddAuditNoteDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.addAuditNote(+id, dto.content, user);
  }

  @Post(':id/attachments')
  @ApiOperation({ summary: '添加附件' })
  @ApiParam({ name: 'id', description: '订单ID' })
  @ApiBody({
    schema: {
      properties: {
        fileName: { type: 'string' },
        fileType: { type: 'string' },
        fileUrl: { type: 'string' },
        evidenceType: { type: 'string', enum: ['shelf', 'order', 'delivery'] },
      },
      required: ['fileName', 'fileType', 'fileUrl', 'evidenceType'],
    },
  })
  @ApiResponse({ status: 201, description: '附件添加成功' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  addAttachment(@Param('id') id: string, @Body() dto: AddAttachmentDto, @CurrentUser() user: CurrentUser) {
    return this.groupOrdersService.addAttachment(+id, dto, user);
  }
}
