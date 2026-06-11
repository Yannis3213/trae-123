import { Injectable, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { VenueOrder } from '../entities/venue-order.entity';
import { ProcessingRecord } from '../entities/processing-record.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(VenueOrder)
    private orderRepo: Repository<VenueOrder>,
    @InjectRepository(ProcessingRecord)
    private recordRepo: Repository<ProcessingRecord>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
    private authService: AuthService,
  ) {}

  private calcWarningLevel(deadline: string): string {
    const now = new Date();
    const dl = new Date(deadline + 'T23:59:59');
    const diffMs = dl.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'approaching';
    return 'normal';
  }

  private async generateOrderNo(): Promise<string> {
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const prefix = 'VD' + dateStr;
    const existing = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.orderNo LIKE :prefix', { prefix: prefix + '%' })
      .orderBy('o.orderNo', 'DESC')
      .getOne();
    let seq = 1;
    if (existing) {
      const lastSeq = parseInt(existing.orderNo.slice(-3), 10);
      seq = lastSeq + 1;
    }
    return prefix + String(seq).padStart(3, '0');
  }

  private ensureCurrentUser() {
    const user = this.authService.getCurrentRole();
    if (!user) {
      throw new ForbiddenException('请先切换角色');
    }
    return user;
  }

  private async addRecordAndAudit(
    orderId: string,
    action: string,
    operatorId: string,
    operatorRole: string,
    opinion: string | null,
    auditDetail: string,
    evidence: {
      paymentVerification?: string | null;
      admissionConfirmation?: string | null;
      paymentAmount?: number | null;
      paymentMethod?: string | null;
      paymentStatus?: string | null;
      admissionStatus?: string | null;
      correctReason?: string | null;
      returnOpinion?: string | null;
      exceptionReason?: string | null;
      responsibleNode?: string | null;
      auditRemark?: string | null;
    } = {},
  ) {
    await this.recordRepo.save(
      this.recordRepo.create({
        orderId,
        action,
        operator: operatorId,
        operatorRole,
        opinion,
        paymentVerification: evidence.paymentVerification ?? null,
        admissionConfirmation: evidence.admissionConfirmation ?? null,
        paymentAmount: evidence.paymentAmount ?? null,
        paymentMethod: evidence.paymentMethod ?? null,
        paymentStatus: evidence.paymentStatus ?? null,
        admissionStatus: evidence.admissionStatus ?? null,
        correctReason: evidence.correctReason ?? null,
        returnOpinion: evidence.returnOpinion ?? null,
        exceptionReason: evidence.exceptionReason ?? null,
        responsibleNode: evidence.responsibleNode ?? null,
        auditRemark: evidence.auditRemark ?? null,
      }),
    );
    await this.auditRepo.save(
      this.auditRepo.create({ orderId, action, operator: operatorId, operatorRole, detail: auditDetail }),
    );
  }

  async findAll(filters: { status?: string; warningLevel?: string; role?: string }) {
    const qb = this.orderRepo.createQueryBuilder('o')
      .leftJoinAndSelect('o.processingRecords', 'pr')
      .leftJoinAndSelect('o.attachments', 'att')
      .leftJoinAndSelect('o.auditLogs', 'al');

    if (filters.status) {
      qb.andWhere('o.status = :status', { status: filters.status });
    }
    if (filters.warningLevel) {
      qb.andWhere('o.warningLevel = :warningLevel', { warningLevel: filters.warningLevel });
    }
    if (filters.role) {
      qb.andWhere('o.currentHandlerRole = :role', { role: filters.role });
    }

    qb.orderBy('o.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: { processingRecords: true, attachments: true, auditLogs: true },
    });
    if (!order) {
      throw new BadRequestException('订单不存在');
    }
    return order;
  }

  async create(data: Partial<VenueOrder>) {
    const user = this.ensureCurrentUser();
    if (user.role !== 'registrar') {
      throw new ForbiddenException('只有场地登记员可以创建订单');
    }

    const orderNo = await this.generateOrderNo();
    const warningLevel = data.deadline ? this.calcWarningLevel(data.deadline) : 'normal';

    const order = this.orderRepo.create({
      ...data,
      orderNo,
      status: 'pending_review',
      version: 1,
      currentHandler: 'u2',
      currentHandlerRole: 'reviewer',
      warningLevel,
      createdBy: user.id,
      paymentAmount: data.paymentAmount ?? null,
      paymentMethod: data.paymentMethod ?? null,
      paymentStatus: data.paymentStatus ?? null,
      paymentVerification: data.paymentVerification ?? null,
      admissionStatus: data.admissionStatus ?? null,
      admissionConfirmation: data.admissionConfirmation ?? null,
      exceptionReason: data.exceptionReason ?? null,
      responsibleNode: data.responsibleNode ?? null,
      auditRemark: data.auditRemark ?? null,
    });

    const saved = await this.orderRepo.save(order);

    await this.addRecordAndAudit(
      saved.id,
      'create',
      user.id,
      user.role,
      '提交场地预约申请',
      `创建订单 ${orderNo}`,
      {
        paymentAmount: saved.paymentAmount,
        paymentMethod: saved.paymentMethod,
        paymentStatus: saved.paymentStatus,
        paymentVerification: saved.paymentVerification,
        admissionStatus: saved.admissionStatus,
        admissionConfirmation: saved.admissionConfirmation,
        exceptionReason: saved.exceptionReason,
        responsibleNode: saved.responsibleNode,
        auditRemark: saved.auditRemark,
      },
    );

    return saved;
  }

  async correct(id: string, body: { version: number; correctReason: string; [key: string]: any }) {
    const user = this.ensureCurrentUser();
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new BadRequestException('订单不存在');

    if (user.role !== 'registrar') {
      throw new ForbiddenException('只有场地登记员可以修正订单');
    }
    if (order.currentHandler !== user.id) {
      throw new ForbiddenException('只有当前处理人可以操作此订单');
    }
    if (order.status !== 'pending_correction') {
      throw new ConflictException('订单状态不允许修正，当前状态：' + order.status);
    }
    if (order.version !== body.version) {
      throw new ConflictException('版本冲突，订单已被其他人修改');
    }
    if (order.warningLevel === 'overdue') {
      throw new ConflictException('订单已逾期，不能直接补正，请先处理逾期问题');
    }
    if (!body.correctReason || body.correctReason.trim() === '') {
      throw new BadRequestException('补正原因不能为空');
    }

    const updateFields: Partial<VenueOrder> = {};
    const allowedFields = [
      'venueName', 'courtName', 'reservationDate', 'timeSlot',
      'applicantName', 'applicantPhone', 'deadline',
      'paymentAmount', 'paymentMethod', 'paymentStatus', 'paymentVerification',
      'admissionStatus', 'admissionConfirmation',
      'exceptionReason', 'responsibleNode', 'auditRemark',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updateFields as any)[field] = body[field];
      }
    }

    const newVersion = order.version + 1;
    const warningLevel = updateFields.deadline
      ? this.calcWarningLevel(updateFields.deadline)
      : this.calcWarningLevel(order.deadline);

    const paymentStatus = updateFields.paymentStatus ?? order.paymentStatus;
    if (order.returnOpinion?.includes('支付') && paymentStatus !== '已核销') {
      if (!body.paymentVerification || !body.paymentAmount || !body.paymentMethod) {
        throw new BadRequestException('退回原因为支付相关，必须补充支付核销信息（金额、支付方式、核销凭证）');
      }
      if (!body.paymentVerification.includes('已支付') && !body.paymentVerification.includes('核销')) {
        throw new BadRequestException('支付核销未完成，请确认支付状态后再提交');
      }
    }

    const admissionStatus = updateFields.admissionStatus ?? order.admissionStatus;
    if (order.returnOpinion?.includes('入场') && admissionStatus !== '已确认') {
      if (!body.admissionConfirmation) {
        throw new BadRequestException('退回原因为入场相关，必须补充入场确认信息');
      }
    }

    await this.orderRepo.update(id, {
      ...updateFields,
      status: 'pending_review',
      version: newVersion,
      correctReason: body.correctReason || order.correctReason,
      currentHandler: 'u2',
      currentHandlerRole: 'reviewer',
      returnOpinion: null as unknown as string,
      warningLevel,
      responsibleNode: updateFields.responsibleNode ?? null,
    });

    await this.addRecordAndAudit(
      id,
      'correct',
      user.id,
      user.role,
      body.correctReason || '修正后重新提交',
      `修正订单 ${order.orderNo}，重新提交审核`,
      {
        paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
        paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
        paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
        paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
        admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
        admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
        correctReason: body.correctReason,
        exceptionReason: updateFields.exceptionReason ?? order.exceptionReason,
        responsibleNode: updateFields.responsibleNode ?? order.responsibleNode,
        auditRemark: updateFields.auditRemark ?? order.auditRemark,
      },
    );

    return this.orderRepo.findOne({ where: { id }, relations: { processingRecords: true, attachments: true, auditLogs: true } });
  }

  async review(id: string, body: { version: number; action: string; opinion: string; [key: string]: any }) {
    const user = this.ensureCurrentUser();
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new BadRequestException('订单不存在');

    if (user.role !== 'reviewer') {
      throw new ForbiddenException('只有场地审核主管可以审核订单');
    }
    if (order.currentHandler !== user.id) {
      throw new ForbiddenException('只有当前处理人可以操作此订单');
    }
    if (order.version !== body.version) {
      throw new ConflictException('版本冲突，订单已被其他人修改');
    }
    if (!body.opinion || body.opinion.trim() === '') {
      throw new BadRequestException('审核意见不能为空');
    }

    const allowedStatuses = ['pending_review', 'under_review', 'overdue'];
    if (!allowedStatuses.includes(order.status)) {
      throw new ConflictException('订单状态不允许审核，当前状态：' + order.status);
    }

    if (order.warningLevel === 'overdue' && body.action !== 'reject') {
      throw new ConflictException('订单已逾期，请退回补正并重新设置截止日期');
    }

    const lastRecord = await this.recordRepo.findOne({
      where: { orderId: id },
      order: { createdAt: 'DESC' },
    });
    if (lastRecord && lastRecord.action === 'review_' + body.action && lastRecord.operator === user.id) {
      throw new ConflictException('不能重复执行相同操作');
    }

    const updateFields: Partial<VenueOrder> = {};
    const evidenceFields = ['paymentAmount', 'paymentMethod', 'paymentStatus', 'paymentVerification', 'admissionStatus', 'admissionConfirmation', 'exceptionReason', 'responsibleNode', 'auditRemark'];
    for (const field of evidenceFields) {
      if (body[field] !== undefined) {
        (updateFields as any)[field] = body[field];
      }
    }

    const newVersion = order.version + 1;

    if (body.action === 'approve') {
      const paymentStatus = updateFields.paymentStatus ?? order.paymentStatus;
      const paymentVerification = updateFields.paymentVerification ?? order.paymentVerification;
      if (paymentStatus !== '已核销' || !paymentVerification) {
        throw new BadRequestException('审核通过前必须确认支付已核销，请核实支付凭证（支付状态、金额、支付方式、核销记录）');
      }
      if (!paymentVerification.includes('已支付') && !paymentVerification.includes('核销')) {
        throw new BadRequestException('支付核销凭证不符合要求，需包含"已支付"或"核销"字样');
      }

      await this.orderRepo.update(id, {
        ...updateFields,
        status: 'under_approval',
        version: newVersion,
        currentHandler: 'u3',
        currentHandlerRole: 'approver',
        warningLevel: this.calcWarningLevel(order.deadline),
        responsibleNode: updateFields.responsibleNode ?? 'reviewer_approved',
      });

      await this.addRecordAndAudit(
        id,
        'review_approve',
        user.id,
        user.role,
        body.opinion,
        `审核通过，提交审批：${body.opinion}`,
        {
          paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
          paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
          paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
          paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
          admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
          admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
          returnOpinion: body.opinion,
          exceptionReason: updateFields.exceptionReason ?? order.exceptionReason,
          responsibleNode: updateFields.responsibleNode ?? 'reviewer_approved',
          auditRemark: updateFields.auditRemark ?? order.auditRemark,
        },
      );
    } else if (body.action === 'reject') {
      await this.orderRepo.update(id, {
        ...updateFields,
        status: 'pending_correction',
        version: newVersion,
        returnOpinion: body.opinion,
        currentHandler: order.createdBy,
        currentHandlerRole: 'registrar',
        warningLevel: this.calcWarningLevel(order.deadline),
        exceptionReason: body.opinion.includes('支付') ? '支付凭证不全' : (body.opinion.includes('入场') ? '入场确认缺失' : (updateFields.exceptionReason ?? '材料不完整')),
        responsibleNode: 'reviewer_rejected',
      });

      await this.addRecordAndAudit(
        id,
        'review_reject',
        user.id,
        user.role,
        body.opinion,
        `审核退回：${body.opinion}`,
        {
          paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
          paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
          paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
          paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
          admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
          admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
          returnOpinion: body.opinion,
          exceptionReason: body.opinion.includes('支付') ? '支付凭证不全' : (body.opinion.includes('入场') ? '入场确认缺失' : (updateFields.exceptionReason ?? '材料不完整')),
          responsibleNode: 'reviewer_rejected',
          auditRemark: updateFields.auditRemark ?? order.auditRemark,
        },
      );
    } else {
      throw new BadRequestException('无效的审核操作，必须是 approve 或 reject');
    }

    return this.orderRepo.findOne({ where: { id }, relations: { processingRecords: true, attachments: true, auditLogs: true } });
  }

  async approve(id: string, body: { version: number; action: string; opinion: string; [key: string]: any }) {
    const user = this.ensureCurrentUser();
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new BadRequestException('订单不存在');

    if (user.role !== 'approver') {
      throw new ForbiddenException('只有体育场馆复核负责人可以审批订单');
    }
    if (order.currentHandler !== user.id) {
      throw new ForbiddenException('只有当前处理人可以操作此订单');
    }
    if (order.version !== body.version) {
      throw new ConflictException('版本冲突，订单已被其他人修改');
    }
    if (!body.opinion || body.opinion.trim() === '') {
      throw new BadRequestException('审批意见不能为空');
    }

    const allowedStatuses = ['under_approval', 'overdue'];
    if (!allowedStatuses.includes(order.status)) {
      throw new ConflictException('订单状态不允许审批，当前状态：' + order.status);
    }

    if (order.warningLevel === 'overdue' && body.action !== 'return') {
      throw new ConflictException('订单已逾期，请退回重新设置截止日期');
    }

    const lastRecord = await this.recordRepo.findOne({
      where: { orderId: id },
      order: { createdAt: 'DESC' },
    });
    if (lastRecord && lastRecord.action === 'approve_' + body.action && lastRecord.operator === user.id) {
      throw new ConflictException('不能重复执行相同操作');
    }

    const updateFields: Partial<VenueOrder> = {};
    const evidenceFields = ['paymentAmount', 'paymentMethod', 'paymentStatus', 'paymentVerification', 'admissionStatus', 'admissionConfirmation', 'exceptionReason', 'responsibleNode', 'auditRemark'];
    for (const field of evidenceFields) {
      if (body[field] !== undefined) {
        (updateFields as any)[field] = body[field];
      }
    }

    const newVersion = order.version + 1;

    if (body.action === 'finalize') {
      const admissionStatus = updateFields.admissionStatus ?? order.admissionStatus;
      const admissionConfirmation = updateFields.admissionConfirmation ?? order.admissionConfirmation;
      if (admissionStatus !== '已确认' || !admissionConfirmation) {
        throw new BadRequestException('办结归档前必须确认入场情况，请核实入场确认凭证（入场时间、确认人）');
      }

      const paymentStatus = updateFields.paymentStatus ?? order.paymentStatus;
      if (paymentStatus !== '已核销') {
        throw new BadRequestException('办结归档前必须确认支付已核销，当前支付状态：' + (paymentStatus || '未填写'));
      }

      await this.orderRepo.update(id, {
        ...updateFields,
        status: 'completed',
        version: newVersion,
        currentHandler: '',
        currentHandlerRole: '',
        warningLevel: 'normal',
        responsibleNode: 'approver_finalized',
      });

      await this.addRecordAndAudit(
        id,
        'approve_finalize',
        user.id,
        user.role,
        body.opinion,
        `审批通过，订单完成：${body.opinion}`,
        {
          paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
          paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
          paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
          paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
          admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
          admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
          returnOpinion: body.opinion,
          exceptionReason: updateFields.exceptionReason ?? order.exceptionReason,
          responsibleNode: 'approver_finalized',
          auditRemark: updateFields.auditRemark ?? order.auditRemark,
        },
      );
    } else if (body.action === 'return') {
      await this.orderRepo.update(id, {
        ...updateFields,
        status: 'pending_review',
        version: newVersion,
        returnOpinion: body.opinion,
        currentHandler: 'u2',
        currentHandlerRole: 'reviewer',
        warningLevel: this.calcWarningLevel(order.deadline),
        exceptionReason: body.opinion.includes('支付') ? '复核时发现支付凭证问题' : (body.opinion.includes('入场') ? '复核时发现入场确认问题' : (updateFields.exceptionReason ?? '复核不通过')),
        responsibleNode: 'approver_returned',
      });

      await this.addRecordAndAudit(
        id,
        'approve_return',
        user.id,
        user.role,
        body.opinion,
        `审批退回审核：${body.opinion}`,
        {
          paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
          paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
          paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
          paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
          admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
          admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
          returnOpinion: body.opinion,
          exceptionReason: body.opinion.includes('支付') ? '复核时发现支付凭证问题' : (body.opinion.includes('入场') ? '复核时发现入场确认问题' : (updateFields.exceptionReason ?? '复核不通过')),
          responsibleNode: 'approver_returned',
          auditRemark: updateFields.auditRemark ?? order.auditRemark,
        },
      );
    } else {
      throw new BadRequestException('无效的审批操作，必须是 finalize 或 return');
    }

    return this.orderRepo.findOne({ where: { id }, relations: { processingRecords: true, attachments: true, auditLogs: true } });
  }

  async returnOrder(id: string, body: { version: number; returnOpinion: string; [key: string]: any }) {
    const user = this.ensureCurrentUser();
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new BadRequestException('订单不存在');

    if (user.role !== 'reviewer' && user.role !== 'approver') {
      throw new ForbiddenException('只有审核主管或复核负责人可以退回订单');
    }
    if (order.currentHandler !== user.id) {
      throw new ForbiddenException('只有当前处理人可以操作此订单');
    }
    if (order.version !== body.version) {
      throw new ConflictException('版本冲突，订单已被其他人修改');
    }
    if (!body.returnOpinion || body.returnOpinion.trim() === '') {
      throw new BadRequestException('退回意见不能为空');
    }

    const updateFields: Partial<VenueOrder> = {};
    const evidenceFields = ['paymentAmount', 'paymentMethod', 'paymentStatus', 'paymentVerification', 'admissionStatus', 'admissionConfirmation', 'exceptionReason', 'responsibleNode', 'auditRemark'];
    for (const field of evidenceFields) {
      if (body[field] !== undefined) {
        (updateFields as any)[field] = body[field];
      }
    }

    const newVersion = order.version + 1;
    let targetStatus: string;
    let targetHandler: string;
    let targetHandlerRole: string;
    let recordAction: string;
    let exceptionReason: string;

    if (user.role === 'reviewer' && (order.status === 'pending_review' || order.status === 'under_review')) {
      targetStatus = 'pending_correction';
      targetHandler = order.createdBy;
      targetHandlerRole = 'registrar';
      recordAction = 'return';
      exceptionReason = body.returnOpinion.includes('支付') ? '支付凭证不全' : (body.returnOpinion.includes('入场') ? '入场确认缺失' : (updateFields.exceptionReason ?? '材料不完整'));
    } else if (user.role === 'approver' && order.status === 'under_approval') {
      targetStatus = 'pending_review';
      targetHandler = 'u2';
      targetHandlerRole = 'reviewer';
      recordAction = 'return';
      exceptionReason = body.returnOpinion.includes('支付') ? '复核时发现支付凭证问题' : (body.returnOpinion.includes('入场') ? '复核时发现入场确认问题' : (updateFields.exceptionReason ?? '复核不通过'));
    } else {
      throw new ConflictException('当前订单状态不允许退回');
    }

    await this.orderRepo.update(id, {
      ...updateFields,
      status: targetStatus,
      version: newVersion,
      returnOpinion: body.returnOpinion,
      currentHandler: targetHandler,
      currentHandlerRole: targetHandlerRole,
      warningLevel: this.calcWarningLevel(order.deadline),
      exceptionReason: updateFields.exceptionReason ?? exceptionReason,
      responsibleNode: user.role === 'reviewer' ? 'reviewer_returned' : 'approver_returned',
    });

    await this.addRecordAndAudit(
      id,
      recordAction,
      user.id,
      user.role,
      body.returnOpinion,
      `退回订单：${body.returnOpinion}`,
      {
        paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
        paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
        paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
        paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
        admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
        admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
        returnOpinion: body.returnOpinion,
        exceptionReason: updateFields.exceptionReason ?? exceptionReason,
        responsibleNode: user.role === 'reviewer' ? 'reviewer_returned' : 'approver_returned',
        auditRemark: updateFields.auditRemark ?? order.auditRemark,
      },
    );

    return this.orderRepo.findOne({ where: { id }, relations: { processingRecords: true, attachments: true, auditLogs: true } });
  }

  async batchReview(body: { orderIds: string[]; action: string; opinion: string; [key: string]: any }) {
    const user = this.ensureCurrentUser();
    const results: { orderId: string; orderNo: string; success: boolean; reason?: string }[] = [];

    const orders = await this.orderRepo.find({
      where: { id: In(body.orderIds) },
    });

    for (const order of orders) {
      try {
        if (user.role !== 'reviewer') {
          throw new ForbiddenException('只有场地审核主管可以批量审核');
        }
        if (order.currentHandler !== user.id) {
          throw new ForbiddenException('不是当前处理人');
        }
        if (order.status !== 'pending_review' && order.status !== 'under_review') {
          throw new ConflictException('订单状态不允许审核');
        }
        if (order.warningLevel === 'overdue' && body.action !== 'reject') {
          throw new ConflictException('订单已逾期，请退回补正');
        }
        if (!body.opinion || body.opinion.trim() === '') {
          throw new BadRequestException('审核意见不能为空');
        }

        const updateFields: Partial<VenueOrder> = {};
        const evidenceFields = ['paymentAmount', 'paymentMethod', 'paymentStatus', 'paymentVerification', 'admissionStatus', 'admissionConfirmation', 'exceptionReason', 'responsibleNode', 'auditRemark'];
        for (const field of evidenceFields) {
          if (body[field] !== undefined) {
            (updateFields as any)[field] = body[field];
          }
        }

        const newVersion = order.version + 1;

        if (body.action === 'approve') {
          const paymentStatus = updateFields.paymentStatus ?? order.paymentStatus;
          const paymentVerification = updateFields.paymentVerification ?? order.paymentVerification;
          if (paymentStatus !== '已核销' || !paymentVerification) {
            throw new BadRequestException('缺少支付核销凭证，批量审核不通过');
          }

          await this.orderRepo.update(order.id, {
            ...updateFields,
            status: 'under_approval',
            version: newVersion,
            currentHandler: 'u3',
            currentHandlerRole: 'approver',
            warningLevel: this.calcWarningLevel(order.deadline),
            responsibleNode: updateFields.responsibleNode ?? 'reviewer_approved',
          });

          await this.addRecordAndAudit(
            order.id,
            'review_approve',
            user.id,
            user.role,
            body.opinion,
            `批量审核通过：${body.opinion}`,
            {
              paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
              paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
              paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
              paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
              admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
              admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
              returnOpinion: body.opinion,
              exceptionReason: updateFields.exceptionReason ?? order.exceptionReason,
              responsibleNode: updateFields.responsibleNode ?? 'reviewer_approved',
              auditRemark: updateFields.auditRemark ?? order.auditRemark,
            },
          );
        } else if (body.action === 'reject') {
          await this.orderRepo.update(order.id, {
            ...updateFields,
            status: 'pending_correction',
            version: newVersion,
            returnOpinion: body.opinion,
            currentHandler: order.createdBy,
            currentHandlerRole: 'registrar',
            warningLevel: this.calcWarningLevel(order.deadline),
            exceptionReason: body.opinion.includes('支付') ? '支付凭证不全' : (body.opinion.includes('入场') ? '入场确认缺失' : (updateFields.exceptionReason ?? '材料不完整')),
            responsibleNode: 'reviewer_rejected',
          });

          await this.addRecordAndAudit(
            order.id,
            'review_reject',
            user.id,
            user.role,
            body.opinion,
            `批量审核退回：${body.opinion}`,
            {
              paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
              paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
              paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
              paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
              admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
              admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
              returnOpinion: body.opinion,
              exceptionReason: body.opinion.includes('支付') ? '支付凭证不全' : (body.opinion.includes('入场') ? '入场确认缺失' : (updateFields.exceptionReason ?? '材料不完整')),
              responsibleNode: 'reviewer_rejected',
              auditRemark: updateFields.auditRemark ?? order.auditRemark,
            },
          );
        } else {
          throw new BadRequestException('无效的审核操作');
        }

        results.push({ orderId: order.id, orderNo: order.orderNo, success: true });
      } catch (err: any) {
        results.push({ orderId: order.id, orderNo: order.orderNo, success: false, reason: err.message });
      }
    }

    return results;
  }

  async batchApprove(body: { orderIds: string[]; action: string; opinion: string; [key: string]: any }) {
    const user = this.ensureCurrentUser();
    const results: { orderId: string; orderNo: string; success: boolean; reason?: string }[] = [];

    const orders = await this.orderRepo.find({
      where: { id: In(body.orderIds) },
    });

    for (const order of orders) {
      try {
        if (user.role !== 'approver') {
          throw new ForbiddenException('只有复核负责人可以批量审批');
        }
        if (order.currentHandler !== user.id) {
          throw new ForbiddenException('不是当前处理人');
        }
        if (order.status !== 'under_approval') {
          throw new ConflictException('订单状态不允许审批');
        }
        if (order.warningLevel === 'overdue' && body.action !== 'return') {
          throw new ConflictException('订单已逾期，请退回重设');
        }
        if (!body.opinion || body.opinion.trim() === '') {
          throw new BadRequestException('审批意见不能为空');
        }

        const updateFields: Partial<VenueOrder> = {};
        const evidenceFields = ['paymentAmount', 'paymentMethod', 'paymentStatus', 'paymentVerification', 'admissionStatus', 'admissionConfirmation', 'exceptionReason', 'responsibleNode', 'auditRemark'];
        for (const field of evidenceFields) {
          if (body[field] !== undefined) {
            (updateFields as any)[field] = body[field];
          }
        }

        const newVersion = order.version + 1;

        if (body.action === 'finalize') {
          const admissionStatus = updateFields.admissionStatus ?? order.admissionStatus;
          const admissionConfirmation = updateFields.admissionConfirmation ?? order.admissionConfirmation;
          if (admissionStatus !== '已确认' || !admissionConfirmation) {
            throw new BadRequestException('缺少入场确认凭证，批量审批不通过');
          }

          const paymentStatus = updateFields.paymentStatus ?? order.paymentStatus;
          if (paymentStatus !== '已核销') {
            throw new BadRequestException('支付未核销，不能批量办结');
          }

          await this.orderRepo.update(order.id, {
            ...updateFields,
            status: 'completed',
            version: newVersion,
            currentHandler: '',
            currentHandlerRole: '',
            warningLevel: 'normal',
            responsibleNode: 'approver_finalized',
          });

          await this.addRecordAndAudit(
            order.id,
            'approve_finalize',
            user.id,
            user.role,
            body.opinion,
            `批量审批通过：${body.opinion}`,
            {
              paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
              paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
              paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
              paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
              admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
              admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
              returnOpinion: body.opinion,
              exceptionReason: updateFields.exceptionReason ?? order.exceptionReason,
              responsibleNode: 'approver_finalized',
              auditRemark: updateFields.auditRemark ?? order.auditRemark,
            },
          );
        } else if (body.action === 'return') {
          await this.orderRepo.update(order.id, {
            ...updateFields,
            status: 'pending_review',
            version: newVersion,
            returnOpinion: body.opinion,
            currentHandler: 'u2',
            currentHandlerRole: 'reviewer',
            warningLevel: this.calcWarningLevel(order.deadline),
            exceptionReason: body.opinion.includes('支付') ? '复核时发现支付凭证问题' : (body.opinion.includes('入场') ? '复核时发现入场确认问题' : (updateFields.exceptionReason ?? '复核不通过')),
            responsibleNode: 'approver_returned',
          });

          await this.addRecordAndAudit(
            order.id,
            'approve_return',
            user.id,
            user.role,
            body.opinion,
            `批量审批退回：${body.opinion}`,
            {
              paymentAmount: updateFields.paymentAmount ?? order.paymentAmount,
              paymentMethod: updateFields.paymentMethod ?? order.paymentMethod,
              paymentStatus: updateFields.paymentStatus ?? order.paymentStatus,
              paymentVerification: updateFields.paymentVerification ?? order.paymentVerification,
              admissionStatus: updateFields.admissionStatus ?? order.admissionStatus,
              admissionConfirmation: updateFields.admissionConfirmation ?? order.admissionConfirmation,
              returnOpinion: body.opinion,
              exceptionReason: body.opinion.includes('支付') ? '复核时发现支付凭证问题' : (body.opinion.includes('入场') ? '复核时发现入场确认问题' : (updateFields.exceptionReason ?? '复核不通过')),
              responsibleNode: 'approver_returned',
              auditRemark: updateFields.auditRemark ?? order.auditRemark,
            },
          );
        } else {
          throw new BadRequestException('无效的审批操作');
        }

        results.push({ orderId: order.id, orderNo: order.orderNo, success: true });
      } catch (err: any) {
        results.push({ orderId: order.id, orderNo: order.orderNo, success: false, reason: err.message });
      }
    }

    return results;
  }

  async getWarnings() {
    const orders = await this.orderRepo.find();
    for (const order of orders) {
      const newLevel = this.calcWarningLevel(order.deadline);
      if (newLevel !== order.warningLevel) {
        await this.orderRepo.update(order.id, {
          warningLevel: newLevel,
          status: newLevel === 'overdue' && order.status !== 'completed' ? 'overdue' : order.status,
          exceptionReason: newLevel === 'overdue' ? '审核超时未处理' : order.exceptionReason,
        });
      }
    }

    const refreshed = await this.orderRepo.find();

    const grouped: { normal: VenueOrder[]; approaching: VenueOrder[]; overdue: VenueOrder[] } = {
      normal: [],
      approaching: [],
      overdue: [],
    };

    for (const order of refreshed) {
      if (grouped[order.warningLevel as keyof typeof grouped]) {
        grouped[order.warningLevel as keyof typeof grouped].push(order);
      }
    }

    return grouped;
  }
}
