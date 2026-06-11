import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { AuthService } from '../auth/auth.service';
import {
  TASK_STATUS,
  STATUS_FLOW,
  USER_ROLES,
  TASK_STATUS_LABELS,
  OVERDUE_STATUS,
} from '../common/constants';
import { BusinessException, ErrorCodes } from '../common/exceptions';
import { v4 as uuidv4 } from 'uuid';

interface ActionValidationResult {
  allowed: boolean;
  code?: string;
  message?: string;
  targetStatus?: string;
  extraChecks?: {
    requireEvidence?: boolean;
    checkPendingMaterials?: boolean;
    checkFieldRecords?: boolean;
  };
}

interface BatchActionResult {
  taskId: string;
  taskNo: string;
  success: boolean;
  reason?: string;
}

@Injectable()
export class PlantingTaskService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  private readonly ACTION_RULES: Record<string, {
    allowedFrom: string[];
    targetStatus?: string;
    allowedRoles: string[];
    requireAssignee?: boolean;
    extraChecks?: {
      requireEvidence?: boolean;
      checkPendingMaterials?: boolean;
      checkFieldRecords?: boolean;
      evidenceLabel?: string;
    };
  }> = {
    assign: {
      allowedFrom: [TASK_STATUS.PENDING_ASSIGN, TASK_STATUS.RETURNED_FOR_CORRECTION, TASK_STATUS.ASSIGNED],
      targetStatus: TASK_STATUS.ASSIGNED,
      allowedRoles: [USER_ROLES.COOPERATIVE_DIRECTOR],
    },
    process: {
      allowedFrom: [TASK_STATUS.ASSIGNED],
      targetStatus: TASK_STATUS.PROCESSING,
      allowedRoles: [USER_ROLES.COOPERATIVE_DIRECTOR, USER_ROLES.AGRICULTURAL_TECHNICIAN, USER_ROLES.FIELD_MANAGER],
      requireAssignee: true,
      extraChecks: {
        requireEvidence: true,
        evidenceLabel: '开始处理需要提供处理依据（如农资清单、作业计划等）',
      },
    },
    complete_processing: {
      allowedFrom: [TASK_STATUS.PROCESSING],
      targetStatus: TASK_STATUS.TRANSFERRED,
      allowedRoles: [USER_ROLES.COOPERATIVE_DIRECTOR, USER_ROLES.AGRICULTURAL_TECHNICIAN, USER_ROLES.FIELD_MANAGER],
      requireAssignee: true,
      extraChecks: {
        requireEvidence: true,
        checkPendingMaterials: true,
        evidenceLabel: '完成处理需要提交处理结果（如田间记录照片、产量数据等）',
      },
    },
    transfer: {
      allowedFrom: [TASK_STATUS.ASSIGNED, TASK_STATUS.PROCESSING, TASK_STATUS.TRANSFERRED],
      targetStatus: TASK_STATUS.TRANSFERRED,
      allowedRoles: [USER_ROLES.COOPERATIVE_DIRECTOR, USER_ROLES.AGRICULTURAL_TECHNICIAN, USER_ROLES.FIELD_MANAGER],
      requireAssignee: true,
    },
    follow_up: {
      allowedFrom: [TASK_STATUS.TRANSFERRED],
      targetStatus: TASK_STATUS.FOLLOWED_UP,
      allowedRoles: [USER_ROLES.COOPERATIVE_DIRECTOR, USER_ROLES.AGRICULTURAL_TECHNICIAN],
      extraChecks: {
        requireEvidence: true,
        evidenceLabel: '回访必须填写回访结果（如客户确认、验收意见等）',
      },
    },
    archive: {
      allowedFrom: [TASK_STATUS.FOLLOWED_UP],
      targetStatus: TASK_STATUS.ARCHIVED,
      allowedRoles: [USER_ROLES.COOPERATIVE_DIRECTOR],
      extraChecks: {
        checkPendingMaterials: true,
        checkFieldRecords: true,
      },
    },
    return_for_correction: {
      allowedFrom: [TASK_STATUS.PENDING_ASSIGN, TASK_STATUS.ASSIGNED, TASK_STATUS.PROCESSING, TASK_STATUS.TRANSFERRED, TASK_STATUS.FOLLOWED_UP],
      targetStatus: TASK_STATUS.RETURNED_FOR_CORRECTION,
      allowedRoles: [USER_ROLES.COOPERATIVE_DIRECTOR, USER_ROLES.AGRICULTURAL_TECHNICIAN],
      extraChecks: {
        requireEvidence: true,
        evidenceLabel: '退回补正必须填写退回原因（材料缺失/时限问题/状态冲突等具体说明）',
      },
    },
  };

  async list(filters: {
    status?: string;
    assigneeId?: string;
    role?: string;
    keyword?: string;
    overdueStatus?: string;
    userId?: string;
    userRole?: string;
  }) {
    let sql = `
      SELECT t.*, u.display_name as assignee_name, c.display_name as creator_name
      FROM planting_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.creator_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.status) {
      sql += ' AND t.status = ?';
      params.push(filters.status);
    }
    if (filters.assigneeId) {
      sql += ' AND t.assignee_id = ?';
      params.push(filters.assigneeId);
    }
    if (filters.keyword) {
      sql += ' AND (t.title LIKE ? OR t.task_no LIKE ? OR t.plan_name LIKE ?)';
      const kw = `%${filters.keyword}%`;
      params.push(kw, kw, kw);
    }

    sql += ' ORDER BY t.updated_at DESC';

    const rows = this.dbService.query(sql, params) as any[];

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const tasks = rows.map((r) => {
      const deadlineDate = r.deadline ? new Date(r.deadline) : null;
      let overdueStatus = OVERDUE_STATUS.NORMAL;
      if (deadlineDate && r.status !== TASK_STATUS.ARCHIVED) {
        if (deadlineDate < now) {
          overdueStatus = OVERDUE_STATUS.OVERDUE;
        } else if (deadlineDate <= threeDaysLater) {
          overdueStatus = OVERDUE_STATUS.NEAR_EXPIRY;
        }
      }

      if (filters.overdueStatus && overdueStatus !== filters.overdueStatus) {
        return null;
      }

      return {
        id: r.id,
        taskNo: r.task_no,
        title: r.title,
        description: r.description,
        status: r.status,
        statusLabel: TASK_STATUS_LABELS[r.status as keyof typeof TASK_STATUS_LABELS] || r.status,
        assigneeId: r.assignee_id,
        assigneeName: r.assignee_name,
        assigneeRole: r.assignee_role,
        creatorId: r.creator_id,
        creatorName: r.creator_name,
        planName: r.plan_name,
        planYear: r.plan_year,
        planMonth: r.plan_month,
        deadline: r.deadline,
        version: r.version,
        exceptionReason: r.exception_reason,
        overdueStatus,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    return tasks.filter(Boolean);
  }

  async statistics(userId?: string, userRole?: string) {
    const rows = this.dbService.query(
      `SELECT status, COUNT(*) as count FROM planting_tasks GROUP BY status`,
    ) as any[];

    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.status] = row.count;
    }

    return {
      pendingAssign: stats[TASK_STATUS.PENDING_ASSIGN] || 0,
      assigned: stats[TASK_STATUS.ASSIGNED] || 0,
      processing: stats[TASK_STATUS.PROCESSING] || 0,
      transferred: stats[TASK_STATUS.TRANSFERRED] || 0,
      followedUp: stats[TASK_STATUS.FOLLOWED_UP] || 0,
      archived: stats[TASK_STATUS.ARCHIVED] || 0,
      returnedForCorrection: stats[TASK_STATUS.RETURNED_FOR_CORRECTION] || 0,
      total: Object.values(stats).reduce((a, b) => a + b, 0),
    };
  }

  async detail(id: string) {
    const task = this.dbService.queryOne(
      `SELECT t.*, u.display_name as assignee_name, c.display_name as creator_name
       FROM planting_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       LEFT JOIN users c ON t.creator_id = c.id
       WHERE t.id = ?`,
      [id],
    ) as any;

    if (!task) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '种植任务不存在', 404);
    }

    const materials = this.dbService.query(
      `SELECT m.*, u.display_name as applicant_name FROM material_requisitions m LEFT JOIN users u ON m.applicant_id = u.id WHERE m.task_id = ? ORDER BY m.applied_at DESC`,
      [id],
    );
    const fieldRecords = this.dbService.query(
      'SELECT f.*, u.display_name as recorder_name FROM field_records f LEFT JOIN users u ON f.recorder_id = u.id WHERE f.task_id = ? ORDER BY f.record_date DESC',
      [id],
    );
    const auditLogs = this.dbService.query(
      'SELECT a.*, u.display_name as operator_name FROM audit_logs a LEFT JOIN users u ON a.operator_id = u.id WHERE a.task_id = ? ORDER BY a.created_at DESC',
      [id],
    );
    const processingRecords = this.dbService.query(
      'SELECT p.*, u.display_name as processor_name FROM processing_records p LEFT JOIN users u ON p.processor_id = u.id WHERE p.task_id = ? ORDER BY p.created_at DESC',
      [id],
    );
    const attachments = this.dbService.query(
      `SELECT a.*, u.display_name as uploader_name FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id WHERE a.task_id = ? ORDER BY a.uploaded_at DESC`,
      [id],
    );

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const deadlineDate = task.deadline ? new Date(task.deadline) : null;
    let overdueStatus = OVERDUE_STATUS.NORMAL;
    if (deadlineDate && task.status !== TASK_STATUS.ARCHIVED) {
      if (deadlineDate < now) overdueStatus = OVERDUE_STATUS.OVERDUE;
      else if (deadlineDate <= threeDaysLater) overdueStatus = OVERDUE_STATUS.NEAR_EXPIRY;
    }

    return {
      id: task.id,
      taskNo: task.task_no,
      title: task.title,
      description: task.description,
      status: task.status,
      statusLabel: TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] || task.status,
      assigneeId: task.assignee_id,
      assigneeName: task.assignee_name,
      assigneeRole: task.assignee_role,
      creatorId: task.creator_id,
      creatorName: task.creator_name,
      planName: task.plan_name,
      planYear: task.plan_year,
      planMonth: task.plan_month,
      deadline: task.deadline,
      version: task.version,
      exceptionReason: task.exception_reason,
      overdueStatus,
      materials,
      fieldRecords,
      auditLogs,
      processingRecords,
      attachments,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    };
  }

  async create(
    body: {
      title: string;
      description?: string;
      planName?: string;
      planYear?: number;
      planMonth?: number;
      deadline?: string;
    },
    userId: string,
    userRole: string,
  ) {
    if (userRole !== USER_ROLES.COOPERATIVE_DIRECTOR && userRole !== USER_ROLES.AGRICULTURAL_TECHNICIAN) {
      throw new BusinessException(ErrorCodes.UNAUTHORIZED_ROLE, '田间管理员不能发起种植任务，需由主任或农技员创建', 403);
    }
    if (!body.title || body.title.trim().length === 0) {
      throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '任务标题不能为空');
    }

    const id = uuidv4();
    const now = new Date();
    const seq = this.dbService.queryOne('SELECT COUNT(*) as cnt FROM planting_tasks').cnt + 1;
    const taskNo = `ZZ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(seq).padStart(4, '0')}`;

    this.dbService.run(
      `INSERT INTO planting_tasks (id, task_no, title, description, status, creator_id, creator_role, plan_name, plan_year, plan_month, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        taskNo,
        body.title,
        body.description || null,
        TASK_STATUS.PENDING_ASSIGN,
        userId,
        userRole,
        body.planName || null,
        body.planYear || null,
        body.planMonth || null,
        body.deadline || null,
      ],
    );

    this.logAudit(id, userId, userRole, 'create', null, TASK_STATUS.PENDING_ASSIGN, null, `创建任务: ${body.title}`);

    return this.detail(id);
  }

  private validateAction(
    action: string,
    task: any,
    version: number,
    userId: string,
    userRole: string,
    evidence?: string,
  ): ActionValidationResult {
    const rule = this.ACTION_RULES[action];
    if (!rule) {
      return { allowed: false, code: ErrorCodes.FORBIDDEN_ACTION, message: `不支持的操作: ${action}` };
    }

    if (task.version !== version) {
      return {
        allowed: false,
        code: ErrorCodes.VERSION_CONFLICT,
        message: `版本冲突：任务已被修改（当前版本v${task.version}，提交版本v${version}），请刷新后重试`,
      };
    }

    if (!rule.allowedFrom.includes(task.status)) {
      return {
        allowed: false,
        code: ErrorCodes.INVALID_STATUS_TRANSITION,
        message: `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"不能执行${this.getActionLabel(action)}`,
      };
    }

    if (!rule.allowedRoles.includes(userRole)) {
      return {
        allowed: false,
        code: ErrorCodes.UNAUTHORIZED_ROLE,
        message: this.getRoleDeniedMessage(action, userRole),
      };
    }

    if (rule.requireAssignee && task.assignee_id !== userId && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      return {
        allowed: false,
        code: ErrorCodes.FORBIDDEN_ACTION,
        message: '只有当前处理人或合作社主任可以操作此任务',
      };
    }

    if (userRole === USER_ROLES.FIELD_MANAGER && task.assignee_role !== USER_ROLES.FIELD_MANAGER && action !== 'transfer') {
      return {
        allowed: false,
        code: ErrorCodes.SKIP_PROCESSING_STEP,
        message: '田间管理员不能跳过处理环节，只能处理分派给自己的任务',
      };
    }

    if (rule.extraChecks?.requireEvidence && (!evidence || evidence.trim().length === 0)) {
      return {
        allowed: false,
        code: ErrorCodes.MISSING_EVIDENCE,
        message: rule.extraChecks.evidenceLabel || '请提供必要的处理依据',
      };
    }

    if (rule.extraChecks?.checkPendingMaterials) {
      const materials = this.dbService.query(
        'SELECT * FROM material_requisitions WHERE task_id = ? AND requisition_status = ?',
        [task.id, 'pending'],
      ) as any[];
      if (materials.length > 0) {
        return {
          allowed: false,
          code: ErrorCodes.MISSING_MATERIAL,
          message: `存在${materials.length}项未审批的农资领用，${this.getActionLabel(action)}前请先审批材料`,
        };
      }
    }

    if (rule.extraChecks?.checkFieldRecords) {
      const fieldCount = this.dbService.queryOne(
        'SELECT COUNT(*) as cnt FROM field_records WHERE task_id = ?',
        [task.id],
      ).cnt;
      if (fieldCount === 0) {
        return {
          allowed: false,
          code: ErrorCodes.MISSING_EVIDENCE,
          message: '该任务还没有田间记录，归档前请先录入田间作业记录',
        };
      }
    }

    return {
      allowed: true,
      targetStatus: rule.targetStatus,
      extraChecks: rule.extraChecks,
    };
  }

  private getRoleDeniedMessage(action: string, userRole: string): string {
    const roleLabel = userRole === USER_ROLES.FIELD_MANAGER ? '田间管理员'
      : userRole === USER_ROLES.AGRICULTURAL_TECHNICIAN ? '农技员' : '合作社主任';
    const actionLabel = this.getActionLabel(action);

    if (action === 'archive') {
      return `${roleLabel}不能归档，只有合作社主任可以归档任务`;
    }
    if (action === 'assign') {
      return `${roleLabel}不能分派任务，只有合作社主任可以分派`;
    }
    if (action === 'follow_up') {
      return `${roleLabel}不能回访，只有合作社主任或农技员可以回访`;
    }
    if (action === 'return_for_correction') {
      return `${roleLabel}不能退回补正，只有合作社主任或农技员可以退回`;
    }
    return `${roleLabel}没有权限执行${actionLabel}操作`;
  }

  private getActionLabel(action: string): string {
    const map: Record<string, string> = {
      assign: '分派',
      process: '开始处理',
      complete_processing: '完成处理',
      transfer: '转办',
      follow_up: '回访',
      archive: '归档',
      return_for_correction: '退回补正',
    };
    return map[action] || action;
  }

  async assign(id: string, assigneeId: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    const validation = this.validateAction('assign', task, version, userId, userRole);
    if (!validation.allowed) {
      throw new BusinessException(validation.code!, validation.message!, 400);
    }

    if (!assigneeId) {
      throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '请选择分派人');
    }

    const assignee = await this.authService.findById(assigneeId);
    if (!assignee) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '被分派人不存在', 404);
    }

    const beforeStatus = task.status;

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, assignee_id = ?, assignee_role = ?, version = version + 1, updated_at = datetime('now', 'localtime'), exception_reason = NULL WHERE id = ?`,
      [TASK_STATUS.ASSIGNED, assigneeId, assignee.role, id],
    );

    const assigneeRoleLabel = assignee.role === USER_ROLES.FIELD_MANAGER ? '田间管理员'
      : assignee.role === USER_ROLES.AGRICULTURAL_TECHNICIAN ? '农技员' : '主任';

    this.logAudit(id, userId, userRole, 'assign', beforeStatus, TASK_STATUS.ASSIGNED, null,
      `分派给 ${assignee.displayName}(${assigneeRoleLabel})`);
    this.addProcessingRecord(id, userId, userRole, 'assign', `分派给 ${assignee.displayName}`, 'success');

    return this.detail(id);
  }

  async process(id: string, action: string, evidence: string | undefined, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    const actualAction = action === 'process' ? 'process' : 'complete_processing';

    const validation = this.validateAction(actualAction, task, version, userId, userRole, evidence);
    if (!validation.allowed) {
      throw new BusinessException(validation.code!, validation.message!, 400);
    }

    const beforeStatus = task.status;
    const targetStatus = validation.targetStatus!;

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [targetStatus, id],
    );

    const actionLabel = actualAction === 'process' ? 'start_processing' : 'complete_processing';
    this.logAudit(id, userId, userRole, actionLabel, beforeStatus, targetStatus, null, evidence);
    this.addProcessingRecord(id, userId, userRole, actionLabel, evidence || '', 'success');

    return this.detail(id);
  }

  async transfer(id: string, targetAssigneeId: string, remarks: string | undefined, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    const validation = this.validateAction('transfer', task, version, userId, userRole);
    if (!validation.allowed) {
      throw new BusinessException(validation.code!, validation.message!, 400);
    }

    if (!targetAssigneeId) {
      throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '请选择转办目标人');
    }

    if (targetAssigneeId === task.assignee_id) {
      throw new BusinessException(ErrorCodes.STATUS_CONFLICT, '转办目标人不能与当前处理人相同');
    }

    const target = await this.authService.findById(targetAssigneeId);
    if (!target) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '转办目标人不存在', 404);
    }

    const beforeStatus = task.status;

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, assignee_id = ?, assignee_role = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.TRANSFERRED, targetAssigneeId, target.role, id],
    );

    const extra = remarks ? ` 备注: ${remarks}` : '';
    this.logAudit(id, userId, userRole, 'transfer', beforeStatus, TASK_STATUS.TRANSFERRED, null,
      `转办给 ${target.displayName}${extra}`);
    this.addProcessingRecord(id, userId, userRole, 'transfer', remarks || `转办给 ${target.displayName}`, 'success');

    return this.detail(id);
  }

  async followUp(id: string, result: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    const validation = this.validateAction('follow_up', task, version, userId, userRole, result);
    if (!validation.allowed) {
      throw new BusinessException(validation.code!, validation.message!, 400);
    }

    const beforeStatus = task.status;

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.FOLLOWED_UP, id],
    );

    this.logAudit(id, userId, userRole, 'follow_up', beforeStatus, TASK_STATUS.FOLLOWED_UP, null, result);
    this.addProcessingRecord(id, userId, userRole, 'follow_up', result, 'success');

    return this.detail(id);
  }

  async archive(id: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    const validation = this.validateAction('archive', task, version, userId, userRole);
    if (!validation.allowed) {
      throw new BusinessException(validation.code!, validation.message!, 400);
    }

    const beforeStatus = task.status;

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.ARCHIVED, id],
    );

    this.logAudit(id, userId, userRole, 'archive', beforeStatus, TASK_STATUS.ARCHIVED, null, '任务归档完成');
    this.addProcessingRecord(id, userId, userRole, 'archive', '归档完成', 'success');

    return this.detail(id);
  }

  async returnForCorrection(id: string, reason: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    const validation = this.validateAction('return_for_correction', task, version, userId, userRole, reason);
    if (!validation.allowed) {
      throw new BusinessException(validation.code!, validation.message!, 400);
    }

    const beforeStatus = task.status;

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, exception_reason = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.RETURNED_FOR_CORRECTION, reason, id],
    );

    this.logAudit(id, userId, userRole, 'return_for_correction', beforeStatus, TASK_STATUS.RETURNED_FOR_CORRECTION, reason, `退回原因: ${reason}`);
    this.addProcessingRecord(id, userId, userRole, 'return_for_correction', reason, 'failure');

    return this.detail(id);
  }

  async batchProcess(
    taskIds: string[],
    action: string,
    evidence: string | undefined,
    userId: string,
    userRole: string,
  ) {
    const results: BatchActionResult[] = [];

    for (const taskId of taskIds) {
      try {
        const task = this.dbService.queryOne(
          'SELECT * FROM planting_tasks WHERE id = ?',
          [taskId],
        ) as any;

        if (!task) {
          results.push({ taskId, taskNo: '', success: false, reason: '种植任务不存在' });
          continue;
        }

        const validation = this.validateAction(action, task, task.version, userId, userRole, evidence);
        if (!validation.allowed) {
          this.logAudit(taskId, userId, userRole, action, task.status, task.status, validation.message, `批量${this.getActionLabel(action)}失败: ${validation.message}`);
          this.addProcessingRecord(taskId, userId, userRole, action, validation.message || '', 'failure');
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: validation.message!,
          });
          continue;
        }

        const targetStatus = validation.targetStatus!;
        const beforeStatus = task.status;

        const updateResult = this.dbService.run(
          `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ? AND version = ?`,
          [targetStatus, taskId, task.version],
        );

        if (updateResult.changes === 0) {
          const failReason = '版本冲突，任务已被其他人修改，请刷新后重试';
          this.logAudit(taskId, userId, userRole, action, task.status, task.status, failReason, `批量${this.getActionLabel(action)}失败: ${failReason}`);
          this.addProcessingRecord(taskId, userId, userRole, action, failReason, 'failure');
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: failReason,
          });
          continue;
        }

        this.logAudit(taskId, userId, userRole, action, beforeStatus, targetStatus, null, evidence || `批量${this.getActionLabel(action)}`);
        this.addProcessingRecord(taskId, userId, userRole, action, evidence || '', 'success');

        results.push({ taskId, taskNo: task.task_no, success: true });
      } catch (e: any) {
        results.push({
          taskId,
          taskNo: '',
          success: false,
          reason: e.message || '处理失败',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      total: results.length,
      successCount,
      failCount,
      results,
    };
  }

  async executeBatchAction(
    taskId: string,
    action: string,
    evidence: string | undefined,
    userId: string,
    userRole: string,
  ): { success: boolean; reason?: string } {
    try {
      const task = this.dbService.queryOne(
        'SELECT * FROM planting_tasks WHERE id = ?',
        [taskId],
      ) as any;

      if (!task) {
        return { success: false, reason: '种植任务不存在' };
      }

      const validation = this.validateAction(action, task, task.version, userId, userRole, evidence);
      if (!validation.allowed) {
        this.logAudit(taskId, userId, userRole, action, task.status, task.status, validation.message, `${this.getActionLabel(action)}失败: ${validation.message}`);
        this.addProcessingRecord(taskId, userId, userRole, action, validation.message || '', 'failure');
        return { success: false, reason: validation.message! };
      }

      const targetStatus = validation.targetStatus!;
      const beforeStatus = task.status;

      const updateResult = this.dbService.run(
        `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ? AND version = ?`,
        [targetStatus, taskId, task.version],
      );

      if (updateResult.changes === 0) {
        const failReason = '版本冲突，任务已被其他人修改';
        this.logAudit(taskId, userId, userRole, action, task.status, task.status, failReason, `${this.getActionLabel(action)}失败: ${failReason}`);
        this.addProcessingRecord(taskId, userId, userRole, action, failReason, 'failure');
        return { success: false, reason: failReason };
      }

      this.logAudit(taskId, userId, userRole, action, beforeStatus, targetStatus, null, evidence || this.getActionLabel(action));
      this.addProcessingRecord(taskId, userId, userRole, action, evidence || '', 'success');

      return { success: true };
    } catch (e: any) {
      return { success: false, reason: e.message || '处理失败' };
    }
  }

  async auditLogs(taskId: string) {
    return this.dbService.query(
      `SELECT a.*, u.display_name as operator_name FROM audit_logs a LEFT JOIN users u ON a.operator_id = u.id WHERE a.task_id = ? ORDER BY a.created_at DESC`,
      [taskId],
    );
  }

  async processingRecords(taskId: string) {
    return this.dbService.query(
      `SELECT p.*, u.display_name as processor_name FROM processing_records p LEFT JOIN users u ON p.processor_id = u.id WHERE p.task_id = ? ORDER BY p.created_at DESC`,
      [taskId],
    );
  }

  private getTaskOrThrow(id: string) {
    const task = this.dbService.queryOne('SELECT * FROM planting_tasks WHERE id = ?', [id]) as any;
    if (!task) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '种植任务不存在', 404);
    }
    return task;
  }

  private addProcessingRecord(
    taskId: string,
    processorId: string,
    processorRole: string,
    action: string,
    evidence: string,
    result: 'success' | 'failure',
  ) {
    this.dbService.run(
      `INSERT INTO processing_records (id, task_id, processor_id, processor_role, action, result, evidence)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, processorId, processorRole, action, result, evidence || null],
    );
  }

  private logAudit(
    taskId: string,
    operatorId: string,
    operatorRole: string,
    action: string,
    beforeStatus: string | null,
    afterStatus: string,
    failReason: string | null,
    remarks?: string,
  ) {
    this.dbService.run(
      `INSERT INTO audit_logs (id, task_id, operator_id, operator_role, action, before_status, after_status, fail_reason, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, operatorId, operatorRole, action, beforeStatus, afterStatus, failReason, remarks || null],
    );
  }
}
