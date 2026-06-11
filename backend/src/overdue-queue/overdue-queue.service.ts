import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import {
  TASK_STATUS,
  TASK_STATUS_LABELS,
  OVERDUE_STATUS,
  OVERDUE_STATUS_LABELS,
  USER_ROLES,
} from '../common/constants';
import { PlantingTaskService } from '../planting-task/planting-task.service';
import { v4 as uuidv4 } from 'uuid';

interface OverdueTaskItem {
  id: string;
  taskNo: string;
  title: string;
  status: string;
  statusLabel: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeRole?: string;
  deadline: string;
  overdueStatus: string;
  overdueStatusLabel: string;
  daysRemaining: number;
  version: number;
  nextAction?: string;
  nextActionLabel?: string;
  canAdvance: boolean;
  blockReason?: string;
}

interface OverdueGroupResult {
  count: number;
  items: OverdueTaskItem[];
}

interface OverdueQueueResult {
  normal: OverdueGroupResult;
  nearExpiry: OverdueGroupResult;
  overdue: OverdueGroupResult;
  byAssignee: Array<{
    assigneeId: string;
    assigneeName: string;
    normalCount: number;
    nearExpiryCount: number;
    overdueCount: number;
  }>;
  totalCount: number;
}

interface BatchAdvanceResult {
  total: number;
  successCount: number;
  failCount: number;
  results: Array<{
    taskId: string;
    taskNo: string;
    success: boolean;
    reason?: string;
    beforeStatus?: string;
    afterStatus?: string;
    action?: string;
  }>;
}

@Injectable()
export class OverdueQueueService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly taskService: PlantingTaskService,
  ) {}

  private readonly ADVANCE_FLOW: Record<string, { action: string; label: string; requiresAssignee: boolean }> = {
    [TASK_STATUS.PENDING_ASSIGN]: { action: 'assign', label: '分派任务', requiresAssignee: false },
    [TASK_STATUS.RETURNED_FOR_CORRECTION]: { action: 'assign', label: '重新分派', requiresAssignee: false },
    [TASK_STATUS.ASSIGNED]: { action: 'process', label: '开始处理', requiresAssignee: true },
    [TASK_STATUS.PROCESSING]: { action: 'complete_processing', label: '完成处理', requiresAssignee: true },
    [TASK_STATUS.TRANSFERRED]: { action: 'follow_up', label: '回访', requiresAssignee: false },
    [TASK_STATUS.FOLLOWED_UP]: { action: 'archive', label: '归档', requiresAssignee: false },
  };

  async list(userId?: string, userRole?: string): Promise<OverdueQueueResult> {
    const tasks = this.dbService.query(
      `SELECT t.*, u.display_name as assignee_name
       FROM planting_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.status != ? AND t.deadline IS NOT NULL
       ORDER BY t.deadline ASC`,
      [TASK_STATUS.ARCHIVED],
    ) as any[];

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const items: OverdueTaskItem[] = tasks.map((t) => {
      const deadlineDate = new Date(t.deadline);
      let overdueStatus = OVERDUE_STATUS.NORMAL;
      if (deadlineDate < now) {
        overdueStatus = OVERDUE_STATUS.OVERDUE;
      } else if (deadlineDate <= threeDaysLater) {
        overdueStatus = OVERDUE_STATUS.NEAR_EXPIRY;
      }
      const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const flow = this.ADVANCE_FLOW[t.status];
      let nextAction: string | undefined;
      let nextActionLabel: string | undefined;
      let canAdvance = false;
      let blockReason: string | undefined;

      if (flow) {
        nextAction = flow.action;
        nextActionLabel = flow.label;

        if (flow.requiresAssignee && !t.assignee_id) {
          canAdvance = false;
          blockReason = '当前状态没有分派处理人，无法自动推进';
        } else if (t.status === TASK_STATUS.PENDING_ASSIGN || t.status === TASK_STATUS.RETURNED_FOR_CORRECTION) {
          canAdvance = userRole === USER_ROLES.COOPERATIVE_DIRECTOR;
          blockReason = canAdvance ? undefined : '只有合作社主任可以分派任务';
        } else if (t.status === TASK_STATUS.ASSIGNED || t.status === TASK_STATUS.PROCESSING) {
          canAdvance = userRole === USER_ROLES.COOPERATIVE_DIRECTOR || t.assignee_id === userId;
          blockReason = canAdvance ? undefined : '只有当前处理人或合作社主任可以推进';
        } else if (t.status === TASK_STATUS.TRANSFERRED) {
          canAdvance = userRole === USER_ROLES.COOPERATIVE_DIRECTOR || userRole === USER_ROLES.AGRICULTURAL_TECHNICIAN;
          blockReason = canAdvance ? undefined : '只有合作社主任或农技员可以回访';
        } else if (t.status === TASK_STATUS.FOLLOWED_UP) {
          canAdvance = userRole === USER_ROLES.COOPERATIVE_DIRECTOR;
          blockReason = canAdvance ? undefined : '只有合作社主任可以归档';
        } else {
          canAdvance = false;
          blockReason = '当前状态无法推进';
        }
      } else {
        blockReason = '当前状态无法推进';
      }

      return {
        id: t.id,
        taskNo: t.task_no,
        title: t.title,
        status: t.status,
        statusLabel: TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] || t.status,
        assigneeId: t.assignee_id,
        assigneeName: t.assignee_name,
        assigneeRole: t.assignee_role,
        deadline: t.deadline,
        overdueStatus,
        overdueStatusLabel: OVERDUE_STATUS_LABELS[overdueStatus as keyof typeof OVERDUE_STATUS_LABELS],
        daysRemaining,
        version: t.version,
        nextAction,
        nextActionLabel,
        canAdvance,
        blockReason,
      };
    });

    const normal = items.filter((i) => i.overdueStatus === OVERDUE_STATUS.NORMAL);
    const nearExpiry = items.filter((i) => i.overdueStatus === OVERDUE_STATUS.NEAR_EXPIRY);
    const overdue = items.filter((i) => i.overdueStatus === OVERDUE_STATUS.OVERDUE);

    const assigneeMap = new Map<string, {
      assigneeId: string;
      assigneeName: string;
      normalCount: number;
      nearExpiryCount: number;
      overdueCount: number;
    }>();

    for (const item of items) {
      const key = item.assigneeId || 'unassigned';
      const name = item.assigneeName || '待分派';
      if (!assigneeMap.has(key)) {
        assigneeMap.set(key, {
          assigneeId: key,
          assigneeName: name,
          normalCount: 0,
          nearExpiryCount: 0,
          overdueCount: 0,
        });
      }
      const entry = assigneeMap.get(key)!;
      if (item.overdueStatus === OVERDUE_STATUS.NORMAL) entry.normalCount++;
      else if (item.overdueStatus === OVERDUE_STATUS.NEAR_EXPIRY) entry.nearExpiryCount++;
      else if (item.overdueStatus === OVERDUE_STATUS.OVERDUE) entry.overdueCount++;
    }

    const byAssignee = Array.from(assigneeMap.values()).sort((a, b) => {
      const aTotal = a.overdueCount * 100 + a.nearExpiryCount * 10 + a.normalCount;
      const bTotal = b.overdueCount * 100 + b.nearExpiryCount * 10 + b.normalCount;
      return bTotal - aTotal;
    });

    return {
      normal: { count: normal.length, items: normal },
      nearExpiry: { count: nearExpiry.length, items: nearExpiry },
      overdue: { count: overdue.length, items: overdue },
      byAssignee,
      totalCount: items.length,
    };
  }

  async batchAdvance(
    taskIds: string[],
    evidence: string | undefined,
    userId: string,
    userRole: string,
  ): Promise<BatchAdvanceResult> {
    const results: BatchAdvanceResult['results'] = [];
    const now = new Date();

    for (const taskId of taskIds) {
      try {
        const task = this.dbService.queryOne(
          'SELECT id, task_no, status, version, deadline, assignee_id, assignee_role FROM planting_tasks WHERE id = ?',
          [taskId],
        ) as any;

        if (!task) {
          results.push({ taskId, taskNo: '', success: false, reason: '种植任务不存在' });
          continue;
        }

        const deadlineDate = new Date(task.deadline);
        const isOverdue = deadlineDate < now;

        const flow = this.ADVANCE_FLOW[task.status];
        if (!flow) {
          const failReason = `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"无法自动推进`;
          this.writeFailureRecords(taskId, userId, userRole, 'overdue_advance', task.status, failReason);
          results.push({ taskId, taskNo: task.task_no, success: false, reason: failReason, beforeStatus: task.status });
          continue;
        }

        if (flow.requiresAssignee && !task.assignee_id) {
          const failReason = `待分派任务没有目标处理人，无法${flow.label}，请先手动分派`;
          this.writeFailureRecords(taskId, userId, userRole, 'overdue_advance', task.status, failReason);
          results.push({ taskId, taskNo: task.task_no, success: false, reason: failReason, beforeStatus: task.status });
          continue;
        }

        if (task.status === TASK_STATUS.PENDING_ASSIGN || task.status === TASK_STATUS.RETURNED_FOR_CORRECTION) {
          const failReason = `待分派/退回补正任务需要手动选择分派人，无法自动推进`;
          this.writeFailureRecords(taskId, userId, userRole, 'overdue_advance', task.status, failReason);
          results.push({ taskId, taskNo: task.task_no, success: false, reason: failReason, beforeStatus: task.status });
          continue;
        }

        const executeResult = await this.taskService.executeBatchAction(
          taskId,
          flow.action,
          evidence || `逾期批量推进：${flow.label}`,
          userId,
          userRole,
        );

        const updatedTask = this.dbService.queryOne(
          'SELECT status FROM planting_tasks WHERE id = ?',
          [taskId],
        ) as any;

        results.push({
          taskId,
          taskNo: task.task_no,
          success: executeResult.success,
          reason: executeResult.reason,
          beforeStatus: task.status,
          afterStatus: executeResult.success ? updatedTask?.status : task.status,
          action: flow.action,
        });
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

  private writeFailureRecords(
    taskId: string,
    userId: string,
    userRole: string,
    action: string,
    beforeStatus: string,
    failReason: string,
  ) {
    this.dbService.run(
      `INSERT INTO audit_logs (id, task_id, operator_id, operator_role, action, before_status, after_status, fail_reason, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, userId, userRole, action, beforeStatus, beforeStatus, failReason, `逾期批量推进失败: ${failReason}`],
    );
    this.dbService.run(
      `INSERT INTO processing_records (id, task_id, processor_id, processor_role, action, result, fail_reason, evidence)
       VALUES (?, ?, ?, ?, ?, 'failure', ?, ?)`,
      [uuidv4(), taskId, userId, userRole, action, failReason, failReason],
    );
  }
}
