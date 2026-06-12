import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan, Attachment, ProcessRecord, AuditNote } from './entities';
import { AuthService } from '../auth/auth.service';
import {
  CreatePlanDto,
  ReviewPlanDto,
  VerifyPlanDto,
  CorrectPlanDto,
  BatchSignDto,
  BatchVerifyDto,
  QueryPlanDto,
} from './dto';

let planCounter = 1000;

function generatePlanNo() {
  planCounter++;
  return `PR-2026-${String(planCounter).padStart(4, '0')}`;
}

function calcDueWarning(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'approaching';
  return 'normal';
}

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(Plan)
    private planRepo: Repository<Plan>,
    @InjectRepository(Attachment)
    private attachRepo: Repository<Attachment>,
    @InjectRepository(ProcessRecord)
    private recordRepo: Repository<ProcessRecord>,
    @InjectRepository(AuditNote)
    private noteRepo: Repository<AuditNote>,
    private authService: AuthService,
  ) {}

  async findAll(query?: QueryPlanDto) {
    const qb = this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.attachments', 'attachment')
      .leftJoinAndSelect('plan.processRecords', 'record')
      .leftJoinAndSelect('plan.auditNotes', 'note')
      .orderBy('plan.createdAt', 'DESC');

    if (query?.status) qb.andWhere('plan.status = :status', { status: query.status });
    if (query?.type) qb.andWhere('plan.type = :type', { type: query.type });
    if (query?.priority) qb.andWhere('plan.priority = :priority', { priority: query.priority });
    if (query?.dueWarning) qb.andWhere('plan.dueWarning = :dueWarning', { dueWarning: query.dueWarning });
    if (query?.responsiblePerson) qb.andWhere('plan.responsiblePerson = :responsiblePerson', { responsiblePerson: query.responsiblePerson });
    if (query?.exceptionTag) qb.andWhere('plan.exceptionTag = :exceptionTag', { exceptionTag: query.exceptionTag });

    const plans = await qb.getMany();
    for (const p of plans) {
      const warning = calcDueWarning(p.dueDate);
      if (p.dueWarning !== warning) {
        p.dueWarning = warning;
        if (warning === 'overdue' && !p.exceptionTag) {
          p.exceptionTag = '逾期';
        }
        await this.planRepo.save(p);
      }
    }
    return plans;
  }

  async findMyQueue() {
    const user = this.authService.getCurrentUser();
    if (!user) throw new HttpException('未登录', HttpStatus.UNAUTHORIZED);

    const qb = this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.attachments', 'attachment')
      .leftJoinAndSelect('plan.processRecords', 'record')
      .leftJoinAndSelect('plan.auditNotes', 'note')
      .orderBy('plan.createdAt', 'DESC');

    if (user.role === 'registrar') {
      qb.andWhere('plan.status IN (:...statuses)', { statuses: ['returned', 'rejected'] });
      qb.andWhere('plan.currentHandlerRole = :role', { role: 'registrar' });
    } else if (user.role === 'reviewer') {
      qb.andWhere('plan.status IN (:...statuses)', { statuses: ['pending_sign', 'reviewing'] });
      qb.andWhere('plan.currentHandlerRole = :role', { role: 'reviewer' });
    } else if (user.role === 'director') {
      qb.andWhere('plan.status = :status', { status: 'pending_verify' });
      qb.andWhere('plan.currentHandlerRole = :role', { role: 'director' });
    } else {
      throw new HttpException('未知角色', HttpStatus.BAD_REQUEST);
    }

    const plans = await qb.getMany();
    for (const p of plans) {
      const warning = calcDueWarning(p.dueDate);
      if (p.dueWarning !== warning) {
        p.dueWarning = warning;
        if (warning === 'overdue' && !p.exceptionTag) {
          p.exceptionTag = '逾期';
        }
        await this.planRepo.save(p);
      }
    }
    return plans;
  }

  async findOne(id: number) {
    const plan = await this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.attachments', 'attachment')
      .leftJoinAndSelect('plan.processRecords', 'record')
      .leftJoinAndSelect('plan.auditNotes', 'note')
      .where('plan.id = :id', { id })
      .getOne();
    if (!plan) throw new HttpException('计划单不存在', HttpStatus.NOT_FOUND);
    return plan;
  }

  async create(dto: CreatePlanDto) {
    const user = this.authService.getCurrentUser();
    if (!user) throw new HttpException('未登录', HttpStatus.UNAUTHORIZED);
    if (user.role !== 'registrar') {
      throw new HttpException('仅登记员可发起传播计划单', HttpStatus.FORBIDDEN);
    }

    const plan = this.planRepo.create({
      planNo: generatePlanNo(),
      title: dto.title,
      type: dto.type,
      status: 'pending_sign',
      priority: dto.priority,
      dueDate: dto.dueDate,
      responsiblePerson: dto.responsiblePerson,
      currentHandler: '李审核',
      currentHandlerRole: 'reviewer',
      dueWarning: calcDueWarning(dto.dueDate),
      creatorId: user.id,
    });

    const saved = await this.planRepo.save(plan);

    await this.recordRepo.save({
      planId: saved.id,
      action: '发起传播计划单',
      operator: user.name,
      operatorRole: user.role,
      fromStatus: null,
      toStatus: 'pending_sign',
    });

    const requiredAtts = this.getDefaultAttachments(dto.type);
    for (const att of requiredAtts) {
      await this.attachRepo.save({
        planId: saved.id,
        fileName: att.fileName,
        fileType: att.fileType,
        required: true,
        fileSize: 0,
      });
    }

    return this.findOne(saved.id);
  }

  async sign(id: number, version: number) {
    const user = this.authService.getCurrentUser();
    const plan = await this.findOne(id);

    this.validatePlanAction(plan, 'sign', version);

    plan.status = 'reviewing';
    plan.currentHandler = user.name;
    plan.currentHandlerRole = 'reviewer';
    plan.version += 1;
    await this.planRepo.save(plan);

    await this.recordRepo.save({
      planId: plan.id,
      action: '签收',
      operator: user.name,
      operatorRole: user.role,
      fromStatus: 'pending_sign',
      toStatus: 'reviewing',
    });

    return this.findOne(plan.id);
  }

  async review(id: number, dto: ReviewPlanDto) {
    const user = this.authService.getCurrentUser();
    const plan = await this.findOne(id);

    const actionType = dto.result === 'approve' ? 'review_approve' : dto.result === 'return' ? 'review_return' : '';
    if (!actionType) throw new HttpException('无效的审核结果', HttpStatus.BAD_REQUEST);

    this.validatePlanAction(plan, actionType, dto.version);

    if (dto.result === 'approve') {
      plan.status = 'pending_verify';
      plan.currentHandler = '王总监';
      plan.currentHandlerRole = 'director';
      plan.reviewResult = '审核通过';
      plan.returnReason = null;
      plan.exceptionTag = null;
    } else if (dto.result === 'return') {
      plan.status = 'returned';
      plan.currentHandler = '张晓明';
      plan.currentHandlerRole = 'registrar';
      plan.returnReason = dto.returnReason || '退回补正';
      plan.exceptionTag = '退回补正';
      plan.reviewResult = '审核退回';
    }

    plan.version += 1;
    await this.planRepo.save(plan);

    await this.recordRepo.save({
      planId: plan.id,
      action: dto.result === 'approve' ? '审核通过' : '退回补正',
      operator: user.name,
      operatorRole: user.role,
      fromStatus: 'reviewing',
      toStatus: plan.status,
      result: dto.result === 'approve' ? '审核通过' : '退回',
      returnReason: dto.returnReason || '退回补正',
      exceptionReason: dto.result === 'return' ? (dto.returnReason || '退回补正') : null,
      auditNote: dto.auditNote,
    });

    return this.findOne(plan.id);
  }

  async correct(id: number, dto: CorrectPlanDto) {
    const user = this.authService.getCurrentUser();
    const plan = await this.findOne(id);

    this.validatePlanAction(plan, 'correct', dto.version);

    const requiredAtts = plan.attachments?.filter((a) => a.required) || [];
    const uploadedRequired = requiredAtts.filter((a) => a.uploadedAt);
    const hasAuditNote = !!dto.auditNote?.trim();
    const allRequiredUploaded = uploadedRequired.length === requiredAtts.length && requiredAtts.length > 0;

    if (!allRequiredUploaded && !hasAuditNote && requiredAtts.length > 0) {
      throw new HttpException('未检测到补正内容：仍有必填附件未上传，且未填写补正说明', HttpStatus.BAD_REQUEST);
    }
    if (requiredAtts.length === 0 && !hasAuditNote) {
      throw new HttpException('未检测到补正内容：请填写补正说明', HttpStatus.BAD_REQUEST);
    }

    const prevStatus = plan.status;
    const prevReturnReason = plan.returnReason;
    plan.status = 'pending_sign';
    plan.currentHandler = '李审核';
    plan.currentHandlerRole = 'reviewer';
    plan.exceptionTag = null;
    plan.returnReason = null;
    plan.reviewResult = null;
    plan.verifyResult = null;
    plan.version += 1;
    await this.planRepo.save(plan);

    await this.recordRepo.save({
      planId: plan.id,
      action: '补正提交',
      operator: user.name,
      operatorRole: user.role,
      fromStatus: prevStatus,
      toStatus: 'pending_sign',
      result: '补正提交',
      returnReason: prevReturnReason,
      auditNote: dto.auditNote,
    });

    return this.findOne(plan.id);
  }

  async verify(id: number, dto: VerifyPlanDto) {
    const user = this.authService.getCurrentUser();
    const plan = await this.findOne(id);

    const actionType = dto.result === 'approve' ? 'verify_approve' : dto.result === 'reject' ? 'verify_reject' : '';
    if (!actionType) throw new HttpException('无效的复核结果', HttpStatus.BAD_REQUEST);

    this.validatePlanAction(plan, actionType, dto.version);

    if (dto.result === 'approve') {
      plan.status = 'archived';
      plan.currentHandler = '';
      plan.currentHandlerRole = '';
      plan.verifyResult = '复核通过，已归档';
      plan.returnReason = null;
      plan.exceptionTag = null;
      plan.version += 1;
      await this.planRepo.save(plan);

      await this.recordRepo.save({
        planId: plan.id,
        action: '复核归档',
        operator: user.name,
        operatorRole: user.role,
        fromStatus: 'pending_verify',
        toStatus: 'archived',
        result: '复核通过',
        auditNote: dto.auditNote,
      });
    } else if (dto.result === 'reject') {
      plan.status = 'rejected';
      plan.currentHandler = '张晓明';
      plan.currentHandlerRole = 'registrar';
      plan.exceptionTag = '异常回传';
      plan.returnReason = dto.rejectReason || '异常回传';
      plan.verifyResult = '异常回传';
      plan.version += 1;
      await this.planRepo.save(plan);

      await this.recordRepo.save({
        planId: plan.id,
        action: '异常回传',
        operator: user.name,
        operatorRole: user.role,
        fromStatus: 'pending_verify',
        toStatus: 'rejected',
        result: '异常回传',
        returnReason: dto.rejectReason || '异常回传',
        auditNote: dto.auditNote,
        exceptionReason: dto.rejectReason || '异常回传',
      });
    }

    return this.findOne(plan.id);
  }

  async batchSign(dto: BatchSignDto) {
    const user = this.authService.getCurrentUser();
    const results: { planId: number; planNo: string; success: boolean; reason: string | null }[] = [];

    for (const pid of dto.planIds) {
      let plan: Plan | null = null;
      try {
        plan = await this.findOne(pid);
        this.validatePlanAction(plan, 'sign', plan.version);

        plan.status = 'reviewing';
        plan.currentHandler = user.name;
        plan.currentHandlerRole = 'reviewer';
        plan.version += 1;
        await this.planRepo.save(plan);

        await this.recordRepo.save({
          planId: plan.id,
          action: '签收',
          operator: user.name,
          operatorRole: user.role,
          fromStatus: 'pending_sign',
          toStatus: 'reviewing',
        });

        results.push({ planId: pid, planNo: plan.planNo, success: true, reason: null });
      } catch (e: any) {
        if (!plan) plan = await this.planRepo.findOneBy({ id: pid });
        const reason = e?.message || String(e);
        results.push({ planId: pid, planNo: plan?.planNo || `PR-${pid}`, success: false, reason });
        try {
          await this.recordRepo.save({
            planId: pid,
            action: '批量签收拦截',
            operator: user.name,
            operatorRole: user.role,
            fromStatus: plan?.status || null,
            toStatus: plan?.status || null,
            result: '失败',
            exceptionReason: reason,
          });
        } catch {}
      }
    }

    return results;
  }

  async batchVerify(dto: BatchVerifyDto) {
    const user = this.authService.getCurrentUser();
    const results: { planId: number; planNo: string; success: boolean; reason: string | null }[] = [];

    for (const pid of dto.planIds) {
      let plan: Plan | null = null;
      try {
        plan = await this.findOne(pid);

        const actionType = dto.result === 'approve' ? 'verify_approve' : dto.result === 'reject' ? 'verify_reject' : '';
        if (!actionType) {
          throw new HttpException('无效的复核结果', HttpStatus.BAD_REQUEST);
        }

        this.validatePlanAction(plan, actionType, plan.version);

        if (dto.result === 'approve' && plan.dueWarning === 'overdue') {
          const reason = `逾期单据不能批量放行，需逐条处理。责任人：${plan.responsiblePerson}`;
          results.push({ planId: pid, planNo: plan.planNo, success: false, reason });
          await this.recordRepo.save({
            planId: plan.id,
            action: '批量复核拦截-逾期',
            operator: user.name,
            operatorRole: user.role,
            fromStatus: 'pending_verify',
            toStatus: 'pending_verify',
            result: '失败',
            exceptionReason: reason,
          });
          continue;
        }

        if (dto.result === 'approve') {
          plan.status = 'archived';
          plan.currentHandler = '';
          plan.currentHandlerRole = '';
          plan.verifyResult = '复核通过，已归档';
          plan.returnReason = null;
          plan.exceptionTag = null;
          plan.version += 1;
          await this.planRepo.save(plan);
          await this.recordRepo.save({
            planId: plan.id,
            action: '复核归档',
            operator: user.name,
            operatorRole: user.role,
            fromStatus: 'pending_verify',
            toStatus: 'archived',
            result: '复核通过',
            auditNote: dto.auditNote,
          });
        } else if (dto.result === 'reject') {
          plan.status = 'rejected';
          plan.currentHandler = '张晓明';
          plan.currentHandlerRole = 'registrar';
          plan.exceptionTag = '异常回传';
          plan.returnReason = '异常回传';
          plan.verifyResult = '异常回传';
          plan.version += 1;
          await this.planRepo.save(plan);
          await this.recordRepo.save({
            planId: plan.id,
            action: '异常回传',
            operator: user.name,
            operatorRole: user.role,
            fromStatus: 'pending_verify',
            toStatus: 'rejected',
            result: '异常回传',
            exceptionReason: '异常回传',
            auditNote: dto.auditNote,
          });
        }

        results.push({ planId: pid, planNo: plan.planNo, success: true, reason: null });
      } catch (e: any) {
        if (!plan) plan = await this.planRepo.findOneBy({ id: pid });
        const reason = e?.message || String(e);
        results.push({ planId: pid, planNo: plan?.planNo || `PR-${pid}`, success: false, reason });
        try {
          await this.recordRepo.save({
            planId: pid,
            action: '批量复核拦截',
            operator: user.name,
            operatorRole: user.role,
            fromStatus: plan?.status || null,
            toStatus: plan?.status || null,
            result: '失败',
            exceptionReason: reason,
          });
        } catch {}
      }
    }

    return results;
  }

  async getAuditTrail(id: number) {
    const plan = await this.findOne(id);
    return {
      planNo: plan.planNo,
      title: plan.title,
      records: plan.processRecords.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
  }

  async uploadAttachment(planId: number, fileName: string, fileType: string, fileSize: number) {
    const existing = await this.attachRepo.findOneBy({
      planId, fileName, fileType,
    });
    if (existing) {
      existing.uploadedAt = new Date().toISOString();
      existing.fileSize = fileSize;
      return this.attachRepo.save(existing);
    }
    return this.attachRepo.save({
      planId,
      fileName,
      fileType,
      fileSize,
      required: false,
      uploadedAt: new Date().toISOString(),
    });
  }

  async getAttachments(planId: number) {
    return this.attachRepo.findBy({ planId });
  }

  async addAuditNote(planId: number, content: string) {
    const user = this.authService.getCurrentUser();
    if (!user) throw new HttpException('未登录', HttpStatus.UNAUTHORIZED);
    return this.noteRepo.save({
      planId,
      content,
      author: user.name,
      authorRole: user.role,
    });
  }

  async getStats() {
    const plans = await this.planRepo.find();
    const stats = {
      total: plans.length,
      pending_sign: plans.filter((p) => p.status === 'pending_sign').length,
      reviewing: plans.filter((p) => p.status === 'reviewing').length,
      pending_verify: plans.filter((p) => p.status === 'pending_verify').length,
      archived: plans.filter((p) => p.status === 'archived').length,
      returned: plans.filter((p) => p.status === 'returned').length,
      rejected: plans.filter((p) => p.status === 'rejected').length,
      overdue: plans.filter((p) => p.dueWarning === 'overdue').length,
      exception: plans.filter((p) => p.exceptionTag).length,
    };
    return stats;
  }

  async seedDemoData() {
    await this.planRepo.clear();
    await this.attachRepo.clear();
    await this.recordRepo.clear();
    await this.noteRepo.clear();

    const demoPlans = [
      {
        planNo: 'PR-2026-1001',
        title: 'Q2品牌传播计划-A客户',
        type: 'communication_plan',
        status: 'pending_sign',
        priority: 'high',
        dueDate: this.futureDate(10),
        responsiblePerson: '张晓明',
        currentHandler: '李审核',
        currentHandlerRole: 'reviewer',
        dueWarning: 'normal',
        creatorId: 1,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1002',
        title: '新产品发布素材审核',
        type: 'material_review',
        status: 'reviewing',
        priority: 'urgent',
        dueDate: this.futureDate(1),
        responsiblePerson: '张晓明',
        currentHandler: '李审核',
        currentHandlerRole: 'reviewer',
        dueWarning: 'approaching',
        creatorId: 1,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1003',
        title: '618投放确认-电商渠道',
        type: 'placement_confirm',
        status: 'pending_verify',
        priority: 'high',
        dueDate: this.futureDate(5),
        responsiblePerson: '张晓明',
        currentHandler: '王总监',
        currentHandlerRole: 'director',
        dueWarning: 'normal',
        creatorId: 1,
        verifyResult: null,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1004',
        title: '缺材料传播计划-B客户',
        type: 'communication_plan',
        status: 'pending_verify',
        priority: 'normal',
        dueDate: this.futureDate(7),
        responsiblePerson: '张晓明',
        currentHandler: '王总监',
        currentHandlerRole: 'director',
        dueWarning: 'normal',
        creatorId: 1,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1005',
        title: '逾期未处理-线下活动传播',
        type: 'communication_plan',
        status: 'pending_sign',
        priority: 'urgent',
        dueDate: this.pastDate(2),
        responsiblePerson: '张晓明',
        currentHandler: '李审核',
        currentHandlerRole: 'reviewer',
        dueWarning: 'overdue',
        creatorId: 1,
        exceptionTag: '逾期',
      },
      {
        planNo: 'PR-2026-1006',
        title: '逾期素材审核-视频物料',
        type: 'material_review',
        status: 'reviewing',
        priority: 'high',
        dueDate: this.pastDate(1),
        responsiblePerson: '张晓明',
        currentHandler: '李审核',
        currentHandlerRole: 'reviewer',
        dueWarning: 'overdue',
        creatorId: 1,
        exceptionTag: '逾期',
      },
      {
        planNo: 'PR-2026-1007',
        title: '退回补正-C客户投放确认',
        type: 'placement_confirm',
        status: 'returned',
        priority: 'normal',
        dueDate: this.futureDate(5),
        responsiblePerson: '张晓明',
        currentHandler: '张晓明',
        currentHandlerRole: 'registrar',
        dueWarning: 'normal',
        creatorId: 1,
        exceptionTag: '退回补正',
        returnReason: '投放渠道信息不完整，请补充具体投放平台和预算明细',
      },
      {
        planNo: 'PR-2026-1008',
        title: '异常回传-D客户传播计划',
        type: 'communication_plan',
        status: 'rejected',
        priority: 'low',
        dueDate: this.futureDate(15),
        responsiblePerson: '张晓明',
        currentHandler: '张晓明',
        currentHandlerRole: 'registrar',
        dueWarning: 'normal',
        creatorId: 1,
        exceptionTag: '异常回传',
        returnReason: '传播方案与客户需求不符，需要重新制定',
      },
      {
        planNo: 'PR-2026-1009',
        title: '已归档-春季品牌推广',
        type: 'communication_plan',
        status: 'archived',
        priority: 'normal',
        dueDate: this.futureDate(0),
        responsiblePerson: '张晓明',
        currentHandler: '',
        currentHandlerRole: '',
        dueWarning: 'normal',
        creatorId: 1,
        verifyResult: '复核通过，已归档',
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1010',
        title: '状态冲突-素材审核测试',
        type: 'material_review',
        status: 'pending_verify',
        priority: 'urgent',
        dueDate: this.futureDate(3),
        responsiblePerson: '张晓明',
        currentHandler: '王总监',
        currentHandlerRole: 'director',
        dueWarning: 'approaching',
        creatorId: 1,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1011',
        title: '待签收-新品传播计划',
        type: 'communication_plan',
        status: 'pending_sign',
        priority: 'normal',
        dueDate: this.futureDate(7),
        responsiblePerson: '张晓明',
        currentHandler: '李审核',
        currentHandlerRole: 'reviewer',
        dueWarning: 'normal',
        creatorId: 1,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1012',
        title: '待签收-KOL投放确认',
        type: 'placement_confirm',
        status: 'pending_sign',
        priority: 'high',
        dueDate: this.futureDate(2),
        responsiblePerson: '张晓明',
        currentHandler: '李审核',
        currentHandlerRole: 'reviewer',
        dueWarning: 'approaching',
        creatorId: 1,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1013',
        title: '审核中-品牌升级素材',
        type: 'material_review',
        status: 'reviewing',
        priority: 'normal',
        dueDate: this.futureDate(4),
        responsiblePerson: '张晓明',
        currentHandler: '李审核',
        currentHandlerRole: 'reviewer',
        dueWarning: 'normal',
        creatorId: 1,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1014',
        title: '待复核-双11传播计划',
        type: 'communication_plan',
        status: 'pending_verify',
        priority: 'urgent',
        dueDate: this.futureDate(2),
        responsiblePerson: '张晓明',
        currentHandler: '王总监',
        currentHandlerRole: 'director',
        dueWarning: 'approaching',
        creatorId: 1,
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1015',
        title: '签收完成-新年祝福投放',
        type: 'placement_confirm',
        status: 'archived',
        priority: 'normal',
        dueDate: this.futureDate(-10),
        responsiblePerson: '张晓明',
        currentHandler: '',
        currentHandlerRole: '',
        dueWarning: 'normal',
        creatorId: 1,
        verifyResult: '复核通过，已归档',
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1016',
        title: '签收完成-季度传播复盘',
        type: 'communication_plan',
        status: 'archived',
        priority: 'low',
        dueDate: this.futureDate(-5),
        responsiblePerson: '张晓明',
        currentHandler: '',
        currentHandlerRole: '',
        dueWarning: 'normal',
        creatorId: 1,
        verifyResult: '复核通过，已归档',
        exceptionTag: null,
      },
      {
        planNo: 'PR-2026-1017',
        title: '退回补正-展会素材审核',
        type: 'material_review',
        status: 'returned',
        priority: 'high',
        dueDate: this.futureDate(3),
        responsiblePerson: '张晓明',
        currentHandler: '张晓明',
        currentHandlerRole: 'registrar',
        dueWarning: 'approaching',
        creatorId: 1,
        exceptionTag: '退回补正',
        returnReason: '素材分辨率不足，且缺少品牌Logo规范版本',
      },
      {
        planNo: 'PR-2026-1018',
        title: '异常回传-户外广告投放',
        type: 'placement_confirm',
        status: 'rejected',
        priority: 'high',
        dueDate: this.futureDate(8),
        responsiblePerson: '张晓明',
        currentHandler: '张晓明',
        currentHandlerRole: 'registrar',
        dueWarning: 'normal',
        creatorId: 1,
        exceptionTag: '异常回传',
        returnReason: '投放点位与方案严重不符，需重新评估供应商',
      },
      {
        planNo: 'PR-2026-1019',
        title: '逾期-待签收-紧急传播',
        type: 'communication_plan',
        status: 'pending_sign',
        priority: 'urgent',
        dueDate: this.pastDate(3),
        responsiblePerson: '张晓明',
        currentHandler: '李审核',
        currentHandlerRole: 'reviewer',
        dueWarning: 'overdue',
        creatorId: 1,
        exceptionTag: '逾期',
      },
      {
        planNo: 'PR-2026-1020',
        title: '逾期-待复核-活动投放',
        type: 'placement_confirm',
        status: 'pending_verify',
        priority: 'urgent',
        dueDate: this.pastDate(1),
        responsiblePerson: '张晓明',
        currentHandler: '王总监',
        currentHandlerRole: 'director',
        dueWarning: 'overdue',
        creatorId: 1,
        exceptionTag: '逾期',
      },
    ];

    for (const dp of demoPlans) {
      const plan = this.planRepo.create(dp);
      const saved = await this.planRepo.save(plan);

      const requiredAtts = this.getDefaultAttachments(dp.type);
      for (const att of requiredAtts) {
        await this.attachRepo.save({
          planId: saved.id,
          fileName: att.fileName,
          fileType: att.fileType,
          required: true,
          fileSize: 0,
          uploadedAt: null,
        });
      }

      if (dp.status === 'archived' || dp.status === 'pending_verify') {
        const isMissingMaterial = dp.planNo === 'PR-2026-1004';
        if (!isMissingMaterial) {
          const atts = await this.attachRepo.findBy({ planId: saved.id });
          for (const att of atts) {
            att.uploadedAt = new Date().toISOString();
            att.fileSize = 1024 * Math.floor(Math.random() * 500 + 100);
            await this.attachRepo.save(att);
          }
        }
      }

      if (dp.status === 'reviewing' || dp.status === 'pending_verify' || dp.status === 'archived') {
        await this.recordRepo.save({
          planId: saved.id,
          action: '发起传播计划单',
          operator: '张晓明',
          operatorRole: 'registrar',
          fromStatus: null,
          toStatus: 'pending_sign',
        });
      }

      if (dp.status === 'reviewing' || dp.status === 'pending_verify' || dp.status === 'archived') {
        await this.recordRepo.save({
          planId: saved.id,
          action: '签收',
          operator: '李审核',
          operatorRole: 'reviewer',
          fromStatus: 'pending_sign',
          toStatus: 'reviewing',
        });
      }

      if (dp.status === 'pending_verify' || dp.status === 'archived') {
        await this.recordRepo.save({
          planId: saved.id,
          action: '审核通过',
          operator: '李审核',
          operatorRole: 'reviewer',
          fromStatus: 'reviewing',
          toStatus: 'pending_verify',
          result: '审核通过',
        });
      }

      if (dp.status === 'archived') {
        await this.recordRepo.save({
          planId: saved.id,
          action: '复核归档',
          operator: '王总监',
          operatorRole: 'director',
          fromStatus: 'pending_verify',
          toStatus: 'archived',
          result: '复核通过',
          auditNote: '材料齐全，流程合规',
        });
      }

      if (dp.status === 'returned') {
        await this.recordRepo.save({
          planId: saved.id,
          action: '发起传播计划单',
          operator: '张晓明',
          operatorRole: 'registrar',
          fromStatus: null,
          toStatus: 'pending_sign',
        });
        await this.recordRepo.save({
          planId: saved.id,
          action: '签收',
          operator: '李审核',
          operatorRole: 'reviewer',
          fromStatus: 'pending_sign',
          toStatus: 'reviewing',
        });
        await this.recordRepo.save({
          planId: saved.id,
          action: '退回补正',
          operator: '李审核',
          operatorRole: 'reviewer',
          fromStatus: 'reviewing',
          toStatus: 'returned',
          returnReason: dp.returnReason,
        });
      }

      if (dp.status === 'rejected') {
        await this.recordRepo.save({
          planId: saved.id,
          action: '发起传播计划单',
          operator: '张晓明',
          operatorRole: 'registrar',
          fromStatus: null,
          toStatus: 'pending_sign',
        });
        await this.recordRepo.save({
          planId: saved.id,
          action: '签收',
          operator: '李审核',
          operatorRole: 'reviewer',
          fromStatus: 'pending_sign',
          toStatus: 'reviewing',
        });
        await this.recordRepo.save({
          planId: saved.id,
          action: '审核通过',
          operator: '李审核',
          operatorRole: 'reviewer',
          fromStatus: 'reviewing',
          toStatus: 'pending_verify',
          result: '审核通过',
        });
        await this.recordRepo.save({
          planId: saved.id,
          action: '异常回传',
          operator: '王总监',
          operatorRole: 'director',
          fromStatus: 'pending_verify',
          toStatus: 'rejected',
          returnReason: dp.returnReason,
          exceptionReason: dp.returnReason,
        });
      }

      if (dp.status === 'pending_sign') {
        await this.recordRepo.save({
          planId: saved.id,
          action: '发起传播计划单',
          operator: '张晓明',
          operatorRole: 'registrar',
          fromStatus: null,
          toStatus: 'pending_sign',
        });
      }

      if (dp.status === 'reviewing' && dp.exceptionTag === '逾期') {
        await this.recordRepo.save({
          planId: saved.id,
          action: '发起传播计划单',
          operator: '张晓明',
          operatorRole: 'registrar',
          fromStatus: null,
          toStatus: 'pending_sign',
        });
        await this.recordRepo.save({
          planId: saved.id,
          action: '签收',
          operator: '李审核',
          operatorRole: 'reviewer',
          fromStatus: 'pending_sign',
          toStatus: 'reviewing',
        });
      }
    }

    planCounter = 1020;
    return { message: '演示数据初始化完成，共20条记录' };
  }

  private validatePlanAction(plan: Plan, actionType: string, requestVersion?: number) {
    const user = this.authService.getCurrentUser();
    if (!user) throw new HttpException('未登录', HttpStatus.UNAUTHORIZED);

    const actionConfig: Record<string, { requiredRole: string; allowedStatuses: string[]; actionName: string; checkEvidence?: boolean }> = {
      sign: { requiredRole: 'reviewer', allowedStatuses: ['pending_sign'], actionName: '签收' },
      review_approve: { requiredRole: 'reviewer', allowedStatuses: ['reviewing'], actionName: '审核通过' },
      review_return: { requiredRole: 'reviewer', allowedStatuses: ['reviewing'], actionName: '退回补正' },
      correct: { requiredRole: 'registrar', allowedStatuses: ['returned', 'rejected'], actionName: '补正提交' },
      verify_approve: { requiredRole: 'director', allowedStatuses: ['pending_verify'], actionName: '复核归档', checkEvidence: true },
      verify_reject: { requiredRole: 'director', allowedStatuses: ['pending_verify'], actionName: '异常回传' },
    };

    const config = actionConfig[actionType];
    if (!config) throw new HttpException('无效的操作类型', HttpStatus.BAD_REQUEST);

    if (user.role !== config.requiredRole) {
      const roleNames: Record<string, string> = {
        registrar: '登记员',
        reviewer: '审核主管',
        director: '复核负责人',
      };
      throw new HttpException(`越权：仅${roleNames[config.requiredRole]}可${config.actionName}`, HttpStatus.FORBIDDEN);
    }

    if (user.name !== plan.currentHandler || user.role !== plan.currentHandlerRole) {
      throw new HttpException(
        `处理人不匹配：当前处理人为${plan.currentHandler}(${plan.currentHandlerRole})，您是${user.name}(${user.role})`,
        HttpStatus.FORBIDDEN,
      );
    }

    if (!config.allowedStatuses.includes(plan.status)) {
      throw new HttpException(`状态冲突：当前状态为${plan.status}，无法${config.actionName}`, HttpStatus.CONFLICT);
    }

    if (requestVersion !== undefined && plan.version !== requestVersion) {
      throw new HttpException('版本冲突：数据已被修改，请刷新后重试', HttpStatus.CONFLICT);
    }

    if (config.checkEvidence) {
      const missingAtts = plan.attachments?.filter((a) => a.required && !a.uploadedAt);
      if (missingAtts && missingAtts.length > 0) {
        throw new HttpException(
          `资料缺失：缺少必填附件 [${missingAtts.map((a) => a.fileName).join(', ')}]，需登记员补正`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private futureDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  private pastDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  private getDefaultAttachments(type: string): { fileName: string; fileType: string }[] {
    switch (type) {
      case 'communication_plan':
        return [
          { fileName: '传播方案文档', fileType: 'docx' },
          { fileName: '客户确认函', fileType: 'pdf' },
          { fileName: '预算明细表', fileType: 'xlsx' },
        ];
      case 'material_review':
        return [
          { fileName: '素材源文件', fileType: 'zip' },
          { fileName: '版权授权书', fileType: 'pdf' },
          { fileName: '审核意见表', fileType: 'docx' },
        ];
      case 'placement_confirm':
        return [
          { fileName: '投放排期表', fileType: 'xlsx' },
          { fileName: '渠道合同', fileType: 'pdf' },
          { fileName: '效果预估报告', fileType: 'docx' },
        ];
      default:
        return [];
    }
  }
}
