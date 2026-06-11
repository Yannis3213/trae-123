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

@Injectable()
export class PlantingTaskService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly authService: AuthService,
  ) {}

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
      'SELECT * FROM material_requisitions WHERE task_id = ? ORDER BY applied_at DESC',
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
      'SELECT * FROM attachments WHERE task_id = ? ORDER BY uploaded_at DESC',
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
      throw new BusinessException(ErrorCodes.UNAUTHORIZED_ROLE, '只有合作社主任或农技员可以创建种植任务', 403);
    }

    const id = uuidv4();
    const taskNo = `ZZ-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(this.dbService.query('SELECT COUNT(*) as cnt FROM planting_tasks')[0].cnt + 1).padStart(4, '0')}`;

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

    this.logAudit(id, userId, userRole, 'create', null, TASK_STATUS.PENDING_ASSIGN, null);

    return this.detail(id);
  }

  async assign(id: string, assigneeId: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);
    this.checkStatusTransition(task.status, TASK_STATUS.ASSIGNED);
    this.checkRolePermission(userRole, TASK_STATUS.ASSIGNED, task, userId);

    const assignee = await this.authService.findById(assigneeId);
    if (!assignee) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '被分派人不存在', 404);
    }

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, assignee_id = ?, assignee_role = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.ASSIGNED, assigneeId, assignee.role, id],
    );

    this.logAudit(id, userId, userRole, 'assign', task.status, TASK_STATUS.ASSIGNED, null);
    return this.detail(id);
  }

  async process(id: string, action: string, evidence: string | undefined, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);

    if (task.assignee_id !== userId) {
      throw new BusinessException(ErrorCodes.FORBIDDEN_ACTION, '只有当前处理人可以处理该任务', 403);
    }

    this.checkRolePermission(userRole, TASK_STATUS.PROCESSING, task, userId);

    if (task.status === TASK_STATUS.ASSIGNED) {
      this.checkStatusTransition(task.status, TASK_STATUS.PROCESSING);
      if (!evidence) {
        throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '开始处理需要提供处理依据');
      }
      this.dbService.run(
        `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
        [TASK_STATUS.PROCESSING, id],
      );
      this.logAudit(id, userId, userRole, 'process', task.status, TASK_STATUS.PROCESSING, null);
    } else if (task.status === TASK_STATUS.PROCESSING) {
      if (!evidence) {
        throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '处理完成需要提交处理结果');
      }
      this.dbService.run(
        `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
        [TASK_STATUS.TRANSFERRED, id],
      );
      this.logAudit(id, userId, userRole, 'complete_processing', task.status, TASK_STATUS.TRANSFERRED, null);
    } else {
      throw new BusinessException(ErrorCodes.INVALID_STATUS_TRANSITION, `当前状态"${TASK_STATUS_LABELS[task.status]}"无法进行此操作`);
    }

    this.dbService.run(
      `INSERT INTO processing_records (id, task_id, processor_id, processor_role, action, result, evidence) VALUES (?, ?, ?, ?, ?, 'success', ?)`,
      [uuidv4(), id, userId, userRole, action, evidence || null],
    );

    return this.detail(id);
  }

  async transfer(id: string, targetAssigneeId: string, remarks: string | undefined, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);
    this.checkStatusTransition(task.status, TASK_STATUS.TRANSFERRED);
    this.checkRolePermission(userRole, TASK_STATUS.TRANSFERRED, task, userId);

    const target = await this.authService.findById(targetAssigneeId);
    if (!target) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '转办目标人不存在', 404);
    }

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, assignee_id = ?, assignee_role = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.TRANSFERRED, targetAssigneeId, target.role, id],
    );

    this.logAudit(id, userId, userRole, 'transfer', task.status, TASK_STATUS.TRANSFERRED, null);
    return this.detail(id);
  }

  async followUp(id: string, result: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);
    this.checkStatusTransition(task.status, TASK_STATUS.FOLLOWED_UP);
    this.checkRolePermission(userRole, TASK_STATUS.FOLLOWED_UP, task, userId);

    if (!result) {
      throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '回访需要提交回访结果');
    }

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.FOLLOWED_UP, id],
    );

    this.logAudit(id, userId, userRole, 'follow_up', task.status, TASK_STATUS.FOLLOWED_UP, null);
    return this.detail(id);
  }

  async archive(id: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);
    this.checkStatusTransition(task.status, TASK_STATUS.ARCHIVED);

    if (userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      throw new BusinessException(ErrorCodes.UNAUTHORIZED_ROLE, '只有合作社主任可以归档种植任务', 403);
    }

    const materials = this.dbService.query(
      'SELECT * FROM material_requisitions WHERE task_id = ? AND requisition_status = ?',
      [id, 'pending'],
    ) as any[];
    if (materials.length > 0) {
      throw new BusinessException(ErrorCodes.MISSING_MATERIAL, `存在${materials.length}项未审批的农资领用，无法归档`, 400, {
        pendingMaterials: materials.length,
      });
    }

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.ARCHIVED, id],
    );

    this.logAudit(id, userId, userRole, 'archive', task.status, TASK_STATUS.ARCHIVED, null);
    return this.detail(id);
  }

  async returnForCorrection(id: string, reason: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);
    this.checkStatusTransition(task.status, TASK_STATUS.RETURNED_FOR_CORRECTION);

    if (!reason) {
      throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '退回补正必须填写退回原因');
    }

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, exception_reason = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.RETURNED_FOR_CORRECTION, reason, id],
    );

    this.logAudit(id, userId, userRole, 'return_for_correction', task.status, TASK_STATUS.RETURNED_FOR_CORRECTION, reason);
    return this.detail(id);
  }

  async batchProcess(
    taskIds: string[],
    action: string,
    evidence: string | undefined,
    userId: string,
    userRole: string,
  ) {
    const results: Array<{
      taskId: string;
      taskNo: string;
      success: boolean;
      reason?: string;
      data?: any;
    }> = [];

    for (const taskId of taskIds) {
      try {
        const task = this.dbService.queryOne(
          'SELECT id, task_no, status, version, assignee_id FROM planting_tasks WHERE id = ?',
          [taskId],
        ) as any;

        if (!task) {
          results.push({ taskId, taskNo: '', success: false, reason: '种植任务不存在' });
          continue;
        }

        const targetStatus = this.getTargetStatusForAction(action, task.status);
        if (!targetStatus) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"无法执行"${action}"操作`,
          });
          continue;
        }

        const roleCheck = this.checkRolePermissionSilent(userRole, targetStatus, task, userId);
        if (!roleCheck.allowed) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: roleCheck.reason!,
          });
          continue;
        }

        if (action === 'archive' && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: '只有合作社主任可以归档',
          });
          continue;
        }

        if (action === 'process' && !evidence) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: '缺少处理依据/证据',
          });
          continue;
        }

        this.dbService.run(
          `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ? AND version = ?`,
          [targetStatus, taskId, task.version],
        );

        const updated = this.dbService.queryOne('SELECT version FROM planting_tasks WHERE id = ?', [taskId]) as any;
        if (updated && updated.version === task.version) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: '版本冲突，任务已被其他人修改',
          });
          continue;
        }

        this.logAudit(taskId, userId, userRole, action, task.status, targetStatus, null);

        this.dbService.run(
          `INSERT INTO processing_records (id, task_id, processor_id, processor_role, action, result, evidence) VALUES (?, ?, ?, ?, ?, 'success', ?)`,
          [uuidv4(), taskId, userId, userRole, action, evidence || null],
        );

        results.push({ taskId, taskNo: task.task_no, success: true });
      } catch (e: any) {
        results.push({ taskId, taskNo: '', success: false, reason: e.message || '处理失败' });
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

  private checkVersion(task: any, clientVersion: number) {
    if (task.version !== clientVersion) {
      throw new BusinessException(
        ErrorCodes.VERSION_CONFLICT,
        `版本冲突：任务已被修改（当前版本${task.version}，提交版本${clientVersion}）`,
        409,
        { currentVersion: task.version, clientVersion },
      );
    }
  }

  private checkStatusTransition(currentStatus: string, targetStatus: string) {
    const allowed = STATUS_FLOW[currentStatus as keyof typeof STATUS_FLOW];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BusinessException(
        ErrorCodes.INVALID_STATUS_TRANSITION,
        `不允许从"${TASK_STATUS_LABELS[currentStatus as keyof typeof TASK_STATUS_LABELS]}"转移到"${TASK_STATUS_LABELS[targetStatus as keyof typeof TASK_STATUS_LABELS]}"`,
        400,
        { currentStatus, targetStatus },
      );
    }
  }

  private checkRolePermission(userRole: string, targetStatus: string, task: any, userId: string) {
    const result = this.checkRolePermissionSilent(userRole, targetStatus, task, userId);
    if (!result.allowed) {
      throw new BusinessException(ErrorCodes.FORBIDDEN_ACTION, result.reason!, 403);
    }
  }

  private checkRolePermissionSilent(
    userRole: string,
    targetStatus: string,
    task: any,
    userId: string,
  ): { allowed: boolean; reason?: string } {
    if (targetStatus === TASK_STATUS.ARCHIVED && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      return { allowed: false, reason: '农技员不能替合作社主任归档' };
    }

    if (userRole === USER_ROLES.FIELD_MANAGER) {
      if (
        targetStatus === TASK_STATUS.ASSIGNED ||
        targetStatus === TASK_STATUS.TRANSFERRED ||
        targetStatus === TASK_STATUS.FOLLOWED_UP ||
        targetStatus === TASK_STATUS.ARCHIVED
      ) {
        return { allowed: false, reason: '田间管理员不能跳过处理环节' };
      }
    }

    if (task.assignee_id && task.assignee_id !== userId && targetStatus !== TASK_STATUS.RETURNED_FOR_CORRECTION) {
      if (userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
        return { allowed: false, reason: '只有当前处理人或合作社主任可以操作此任务' };
      }
    }

    return { allowed: true };
  }

  private getTargetStatusForAction(action: string, currentStatus: string): string | null {
    const actionMap: Record<string, Record<string, string>> = {
      assign: { [TASK_STATUS.PENDING_ASSIGN]: TASK_STATUS.ASSIGNED },
      process: { [TASK_STATUS.ASSIGNED]: TASK_STATUS.PROCESSING },
      complete_processing: { [TASK_STATUS.PROCESSING]: TASK_STATUS.TRANSFERRED },
      transfer: { [TASK_STATUS.PROCESSING]: TASK_STATUS.TRANSFERRED },
      follow_up: { [TASK_STATUS.TRANSFERRED]: TASK_STATUS.FOLLOWED_UP },
      archive: { [TASK_STATUS.FOLLOWED_UP]: TASK_STATUS.ARCHIVED },
    };

    if (action === 'process') {
      if (currentStatus === TASK_STATUS.ASSIGNED) return TASK_STATUS.PROCESSING;
      if (currentStatus === TASK_STATUS.PROCESSING) return TASK_STATUS.TRANSFERRED;
      return null;
    }

    return actionMap[action]?.[currentStatus] || null;
  }

  private logAudit(
    taskId: string,
    operatorId: string,
    operatorRole: string,
    action: string,
    beforeStatus: string | null,
    afterStatus: string,
    failReason: string | null,
  ) {
    this.dbService.run(
      `INSERT INTO audit_logs (id, task_id, operator_id, operator_role, action, before_status, after_status, fail_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, operatorId, operatorRole, action, beforeStatus, afterStatus, failReason],
    );
  }
}
