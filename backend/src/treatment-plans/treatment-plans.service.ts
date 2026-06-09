import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { TreatmentPlan } from '../entities/treatment-plan.entity';
import { Attachment } from '../entities/attachment.entity';
import { ProcessRecord } from '../entities/process-record.entity';
import { AuditNote } from '../entities/audit-note.entity';
import { ExceptionCause } from '../entities/exception-cause.entity';
import { User } from '../entities/user.entity';
import {
  ProcessPlanDto,
  BatchProcessDto,
  AuditNoteDto,
  CorrectDto,
} from './dto/treatment-plan.dto';
import {
  TreatmentPlanStatus,
  UserRole,
  STATUS_FLOW,
  ROLE_PERMISSIONS,
  STATUS_HANDLER_ROLE,
  DeadlineWarning,
} from '../common/types';

const APPROACHING_DAYS = 7;

interface ProcessContext {
  user: User;
  plan: TreatmentPlan;
  action: string;
}

@Injectable()
export class TreatmentPlansService {
  constructor(
    @InjectRepository(TreatmentPlan)
    private plansRepository: Repository<TreatmentPlan>,
    @InjectRepository(Attachment)
    private attachmentsRepository: Repository<Attachment>,
    @InjectRepository(ProcessRecord)
    private processRecordsRepository: Repository<ProcessRecord>,
    @InjectRepository(AuditNote)
    private auditNotesRepository: Repository<AuditNote>,
    @InjectRepository(ExceptionCause)
    private exceptionCausesRepository: Repository<ExceptionCause>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  private computeDueStatus(deadline: Date | null | undefined): DeadlineWarning {
    if (!deadline) return 'normal';
    const now = new Date();
    const dl = new Date(deadline);
    const approachingThreshold = new Date(
      now.getTime() + APPROACHING_DAYS * 24 * 60 * 60 * 1000,
    );
    if (dl < now) return 'overdue';
    if (dl <= approachingThreshold) return 'approaching';
    return 'normal';
  }

  private resolveNextStatus(
    currentStatus: TreatmentPlanStatus,
    action: string,
    role: UserRole,
  ): TreatmentPlanStatus {
    const allowedFrom = ROLE_PERMISSIONS[role];
    if (!allowedFrom.includes(currentStatus)) {
      throw new ForbiddenException(`当前角色无权处理「${currentStatus}」状态的计划`);
    }

    const possibleNexts = STATUS_FLOW[currentStatus];
    if (!possibleNexts || possibleNexts.length === 0) {
      throw new BadRequestException(`当前状态「${currentStatus}」无法继续流转`);
    }

    let nextStatus: TreatmentPlanStatus;

    if (currentStatus === 'confirmed') {
      if (action === 'mark_exception') {
        nextStatus = 'exception';
      } else if (action === 'submit_review') {
        nextStatus = 'pending_review';
      } else {
        throw new BadRequestException(
          `已确认状态的有效操作为 mark_exception 或 submit_review`,
        );
      }
    } else if (currentStatus === 'pending_confirm') {
      if (action !== 'confirm') {
        throw new BadRequestException('待确认状态仅允许 confirm 操作');
      }
      nextStatus = 'confirmed';
    } else if (currentStatus === 'exception') {
      if (action !== 'resolve_exception') {
        throw new BadRequestException('异常状态仅允许 resolve_exception 操作');
      }
      nextStatus = 'pending_review';
    } else if (currentStatus === 'pending_review') {
      if (action !== 'review') {
        throw new BadRequestException('待复查状态仅允许 review 操作');
      }
      nextStatus = 'reviewed';
    } else if (currentStatus === 'reviewed') {
      if (action !== 'archive') {
        throw new BadRequestException('已复查状态仅允许 archive 操作');
      }
      nextStatus = 'archived';
    } else {
      throw new BadRequestException(`不支持的操作：${action}`);
    }

    if (!possibleNexts.includes(nextStatus)) {
      throw new ConflictException(
        `状态流转非法：${currentStatus} → ${nextStatus}`,
      );
    }
    return nextStatus;
  }

  private validateCommon(ctx: ProcessContext, dto: ProcessPlanDto): void {
    const { user, plan } = ctx;

    if (dto.version !== plan.version) {
      throw new ConflictException(
        `版本冲突，当前版本=${plan.version}，传入=${dto.version}`,
      );
    }

    if (plan.currentHandler !== user.id) {
      throw new ForbiddenException(
        `您不是当前处理人，当前处理人ID=${plan.currentHandler}`,
      );
    }
  }

  async findAll(query: {
    status?: TreatmentPlanStatus;
    role?: UserRole;
    search?: string;
    deadlineWarning?: DeadlineWarning;
  }) {
    const qb = this.plansRepository.createQueryBuilder('p');

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    if (query.role) {
      const allowedStatuses = ROLE_PERMISSIONS[query.role];
      if (allowedStatuses && allowedStatuses.length > 0) {
        qb.andWhere('p.status IN (:...statuses)', { statuses: allowedStatuses });
      }
    }

    if (query.search) {
      const kw = `%${query.search}%`;
      qb.andWhere(
        '(p.patientName LIKE :kw OR p.patientIdCard LIKE :kw OR p.patientPhone LIKE :kw OR p.planNo LIKE :kw)',
        { kw },
      );
    }

    let plans = await qb.orderBy('p.createdAt', 'DESC').getMany();

    const handlerIds: number[] = plans.map((p: TreatmentPlan) => p.currentHandler).filter((x): x is number => !!x);
    const uniqueHandlerIds = Array.from(new Set(handlerIds));
    const users = uniqueHandlerIds.length
      ? await this.usersRepository.find({ where: { id: In(uniqueHandlerIds) } })
      : [];
    const userMap = new Map(users.map((u: User) => [u.id, u]));

    if (query.deadlineWarning) {
      plans = plans.filter((p: TreatmentPlan) => {
        const ds = this.computeDueStatus(p.deadline);
        return ds === query.deadlineWarning;
      });
    }

    return plans.map((p: TreatmentPlan) => ({
      id: p.id,
      planNo: p.planNo,
      patientName: p.patientName,
      patientPhone: p.patientPhone,
      phone: p.patientPhone,
      status: p.status,
      currentHandler: userMap.get(p.currentHandler)?.name || '',
      createdAt: p.createdAt,
      deadline: p.deadline,
      dueStatus: this.computeDueStatus(p.deadline),
      version: p.version,
    }));
  }

  async findOne(id: number) {
    const plan = await this.plansRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('治疗计划不存在');
    }
    const [attachments, records, notes, exceptions] = await Promise.all([
      this.attachmentsRepository.find({ where: { planId: id } }),
      this.processRecordsRepository.find({
        where: { planId: id },
        order: { createdAt: 'DESC' },
      }),
      this.auditNotesRepository.find({
        where: { planId: id },
        order: { createdAt: 'DESC' },
      }),
      this.exceptionCausesRepository.find({
        where: { planId: id },
        order: { createdAt: 'DESC' },
      }),
    ]);

    const handlerIds: number[] = [
      plan.currentHandler,
      plan.doctorId,
      plan.consultantId,
      plan.deanId,
    ].filter((x): x is number => !!x);
    records.forEach((r: ProcessRecord) => handlerIds.push(r.userId));
    notes.forEach((n: AuditNote) => handlerIds.push(n.userId));
    exceptions.forEach((e: ExceptionCause) => handlerIds.push(e.reportedBy));
    attachments.forEach((a: Attachment) => handlerIds.push(a.uploadedBy));

    const uniqueUserIds = Array.from(new Set(handlerIds));
    const users = uniqueUserIds.length
      ? await this.usersRepository.find({ where: { id: In(uniqueUserIds) } })
      : [];
    const userMap = new Map(users.map((u: User) => [u.id, u]));

    const patientAttachments = attachments.filter((a: Attachment) => a.type === 'patient');
    const planAttachments = attachments.filter((a: Attachment) => a.type === 'plan');
    const reminderAttachments = attachments.filter((a: Attachment) => a.type === 'reminder');

    const formatAttachment = (a: Attachment) => ({
      id: a.id,
      name: a.filename,
      filename: a.filename,
      url: a.url,
      uploadedAt: a.uploadedAt,
    });

    const currentHandlerName = userMap.get(plan.currentHandler)?.name || '';

    return {
      id: plan.id,
      planNo: plan.planNo,
      status: plan.status,
      version: plan.version,
      currentHandler: currentHandlerName,
      currentHandlerUser: { name: currentHandlerName },
      createdAt: plan.createdAt,
      deadline: plan.deadline,
      dueStatus: this.computeDueStatus(plan.deadline),
      materialsComplete: plan.materialsComplete,
      planComplete: plan.planComplete,
      reminderComplete: plan.reminderComplete,
      patient: {
        id: plan.id,
        name: plan.patientName,
        idCard: plan.patientIdCard,
        phone: plan.patientPhone,
      },
      patientProfile: {
        patient: {
          id: plan.id,
          name: plan.patientName,
          idCard: plan.patientIdCard,
          phone: plan.patientPhone,
        },
        attachments: patientAttachments.map(formatAttachment),
      },
      treatmentPlan: {
        content: plan.lastHandlerRemark || '',
        attachments: planAttachments.map(formatAttachment),
      },
      followUpReminder: {
        followUpDate: '',
        content: '',
        attachments: reminderAttachments.map(formatAttachment),
      },
      abnormalReasons: exceptions.map((e: ExceptionCause) => ({
        id: e.id,
        category: e.type,
        reason: e.description,
        description: e.description,
        resolved: e.resolved,
        createdAt: e.createdAt,
      })),
      processHistory: records.map((r: ProcessRecord) => ({
        id: r.id,
        operator: userMap.get(r.userId)?.name || '',
        action: r.action,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        remark: r.remark || '',
        evidence: r.evidence || '',
        createdAt: r.createdAt,
      })),
      auditNotes: notes.map((n: AuditNote) => ({
        id: n.id,
        author: userMap.get(n.userId)?.name || '',
        note: n.note,
        createdAt: n.createdAt,
      })),
    };
  }

  async process(id: number, dto: ProcessPlanDto, user: User) {
    const result = await this.processInternal(id, dto, user);
    return result.data;
  }

  private async processInternal(id: number, dto: ProcessPlanDto, user: User) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const plan = await queryRunner.manager.findOne(TreatmentPlan, {
        where: { id },
      });
      if (!plan) {
        throw new NotFoundException('治疗计划不存在');
      }

      const ctx: ProcessContext = { user, plan, action: dto.action };
      this.validateCommon(ctx, dto);

      const originalStatus = plan.status;
      const nextStatus = this.resolveNextStatus(plan.status, dto.action, user.role);

      if (dto.action === 'mark_exception') {
        const hasAttachments =
          (dto.attachments && dto.attachments.length > 0) ||
          (dto.evidence && dto.evidence.trim().length > 0);
        if (!hasAttachments) {
          throw new BadRequestException('标记异常必须提供附件或证据说明');
        }
        if (!dto.exceptionCause) {
          throw new BadRequestException('标记异常必须填写异常原因');
        }
      }

      if (dto.action === 'submit_review' && !plan.reminderComplete) {
        const hasReminder =
          dto.reminderComplete ||
          (dto.attachments && dto.attachments.some((a) => a.type === 'reminder')) ||
          (dto.evidence && dto.evidence.trim().length > 0);
        if (!hasReminder) {
          throw new BadRequestException('提交复查前必须完成复诊提醒（有提醒证据）');
        }
      }

      if (dto.action === 'resolve_exception') {
        const hasEvidence =
          (dto.attachments && dto.attachments.length > 0) ||
          (dto.evidence && dto.evidence.trim().length > 0) ||
          dto.materialsComplete === true ||
          dto.planComplete === true ||
          dto.reminderComplete === true;
        if (!hasEvidence) {
          throw new BadRequestException('异常补正必须提供补正证据或标记材料/计划/提醒已补全');
        }
      }

      plan.status = nextStatus;
      plan.version = plan.version + 1;
      plan.lastHandlerRemark = dto.remark || plan.lastHandlerRemark;

      if (typeof dto.materialsComplete === 'boolean') {
        plan.materialsComplete = dto.materialsComplete;
      }
      if (typeof dto.planComplete === 'boolean') {
        plan.planComplete = dto.planComplete;
      }
      if (typeof dto.reminderComplete === 'boolean') {
        plan.reminderComplete = dto.reminderComplete;
      }

      const handlerRole = STATUS_HANDLER_ROLE[nextStatus];
      const nextHandler = await queryRunner.manager.findOne(User, {
        where: { role: handlerRole },
      });
      if (nextHandler) {
        plan.currentHandler = nextHandler.id;
      }

      if (nextStatus === 'confirmed' && !plan.doctorId && user.role === 'doctor') {
        plan.doctorId = user.id;
      }
      if (originalStatus === 'pending_confirm' && !plan.consultantId && user.role === 'consultant') {
        plan.consultantId = user.id;
      }
      if (nextStatus === 'reviewed' && !plan.deanId && user.role === 'dean') {
        plan.deanId = user.id;
      }

      await queryRunner.manager.save(plan);

      const record = new ProcessRecord();
      record.planId = plan.id;
      record.userId = user.id;
      record.action = dto.action;
      record.fromStatus = originalStatus;
      record.toStatus = nextStatus;
      record.remark = dto.remark || null;
      record.evidence = dto.evidence || null;
      await queryRunner.manager.save(record);

      if (dto.attachments && dto.attachments.length > 0) {
        for (const a of dto.attachments) {
          const att = new Attachment();
          att.planId = plan.id;
          att.type = a.type;
          att.filename = a.filename;
          att.url = a.url;
          att.uploadedBy = user.id;
          await queryRunner.manager.save(att);
        }
      }

      if (dto.action === 'mark_exception' && dto.exceptionCause) {
        const cause = new ExceptionCause();
        cause.planId = plan.id;
        cause.type = dto.exceptionCause.type;
        cause.description = dto.exceptionCause.description;
        cause.reportedBy = user.id;
        cause.resolved = false;
        await queryRunner.manager.save(cause);
      }

      if (dto.action === 'resolve_exception') {
        await queryRunner.manager.update(
          ExceptionCause,
          { planId: plan.id, resolved: false },
          { resolved: true },
        );
      }

      await queryRunner.commitTransaction();

      return { success: true, data: plan };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async batchProcess(dto: BatchProcessDto, user: User) {
    const results: {
      id: number;
      success: boolean;
      reason?: string;
    }[] = [];

    for (const item of dto.items) {
      try {
        await this.processInternal(item.id, item as ProcessPlanDto, user);
        results.push({ id: item.id, success: true });
      } catch (e: any) {
        results.push({
          id: item.id,
          success: false,
          reason: e.message || '未知错误',
        });
      }
    }
    return { results };
  }

  async addAuditNote(id: number, dto: AuditNoteDto, user: User) {
    const plan = await this.plansRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('治疗计划不存在');
    }
    const note = new AuditNote();
    note.planId = id;
    note.userId = user.id;
    note.note = dto.note;
    return this.auditNotesRepository.save(note);
  }

  private normalizeModule(module: string): AttachmentType {
    const map: Record<string, AttachmentType> = {
      patient: 'patient',
      patient_profile: 'patient',
      plan: 'plan',
      treatment_plan: 'plan',
      reminder: 'reminder',
      follow_up_reminder: 'reminder',
    };
    return map[module] || 'patient';
  }

  async correct(dto: CorrectDto, user: User) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const plan = await queryRunner.manager.findOne(TreatmentPlan, {
        where: { id: dto.planId },
      });
      if (!plan) {
        throw new NotFoundException('治疗计划不存在');
      }

      const normModule = this.normalizeModule(dto.module);

      if (normModule === 'patient') {
        plan.materialsComplete = true;
      } else if (normModule === 'plan') {
        plan.planComplete = true;
      } else if (normModule === 'reminder') {
        plan.reminderComplete = true;
      }

      if (dto.data) {
        if (normModule === 'patient') {
          if (typeof dto.data.name === 'string' && dto.data.name.trim()) plan.patientName = dto.data.name;
          if (typeof dto.data.idCard === 'string' && dto.data.idCard.trim()) plan.patientIdCard = dto.data.idCard;
          if (typeof dto.data.phone === 'string' && dto.data.phone.trim()) plan.patientPhone = dto.data.phone;
        }
        if (normModule === 'plan') {
          if (typeof dto.data.content === 'string' && dto.data.content.trim()) plan.lastHandlerRemark = dto.data.content;
        }
        if (normModule === 'reminder') {
          if (typeof dto.data.content === 'string' && dto.data.content.trim()) {
            plan.lastHandlerRemark = `【复诊提醒】${dto.data.content}${plan.lastHandlerRemark ? ' | ' + plan.lastHandlerRemark : ''}`;
          }
        }
      }

      await queryRunner.manager.save(plan);

      if (dto.attachments && dto.attachments.length > 0) {
        for (const a of dto.attachments) {
          const att = new Attachment();
          att.planId = plan.id;
          att.type = a.type || normModule;
          att.filename = a.filename;
          att.url = a.url;
          att.uploadedBy = user.id;
          await queryRunner.manager.save(att);
        }
      }

      await queryRunner.commitTransaction();

      return { success: true, planId: plan.id };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
