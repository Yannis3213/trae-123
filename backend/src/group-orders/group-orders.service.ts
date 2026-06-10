import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { GroupOrder } from '../entities/group-order.entity';
import { ProcessingRecord } from '../entities/processing-record.entity';
import { Attachment } from '../entities/attachment.entity';
import { AuditNote } from '../entities/audit-note.entity';
import { ExceptionReason, ReasonType } from '../entities/exception-reason.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { ActionType } from '../common/enums/action-type.enum';
import { CreateGroupOrderDto } from './dto/create-group-order.dto';
import { QueryGroupOrderDto } from './dto/query-group-order.dto';
import { UpdateGroupOrderDto } from './dto/update-group-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { BatchProcessDto } from './dto/batch-process.dto';

interface CurrentUser {
  id: string;
  name: string;
  role: UserRole;
}

interface AssignDto {
  assignToRole?: UserRole;
  assignToHandler?: string;
  role?: UserRole;
  handler?: string;
  deadline?: string;
  version: number;
  comment?: string;
}

interface ProcessDto {
  orderEvidence?: string;
  shelfEvidence?: string;
  isMaterialComplete?: boolean;
  version: number;
  comment?: string;
}

interface ReviewDto {
  deliveryEvidence?: string;
  passed?: boolean;
  exceptionReasons?: { reason: string; reasonType: string }[];
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

interface AddAttachmentDto {
  fileName: string;
  fileType: string;
  fileUrl: string;
  evidenceType: 'shelf' | 'order' | 'delivery';
}

type WarningStatus = 'normal' | 'approaching' | 'overdue';

@Injectable()
export class GroupOrdersService {
  constructor(
    @InjectRepository(GroupOrder)
    private readonly groupOrderRepository: Repository<GroupOrder>,
    @InjectRepository(ProcessingRecord)
    private readonly processingRecordRepository: Repository<ProcessingRecord>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(AuditNote)
    private readonly auditNoteRepository: Repository<AuditNote>,
    @InjectRepository(ExceptionReason)
    private readonly exceptionReasonRepository: Repository<ExceptionReason>,
  ) {}

  async create(dto: CreateGroupOrderDto, user: CurrentUser) {
    const orderNo = this.generateOrderNo();
    const totalAmount = dto.grouponPrice * dto.quantity;

    const order = this.groupOrderRepository.create({
      orderNo,
      productName: dto.productName,
      sku: dto.sku,
      shelfDate: new Date(dto.shelfDate),
      grouponPrice: dto.grouponPrice,
      quantity: dto.quantity,
      totalAmount,
      orderStatus: OrderStatus.PENDING_ASSIGN,
      createdBy: user.name || dto.createdBy,
      shelfEvidence: dto.shelfEvidence,
      orderEvidence: dto.orderEvidence,
      version: 1,
    });

    const savedOrder = await this.groupOrderRepository.save(order);

    await this.createProcessingRecord(
      savedOrder.id,
      ActionType.CREATE,
      user.name || dto.createdBy,
      user.role || UserRole.GROUPON_REGISTRAR,
      null,
      OrderStatus.PENDING_ASSIGN,
      null,
      null,
      '创建团购订单',
      savedOrder.version,
    );

    return savedOrder;
  }

  async findAll(query: QueryGroupOrderDto, user: CurrentUser) {
    const { page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'DESC', ...filters } = query;

    const qb = this.groupOrderRepository.createQueryBuilder('order');

    qb.where('1 = 1');

    if (user.role !== UserRole.CITY_MANAGER && user.role !== UserRole.AUDIT_SUPERVISOR) {
      qb.andWhere(
        new Brackets((qb) => {
          qb.where('order.currentRole = :role', { role: user.role }).orWhere('order.orderStatus = :status', {
            status: OrderStatus.PENDING_ASSIGN,
          });
        }),
      );
    }

    if (filters.orderStatus) {
      qb.andWhere('order.orderStatus = :orderStatus', { orderStatus: filters.orderStatus });
    }

    if (filters.currentRole) {
      qb.andWhere('order.currentRole = :currentRole', { currentRole: filters.currentRole });
    }

    if (filters.isOverdue !== undefined) {
      qb.andWhere('order.isOverdue = :isOverdue', { isOverdue: filters.isOverdue });
    }

    if (filters.keyword) {
      qb.andWhere(
        new Brackets((qb) => {
          qb.where('order.orderNo LIKE :keyword', { keyword: `%${filters.keyword}%` })
            .orWhere('order.productName LIKE :keyword', { keyword: `%${filters.keyword}%` })
            .orWhere('order.sku LIKE :keyword', { keyword: `%${filters.keyword}%` });
        }),
      );
    }

    qb.orderBy(`order.${sortBy}`, sortOrder as 'ASC' | 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [orders, total] = await qb.getManyAndCount();

    const ordersWithWarning = orders.map((order) => {
      const warningStatus = this.calculateWarningStatus(order);
      return { ...order, warningStatus };
    });

    return {
      list: ordersWithWarning,
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: number, user: CurrentUser) {
    const order = await this.groupOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    await this.checkOverdue(order);

    const attachments = await this.attachmentRepository.find({ where: { orderId: id } });
    const processingRecords = await this.processingRecordRepository.find({
      where: { orderId: id },
      order: { createdAt: 'DESC' },
    });
    const auditNotes = await this.auditNoteRepository.find({
      where: { orderId: id },
      order: { createdAt: 'DESC' },
    });
    const exceptionReasons = await this.exceptionReasonRepository.find({
      where: { orderId: id },
      order: { createdAt: 'DESC' },
    });

    const warningStatus = this.calculateWarningStatus(order);

    return {
      ...order,
      warningStatus,
      attachments,
      processingRecords,
      auditNotes,
      exceptionReasons,
    };
  }

  async assign(id: number, dto: AssignDto, user: CurrentUser) {
    this.validateRolePermission(user.role, [UserRole.AUDIT_SUPERVISOR, UserRole.CITY_MANAGER], '派发订单');

    const order = await this.groupOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    this.validateVersion(order.version, dto.version);

    if (order.orderStatus !== OrderStatus.PENDING_ASSIGN) {
      throw new ConflictException(`订单状态不是「待派发」，无法派发，当前状态：${this.getStatusLabel(order.orderStatus)}`);
    }

    const previousStatus = order.orderStatus;
    const previousHandler = order.currentHandler;

    const targetRole = dto.assignToRole || dto.role;
    const targetHandler = dto.assignToHandler || dto.handler;

    if (!targetRole || !targetHandler) {
      throw new BadRequestException('派发角色和处理人不能为空');
    }

    order.orderStatus = OrderStatus.PROCESSING;
    order.currentRole = targetRole;
    order.currentHandler = targetHandler;
    order.assignedAt = new Date();
    if (dto.deadline) {
      order.deadline = new Date(dto.deadline);
    }
    order.version = order.version + 1;

    const savedOrder = await this.groupOrderRepository.save(order);

    await this.createProcessingRecord(
      savedOrder.id,
      ActionType.ASSIGN,
      user.name,
      user.role,
      previousStatus,
      OrderStatus.PROCESSING,
      previousHandler,
      targetHandler,
      dto.comment || `派发给${targetHandler}`,
      savedOrder.version,
    );

    return savedOrder;
  }

  async process(id: number, dto: ProcessDto, user: CurrentUser) {
    this.validateRolePermission(user.role, [UserRole.FULFILLMENT_SPECIALIST]);

    const order = await this.groupOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    this.validateVersion(order.version, dto.version, '订单已被他人修改，请刷新后重试');

    if (order.orderStatus !== OrderStatus.PROCESSING) {
      throw new ConflictException(`订单状态不是「处理中」，无法进行履约处理，当前状态：${this.getStatusLabel(order.orderStatus)}`);
    }

    if (order.currentHandler && order.currentHandler !== user.name) {
      throw new ForbiddenException(`当前处理人是「${order.currentHandler}」，您无权操作此订单`);
    }

    if (order.currentRole && order.currentRole !== user.role) {
      throw new ForbiddenException(`当前订单归属「${this.getRoleLabel(order.currentRole)}」角色处理，您的角色无权处理权限不匹配`);
    }

    const finalOrderEvidence = dto.orderEvidence || order.orderEvidence;
    if (!finalOrderEvidence) {
      throw new BadRequestException('缺少「团购下单过程核对凭证(orderEvidence)」必填，请上传团购订单凭证后再提交');
    }

    if (dto.isMaterialComplete !== undefined) {
      order.isMaterialComplete = dto.isMaterialComplete;
    }
    order.orderEvidence = finalOrderEvidence;
    if (dto.shelfEvidence) {
      order.shelfEvidence = dto.shelfEvidence;
    }

    const previousStatus = order.orderStatus;
    const previousHandler = order.currentHandler;

    order.version = order.version + 1;

    const savedOrder = await this.groupOrderRepository.save(order);

    await this.createProcessingRecord(
      savedOrder.id,
      ActionType.SUBMIT,
      user.name,
      user.role,
      previousStatus,
      previousStatus,
      previousHandler,
      user.name,
      dto.comment || '履约处理完成，提交审核',
      savedOrder.version,
    );

    return savedOrder;
  }

  async review(id: number, dto: ReviewDto, user: CurrentUser) {
    this.validateRolePermission(user.role, [UserRole.CITY_MANAGER, UserRole.REVIEW_LEADER], '复核归档');

    const order = await this.groupOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    this.validateVersion(order.version, dto.version, '订单已被他人处理，版本不匹配，请刷新后重试');

    if (order.orderStatus !== OrderStatus.PROCESSING) {
      throw new ConflictException(`订单状态不是「处理中」，无法复核归档，当前状态：${this.getStatusLabel(order.orderStatus)}`);
    }

    const previousStatus = order.orderStatus;
    const previousHandler = order.currentHandler;

    if (dto.passed === false && dto.exceptionReasons && dto.exceptionReasons.length > 0) {
      for (const er of dto.exceptionReasons) {
        await this.createExceptionReason(order.id, er.reason, er.reasonType as any, user.name);
      }
      order.version = order.version + 1;
      const savedOrder = await this.groupOrderRepository.save(order);

      await this.createProcessingRecord(
        savedOrder.id,
        ActionType.REVIEW,
        user.name,
        user.role,
        previousStatus,
        previousStatus,
        previousHandler,
        previousHandler,
        dto.comment || '复核驳回，记录异常原因',
        savedOrder.version,
      );

      return savedOrder;
    }

    const finalDeliveryEvidence = dto.deliveryEvidence || order.deliveryEvidence;
    if (!finalDeliveryEvidence) {
      throw new BadRequestException('缺少「到货签收最终证据(deliveryEvidence)」必填，请上传履约签收凭证后再复核归档');
    }

    const finalOrderEvidence = order.orderEvidence;
    if (!finalOrderEvidence) {
      throw new BadRequestException('缺少「团购下单过程核对凭证(orderEvidence)」，请先由履约专员录入订单凭证后再归档');
    }

    order.deliveryEvidence = finalDeliveryEvidence;
    order.orderStatus = OrderStatus.CLOSED;
    order.closedAt = new Date();
    order.version = order.version + 1;

    const savedOrder = await this.groupOrderRepository.save(order);

    await this.createProcessingRecord(
      savedOrder.id,
      ActionType.CLOSE,
      user.name,
      user.role,
      previousStatus,
      OrderStatus.CLOSED,
      previousHandler,
      user.name,
      dto.comment || '复核通过，订单归档',
      savedOrder.version,
    );

    return savedOrder;
  }

  async returnOrder(id: number, dto: ReturnOrderDto, user: CurrentUser) {
    const allowedRoles = [
      UserRole.AUDIT_SUPERVISOR,
      UserRole.REVIEW_LEADER,
      UserRole.CITY_MANAGER,
      UserRole.FULFILLMENT_SPECIALIST,
    ];
    this.validateRolePermission(user.role, allowedRoles, '退回补正');

    const order = await this.groupOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    this.validateVersion(order.version, dto.version);

    if (order.orderStatus === OrderStatus.CLOSED) {
      throw new ConflictException('订单已归档为「已关闭」状态，无法退回补正');
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('退回原因必填，请说明需要谁补正的具体问题');
    }

    if (!dto.returnToRole) {
      throw new BadRequestException('请指定退回给哪个角色补正（团长运营/履约专员）');
    }

    const previousStatus = order.orderStatus;
    const previousHandler = order.currentHandler;

    let statusChanged = true;
    let newStatus: OrderStatus;
    let newHandler: string | null;

    const returnToRole = dto.returnToRole as UserRole;

    if (returnToRole === UserRole.LEADER_OPERATOR) {
      newStatus = OrderStatus.PROCESSING;
      newHandler = null;
    } else if (returnToRole === UserRole.FULFILLMENT_SPECIALIST) {
      if (order.orderStatus !== OrderStatus.PROCESSING) {
        statusChanged = false;
        newStatus = order.orderStatus;
        newHandler = order.currentHandler;
      } else {
        newStatus = OrderStatus.PROCESSING;
        newHandler = null;
      }
    } else {
      newStatus = order.orderStatus;
      newHandler = order.currentHandler;
      statusChanged = false;
    }

    if (statusChanged) {
      order.orderStatus = newStatus;
      order.currentRole = returnToRole;
      order.currentHandler = newHandler;
    }
    order.version = order.version + 1;

    const savedOrder = await this.groupOrderRepository.save(order);

    await this.createExceptionReason(savedOrder.id, dto.reason, 'material_missing', user.name);

    await this.createProcessingRecord(
      savedOrder.id,
      ActionType.RETURN,
      user.name,
      user.role,
      previousStatus,
      newStatus,
      previousHandler,
      newHandler,
      `${dto.comment || '退回补正'}${!statusChanged ? '（状态未变更，已记录退回原因）' : ''}`,
      savedOrder.version,
    );

    return {
      ...savedOrder,
      statusChanged,
      message: !statusChanged ? '状态冲突，已记录退回原因但未变更状态' : '退回成功',
    };
  }

  async correctMaterials(id: number, dto: CorrectMaterialsDto, user: CurrentUser) {
    this.validateRolePermission(user.role, [UserRole.LEADER_OPERATOR, UserRole.GROUPON_REGISTRAR], '补正材料');

    const order = await this.groupOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    this.validateVersion(order.version, dto.version);

    if (order.orderStatus === OrderStatus.CLOSED) {
      throw new ConflictException('订单已归档为「已关闭」状态，无法补正材料');
    }

    const hasUpdate = dto.isMaterialComplete !== undefined || dto.shelfEvidence || dto.orderEvidence || dto.deliveryEvidence;
    if (!hasUpdate) {
      throw new BadRequestException('请至少提交一项补正内容（材料状态/上架凭证/订单凭证/履约凭证）');
    }

    const previousStatus = order.orderStatus;
    const previousHandler = order.currentHandler;

    if (dto.isMaterialComplete !== undefined) {
      order.isMaterialComplete = dto.isMaterialComplete;
    }
    if (dto.shelfEvidence) {
      order.shelfEvidence = dto.shelfEvidence;
    }
    if (dto.orderEvidence) {
      order.orderEvidence = dto.orderEvidence;
    }
    order.version = order.version + 1;

    const savedOrder = await this.groupOrderRepository.save(order);

    await this.createProcessingRecord(
      savedOrder.id,
      ActionType.CORRECT_MATERIALS,
      user.name,
      user.role,
      previousStatus,
      previousStatus,
      previousHandler,
      user.name,
      dto.comment || '补正材料',
      savedOrder.version,
    );

    return savedOrder;
  }

  async batchProcess(dto: BatchProcessDto, user: CurrentUser) {
    const results = {
      success: [] as number[],
      failed: [] as { id: number; reason: string; needRole?: string }[],
    };

    const action = dto.action as 'assign' | 'process' | 'close' | 'return';

    for (const id of dto.ids) {
      try {
        const order = await this.groupOrderRepository.findOne({ where: { id } });
        if (!order) {
          results.failed.push({ id, reason: '订单不存在，已跳过' });
          continue;
        }

        if (order.isOverdue) {
          results.failed.push({
            id,
            reason: `订单已逾期，责任人：${order.currentHandler || '未指派'}，需单独处理后再批量推进`,
            needRole: order.currentRole ? this.getRoleLabel(order.currentRole) : undefined,
          });
          await this.createExceptionReason(order.id, `批量${this.getActionLabel(action)}拦截：订单已逾期`, 'overdue', user.name);
          continue;
        }

        let handled = false;

        switch (action) {
          case 'assign':
            handled = await this.batchAssign(order, dto, user, results);
            break;
          case 'process':
            handled = await this.batchProcessOne(order, dto, user, results);
            break;
          case 'close':
            handled = await this.batchClose(order, dto, user, results);
            break;
          case 'return':
            handled = await this.batchReturn(order, dto, user, results);
            break;
          default:
            results.failed.push({ id, reason: `不支持的批量操作类型：${action}` });
        }

        if (handled) {
          results.success.push(id);
        }
      } catch (error: any) {
        results.failed.push({ id, reason: error.message || '处理失败' });
      }
    }

    return results;
  }

  private getActionLabel(action: string): string {
    const map: Record<string, string> = {
      assign: '派发',
      process: '处理',
      close: '关闭',
      return: '退回',
    };
    return map[action] || action;
  }

  private async batchAssign(
    order: GroupOrder,
    dto: BatchProcessDto,
    user: CurrentUser,
    results: { success: number[]; failed: { id: number; reason: string; needRole?: string }[] },
  ): Promise<boolean> {
    if (![UserRole.AUDIT_SUPERVISOR, UserRole.CITY_MANAGER].includes(user.role)) {
      results.failed.push({ id: order.id, reason: '批量派发仅允许「团购审核主管/城市经理」执行', needRole: '团购审核主管/城市经理' });
      return false;
    }
    if (order.orderStatus !== OrderStatus.PENDING_ASSIGN) {
      results.failed.push({ id: order.id, reason: `当前状态「${this.getStatusLabel(order.orderStatus)}」不是「待派发」，无法批量派发` });
      return false;
    }
    const targetRole = dto.targetRole || UserRole.FULFILLMENT_SPECIALIST;
    const targetHandler = dto.targetHandler || '待领取';
    const previousStatus = order.orderStatus;
    order.orderStatus = OrderStatus.PROCESSING;
    order.currentRole = targetRole;
    order.currentHandler = targetHandler;
    order.assignedAt = new Date();
    order.version = order.version + 1;
    await this.groupOrderRepository.save(order);
    await this.createProcessingRecord(
      order.id,
      ActionType.ASSIGN,
      user.name,
      user.role,
      previousStatus,
      OrderStatus.PROCESSING,
      null,
      targetHandler,
      dto.comment || `批量派发至${this.getRoleLabel(targetRole)}`,
      order.version,
    );
    return true;
  }

  private async batchProcessOne(
    order: GroupOrder,
    dto: BatchProcessDto,
    user: CurrentUser,
    results: { success: number[]; failed: { id: number; reason: string; needRole?: string }[] },
  ): Promise<boolean> {
    if (user.role !== UserRole.FULFILLMENT_SPECIALIST) {
      results.failed.push({ id: order.id, reason: '批量处理仅允许「履约专员」执行', needRole: '履约专员' });
      return false;
    }
    if (order.orderStatus !== OrderStatus.PROCESSING) {
      results.failed.push({ id: order.id, reason: `当前状态「${this.getStatusLabel(order.orderStatus)}」不是「处理中」，无法批量处理` });
      return false;
    }
    if (order.currentHandler && order.currentHandler !== user.name) {
      results.failed.push({ id: order.id, reason: `当前处理人是「${order.currentHandler}」，您无权批量处理该订单` });
      return false;
    }
    if (!order.orderEvidence && !dto.orderEvidence) {
      results.failed.push({ id: order.id, reason: '缺少「团购下单过程核对凭证(orderEvidence)」，请先补录订单凭证再批量处理', needRole: '履约专员' });
      return false;
    }
    if (dto.orderEvidence) {
      order.orderEvidence = dto.orderEvidence;
    }
    const previousStatus = order.orderStatus;
    order.version = order.version + 1;
    await this.groupOrderRepository.save(order);
    await this.createProcessingRecord(
      order.id,
      ActionType.SUBMIT,
      user.name,
      user.role,
      previousStatus,
      previousStatus,
      order.currentHandler,
      user.name,
      dto.comment || '批量履约处理',
      order.version,
    );
    return true;
  }

  private async batchClose(
    order: GroupOrder,
    dto: BatchProcessDto,
    user: CurrentUser,
    results: { success: number[]; failed: { id: number; reason: string; needRole?: string }[] },
  ): Promise<boolean> {
    if (![UserRole.CITY_MANAGER, UserRole.REVIEW_LEADER].includes(user.role)) {
      results.failed.push({ id: order.id, reason: '批量关闭仅允许「城市经理/复核负责人」执行', needRole: '城市经理/复核负责人' });
      return false;
    }
    if (order.orderStatus !== OrderStatus.PROCESSING) {
      results.failed.push({ id: order.id, reason: `当前状态「${this.getStatusLabel(order.orderStatus)}」不是「处理中」，无法批量关闭` });
      return false;
    }
    if (!order.orderEvidence) {
      results.failed.push({ id: order.id, reason: '缺少「团购下单过程核对凭证(orderEvidence)」，请先由履约专员补录', needRole: '履约专员' });
      return false;
    }
    if (!order.deliveryEvidence && !dto.deliveryEvidence) {
      results.failed.push({ id: order.id, reason: '缺少「到货签收最终证据(deliveryEvidence)」，请先补录履约签收凭证再批量关闭', needRole: '城市经理' });
      return false;
    }
    if (dto.deliveryEvidence) {
      order.deliveryEvidence = dto.deliveryEvidence;
    }
    const previousStatus = order.orderStatus;
    const previousHandler = order.currentHandler;
    order.orderStatus = OrderStatus.CLOSED;
    order.closedAt = new Date();
    order.version = order.version + 1;
    await this.groupOrderRepository.save(order);
    await this.createProcessingRecord(
      order.id,
      ActionType.CLOSE,
      user.name,
      user.role,
      previousStatus,
      OrderStatus.CLOSED,
      previousHandler,
      user.name,
      dto.comment || '批量复核归档',
      order.version,
    );
    return true;
  }

  private async batchReturn(
    order: GroupOrder,
    dto: BatchProcessDto,
    user: CurrentUser,
    results: { success: number[]; failed: { id: number; reason: string; needRole?: string }[] },
  ): Promise<boolean> {
    const allowedRoles = [
      UserRole.AUDIT_SUPERVISOR,
      UserRole.REVIEW_LEADER,
      UserRole.CITY_MANAGER,
      UserRole.FULFILLMENT_SPECIALIST,
    ];
    if (!allowedRoles.includes(user.role)) {
      results.failed.push({ id: order.id, reason: '批量退回仅允许「审核主管/复核负责人/城市经理/履约专员」执行', needRole: '审核主管/复核负责人' });
      return false;
    }
    if (order.orderStatus === OrderStatus.CLOSED) {
      results.failed.push({ id: order.id, reason: '订单已归档，无法批量退回' });
      return false;
    }
    if (!dto.reason) {
      results.failed.push({ id: order.id, reason: '批量退回需填写退回原因，请说明需要谁补正' });
      return false;
    }
    const returnToRole = (dto.returnToRole as UserRole) || UserRole.LEADER_OPERATOR;
    const previousStatus = order.orderStatus;
    const previousHandler = order.currentHandler;
    let newStatus = order.orderStatus;
    let newHandler = order.currentHandler;
    let statusChanged = true;
    if (returnToRole === UserRole.LEADER_OPERATOR) {
      newStatus = OrderStatus.PROCESSING;
      newHandler = null;
    } else if (returnToRole === UserRole.FULFILLMENT_SPECIALIST) {
      if (order.orderStatus !== OrderStatus.PROCESSING) {
        statusChanged = false;
      } else {
        newStatus = OrderStatus.PROCESSING;
        newHandler = null;
      }
    } else {
      statusChanged = false;
    }
    if (statusChanged) {
      order.orderStatus = newStatus;
      order.currentRole = returnToRole;
      order.currentHandler = newHandler;
    }
    order.version = order.version + 1;
    await this.groupOrderRepository.save(order);
    await this.createExceptionReason(order.id, dto.reason, 'material_missing', user.name);
    await this.createProcessingRecord(
      order.id,
      ActionType.RETURN,
      user.name,
      user.role,
      previousStatus,
      newStatus,
      previousHandler,
      newHandler,
      `${dto.comment || '批量退回补正'}：${dto.reason}${!statusChanged ? '（状态冲突未变更）' : ''}`,
      order.version,
    );
    return true;
  }

  async addAuditNote(id: number, content: string, user: CurrentUser) {
    const order = await this.groupOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    const auditNote = this.auditNoteRepository.create({
      orderId: id,
      content,
      author: user.name,
      authorRole: user.role,
    });

    const savedNote = await this.auditNoteRepository.save(auditNote);

    await this.createProcessingRecord(
      id,
      ActionType.ADD_AUDIT_NOTE,
      user.name,
      user.role,
      order.orderStatus,
      order.orderStatus,
      order.currentHandler,
      order.currentHandler,
      `添加审计备注: ${content.substring(0, 50)}`,
      order.version,
    );

    return savedNote;
  }

  async addAttachment(id: number, dto: AddAttachmentDto, user: CurrentUser) {
    const order = await this.groupOrderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    const attachment = this.attachmentRepository.create({
      orderId: id,
      fileName: dto.fileName,
      fileType: dto.fileType,
      fileUrl: dto.fileUrl,
      uploadedBy: user.name,
      evidenceType: dto.evidenceType,
    });

    const savedAttachment = await this.attachmentRepository.save(attachment);

    await this.createProcessingRecord(
      id,
      ActionType.ADD_ATTACHMENT,
      user.name,
      user.role,
      order.orderStatus,
      order.orderStatus,
      order.currentHandler,
      order.currentHandler,
      `添加附件: ${dto.fileName}`,
      order.version,
    );

    return savedAttachment;
  }

  private generateOrderNo(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(100000 + Math.random() * 900000);
    return `TG${year}${month}${day}${random}`;
  }

  private async checkOverdue(order: GroupOrder): Promise<void> {
    if (order.deadline && !order.isOverdue && order.orderStatus !== OrderStatus.CLOSED) {
      const now = new Date();
      if (now > new Date(order.deadline)) {
        order.isOverdue = true;
        order.overdueReason = '超过处理截止日期';
        await this.groupOrderRepository.save(order);
        await this.createExceptionReason(order.id, '超过处理截止日期', 'overdue', 'system');
      }
    }
  }

  private calculateWarningStatus(order: GroupOrder): WarningStatus {
    if (order.isOverdue || (order.deadline && new Date() > new Date(order.deadline))) {
      return 'overdue';
    }
    if (order.deadline) {
      const now = new Date();
      const deadline = new Date(order.deadline);
      const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (diffHours <= 24) {
        return 'approaching';
      }
    }
    return 'normal';
  }

  private getStatusLabel(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      [OrderStatus.PENDING_ASSIGN]: '待派发',
      [OrderStatus.PROCESSING]: '处理中',
      [OrderStatus.CLOSED]: '已关闭',
    };
    return map[status] || status;
  }

  private getRoleLabel(role: UserRole): string {
    const map: Record<UserRole, string> = {
      [UserRole.GROUPON_REGISTRAR]: '团购登记员',
      [UserRole.AUDIT_SUPERVISOR]: '团购审核主管',
      [UserRole.REVIEW_LEADER]: '复核负责人',
      [UserRole.LEADER_OPERATOR]: '团长运营',
      [UserRole.FULFILLMENT_SPECIALIST]: '履约专员',
      [UserRole.CITY_MANAGER]: '城市经理',
    };
    return map[role] || role;
  }

  private validateVersion(currentVersion: number, providedVersion: number, message?: string): void {
    if (currentVersion !== providedVersion) {
      throw new ConflictException(message || `版本冲突：您正在操作的是 v${providedVersion}，但当前已更新为 v${currentVersion}，请刷新后重试`);
    }
  }

  private validateRolePermission(userRole: UserRole, allowedRoles: UserRole[], actionDesc?: string): void {
    if (!allowedRoles.includes(userRole)) {
      const roleLabels = allowedRoles.map(r => this.getRoleLabel(r)).join('、');
      throw new ForbiddenException(`${actionDesc || '此操作'}仅允许「${roleLabels}」执行，当前角色「${this.getRoleLabel(userRole)}」无权限`);
    }
  }

  private validateEvidence(dto: Record<string, any>, requiredFields: string[]): void {
    for (const field of requiredFields) {
      if (!dto[field]) {
        throw new BadRequestException(`缺少必填证据: ${field}`);
      }
    }
  }

  private async createProcessingRecord(
    orderId: number,
    actionType: ActionType,
    operator: string,
    operatorRole: UserRole,
    previousStatus: OrderStatus | null,
    newStatus: OrderStatus | null,
    previousHandler: string | null,
    newHandler: string | null,
    comment: string,
    version: number,
  ): Promise<ProcessingRecord> {
    const record = this.processingRecordRepository.create({
      orderId,
      actionType,
      operator,
      operatorRole,
      previousStatus,
      newStatus,
      previousHandler,
      newHandler,
      comment,
      version,
    });
    return this.processingRecordRepository.save(record);
  }

  private async createExceptionReason(
    orderId: number,
    reason: string,
    reasonType: ReasonType,
    operator: string,
  ): Promise<ExceptionReason> {
    const exception = this.exceptionReasonRepository.create({
      orderId,
      reason,
      reasonType,
      operator,
    });
    return this.exceptionReasonRepository.save(exception);
  }
}
