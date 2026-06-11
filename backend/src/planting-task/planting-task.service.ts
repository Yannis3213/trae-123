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

  async assign(id: string, assigneeId: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);

    if (userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      throw new BusinessException(ErrorCodes.UNAUTHORIZED_ROLE, '只有合作社主任可以分派种植任务', 403);
    }

    const allowedFrom = [TASK_STATUS.PENDING_ASSIGN, TASK_STATUS.RETURNED_FOR_CORRECTION, TASK_STATUS.ASSIGNED];
    if (!allowedFrom.includes(task.status)) {
      throw new BusinessException(
        ErrorCodes.INVALID_STATUS_TRANSITION,
        `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"不能执行分派`,
        400,
      );
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

    this.logAudit(id, userId, userRole, 'assign', beforeStatus, TASK_STATUS.ASSIGNED, null,
      `分派给 ${assignee.displayName}(${assignee.role === USER_ROLES.FIELD_MANAGER ? '田间管理员' : assignee.role === USER_ROLES.AGRICULTURAL_TECHNICIAN ? '农技员' : '主任'})`);

    return this.detail(id);
  }

  async process(id: string, action: string, evidence: string | undefined, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);

    if (task.assignee_id !== userId && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      throw new BusinessException(ErrorCodes.FORBIDDEN_ACTION, '只有当前处理人或合作社主任可以处理该任务', 403);
    }

    if (task.status === TASK_STATUS.ASSIGNED) {
      if (userRole === USER_ROLES.FIELD_MANAGER && task.assignee_role !== USER_ROLES.FIELD_MANAGER) {
        throw new BusinessException(ErrorCodes.UNAUTHORIZED_ROLE, '田间管理员不能跳过处理环节，只能处理分派给自己的任务', 403);
      }
      if (!evidence || evidence.trim().length === 0) {
        throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '开始处理需要提供处理依据（如农资清单、作业计划等）');
      }
      this.dbService.run(
        `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
        [TASK_STATUS.PROCESSING, id],
      );
      this.logAudit(id, userId, userRole, 'process', task.status, TASK_STATUS.PROCESSING, null, evidence);
      this.addProcessingRecord(id, userId, userRole, 'start_processing', evidence, 'success');
    } else if (task.status === TASK_STATUS.PROCESSING) {
      if (!evidence || evidence.trim().length === 0) {
        throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '完成处理需要提交处理结果（如田间记录照片、产量数据等）');
      }

      const materials = this.dbService.query(
        'SELECT * FROM material_requisitions WHERE task_id = ? AND requisition_status = ?',
        [id, 'pending'],
      ) as any[];
      if (materials.length > 0) {
        throw new BusinessException(ErrorCodes.MISSING_MATERIAL, `还有${materials.length}项农资领用未审批，完成处理前请先审批材料`, 400, {
          pendingMaterials: materials.length,
        });
      }

      this.dbService.run(
        `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
        [TASK_STATUS.TRANSFERRED, id],
      );
      this.logAudit(id, userId, userRole, 'complete_processing', task.status, TASK_STATUS.TRANSFERRED, null, evidence);
      this.addProcessingRecord(id, userId, userRole, 'complete_processing', evidence, 'success');
    } else {
      throw new BusinessException(ErrorCodes.INVALID_STATUS_TRANSITION,
        `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"无法进行此操作，只能在已分派或处理中状态执行`, 400);
    }

    return this.detail(id);
  }

  async transfer(id: string, targetAssigneeId: string, remarks: string | undefined, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);

    if (task.assignee_id !== userId && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      throw new BusinessException(ErrorCodes.FORBIDDEN_ACTION, '只有当前处理人或合作社主任可以转办任务', 403);
    }

    const allowedFrom = [TASK_STATUS.ASSIGNED, TASK_STATUS.PROCESSING, TASK_STATUS.TRANSFERRED];
    if (!allowedFrom.includes(task.status)) {
      throw new BusinessException(
        ErrorCodes.INVALID_STATUS_TRANSITION,
        `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"不能执行转办`,
        400,
      );
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
    this.checkVersion(task, version);

    if (task.status !== TASK_STATUS.TRANSFERRED) {
      throw new BusinessException(ErrorCodes.INVALID_STATUS_TRANSITION,
        `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"不能回访，只能在已转办状态执行`, 400);
    }

    if (!result || result.trim().length === 0) {
      throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '回访必须填写回访结果（如客户确认、验收意见等）');
    }

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.FOLLOWED_UP, id],
    );

    this.logAudit(id, userId, userRole, 'follow_up', task.status, TASK_STATUS.FOLLOWED_UP, null, result);
    this.addProcessingRecord(id, userId, userRole, 'follow_up', result, 'success');

    return this.detail(id);
  }

  async archive(id: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);

    if (userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      throw new BusinessException(ErrorCodes.UNAUTHORIZED_ROLE, '农技员不能替合作社主任归档，田间管理员也不能归档，请联系主任操作', 403);
    }

    if (task.status !== TASK_STATUS.FOLLOWED_UP) {
      throw new BusinessException(ErrorCodes.INVALID_STATUS_TRANSITION,
        `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"不能归档，必须先完成回访`, 400);
    }

    const materials = this.dbService.query(
      'SELECT * FROM material_requisitions WHERE task_id = ? AND requisition_status = ?',
      [id, 'pending'],
    ) as any[];
    if (materials.length > 0) {
      throw new BusinessException(ErrorCodes.MISSING_MATERIAL,
        `存在${materials.length}项未审批的农资领用，无法归档，请先审批材料`, 400, {
        pendingMaterials: materials.length,
      });
    }

    const fieldCount = this.dbService.queryOne(
      'SELECT COUNT(*) as cnt FROM field_records WHERE task_id = ?',
      [id],
    ).cnt;
    if (fieldCount === 0) {
      throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '该任务还没有田间记录，归档前请先录入田间作业记录');
    }

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.ARCHIVED, id],
    );

    this.logAudit(id, userId, userRole, 'archive', task.status, TASK_STATUS.ARCHIVED, null, '任务归档完成');
    this.addProcessingRecord(id, userId, userRole, 'archive', '归档完成', 'success');

    return this.detail(id);
  }

  async returnForCorrection(id: string, reason: string, version: number, userId: string, userRole: string) {
    const task = this.getTaskOrThrow(id);
    this.checkVersion(task, version);

    if (task.status === TASK_STATUS.ARCHIVED) {
      throw new BusinessException(ErrorCodes.INVALID_STATUS_TRANSITION, '已归档任务不能退回补正', 400);
    }
    if (task.status === TASK_STATUS.RETURNED_FOR_CORRECTION) {
      throw new BusinessException(ErrorCodes.STATUS_CONFLICT, '任务已处于退回补正状态，不能重复退回');
    }

    if (!reason || reason.trim().length === 0) {
      throw new BusinessException(ErrorCodes.MISSING_EVIDENCE, '退回补正必须填写退回原因（材料缺失/时限问题/状态冲突等具体说明）');
    }

    this.dbService.run(
      `UPDATE planting_tasks SET status = ?, exception_reason = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ?`,
      [TASK_STATUS.RETURNED_FOR_CORRECTION, reason, id],
    );

    this.logAudit(id, userId, userRole, 'return_for_correction', task.status, TASK_STATUS.RETURNED_FOR_CORRECTION, reason, `退回原因: ${reason}`);
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
          'SELECT id, task_no, status, version, assignee_id, assignee_role, exception_reason FROM planting_tasks WHERE id = ?',
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
            reason: `状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"不能执行${this.getActionLabel(action)}操作`,
          });
          continue;
        }

        const roleCheck = this.checkRolePermissionSilent(userRole, targetStatus, action, task, userId);
        if (!roleCheck.allowed) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: roleCheck.reason!,
          });
          continue;
        }

        if (action === 'process' || action === 'follow_up') {
          if (!evidence || evidence.trim().length === 0) {
            results.push({
              taskId,
              taskNo: task.task_no,
              success: false,
              reason: this.getActionLabel(action) + '需要提交处理依据/结果',
            });
            continue;
          }
        }

        if (action === 'archive') {
          const materials = this.dbService.query(
            'SELECT * FROM material_requisitions WHERE task_id = ? AND requisition_status = ?',
            [taskId, 'pending'],
          ) as any[];
          if (materials.length > 0) {
            results.push({
              taskId,
              taskNo: task.task_no,
              success: false,
              reason: `存在${materials.length}项未审批农资领用，无法归档`,
            });
            continue;
          }
        }

        const updateResult = this.dbService.run(
          `UPDATE planting_tasks SET status = ?, version = version + 1, updated_at = datetime('now', 'localtime') WHERE id = ? AND version = ?`,
          [targetStatus, taskId, task.version],
        );

        if (updateResult.changes === 0) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: '版本冲突，任务已被其他人修改，请刷新后重试',
          });
          continue;
        }

        this.logAudit(taskId, userId, userRole, action, task.status, targetStatus, null, evidence || `批量${this.getActionLabel(action)}`);
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
        `版本冲突：任务已被修改（当前版本v${task.version}，提交版本v${clientVersion}），请刷新后重试`,
        409,
        { currentVersion: task.version, clientVersion },
      );
    }
  }

  private getActionLabel(action: string): string {
    const map: Record<string, string> = {
      assign: '分派',
      process: '处理',
      complete_processing: '完成处理',
      transfer: '转办',
      follow_up: '回访',
      archive: '归档',
      return_for_correction: '退回补正',
    };
    return map[action] || action;
  }

  private getTargetStatusForAction(action: string, currentStatus: string): string | null {
    const transitions: Record<string, Record<string, string>> = {
      assign: {
        [TASK_STATUS.PENDING_ASSIGN]: TASK_STATUS.ASSIGNED,
        [TASK_STATUS.RETURNED_FOR_CORRECTION]: TASK_STATUS.ASSIGNED,
        [TASK_STATUS.ASSIGNED]: TASK_STATUS.ASSIGNED,
      },
      process: {
        [TASK_STATUS.ASSIGNED]: TASK_STATUS.PROCESSING,
        [TASK_STATUS.PROCESSING]: TASK_STATUS.TRANSFERRED,
      },
      transfer: {
        [TASK_STATUS.ASSIGNED]: TASK_STATUS.TRANSFERRED,
        [TASK_STATUS.PROCESSING]: TASK_STATUS.TRANSFERRED,
        [TASK_STATUS.TRANSFERRED]: TASK_STATUS.TRANSFERRED,
      },
      follow_up: {
        [TASK_STATUS.TRANSFERRED]: TASK_STATUS.FOLLOWED_UP,
      },
      archive: {
        [TASK_STATUS.FOLLOWED_UP]: TASK_STATUS.ARCHIVED,
      },
      return_for_correction: {
        [TASK_STATUS.PENDING_ASSIGN]: TASK_STATUS.RETURNED_FOR_CORRECTION,
        [TASK_STATUS.ASSIGNED]: TASK_STATUS.RETURNED_FOR_CORRECTION,
        [TASK_STATUS.PROCESSING]: TASK_STATUS.RETURNED_FOR_CORRECTION,
        [TASK_STATUS.TRANSFERRED]: TASK_STATUS.RETURNED_FOR_CORRECTION,
        [TASK_STATUS.FOLLOWED_UP]: TASK_STATUS.RETURNED_FOR_CORRECTION,
      },
    };

    return transitions[action]?.[currentStatus] || null;
  }

  private checkRolePermissionSilent(
    userRole: string,
    targetStatus: string,
    action: string,
    task: any,
    userId: string,
  ): { allowed: boolean; reason?: string } {
    if (targetStatus === TASK_STATUS.ARCHIVED && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      return { allowed: false, reason: '农技员不能替合作社主任归档' };
    }

    if (action === 'assign' && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
      return { allowed: false, reason: '只有合作社主任可以分派任务' };
    }

    if (userRole === USER_ROLES.FIELD_MANAGER) {
      const skippedActions = ['assign', 'archive', 'follow_up'];
      if (skippedActions.includes(action)) {
        return { allowed: false, reason: '田间管理员不能跳过处理环节分派/回访/归档' };
      }
      if (action === 'transfer' && targetStatus === TASK_STATUS.TRANSFERRED && task.assignee_id !== userId) {
        return { allowed: false, reason: '田间管理员只能转办自己处理中的任务' };
      }
    }

    if (action === 'process' || action === 'transfer') {
      if (task.assignee_id && task.assignee_id !== userId && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
        return { allowed: false, reason: '只有当前处理人或合作社主任可以操作此任务' };
      }
    }

    return { allowed: true };
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
