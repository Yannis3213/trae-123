import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { TASK_STATUS, TASK_STATUS_LABELS, OVERDUE_STATUS, OVERDUE_STATUS_LABELS, USER_ROLES } from '../common/constants';
import { BusinessException, ErrorCodes } from '../common/exceptions';
import { PlantingTaskService } from '../planting-task/planting-task.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OverdueQueueService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly taskService: PlantingTaskService,
  ) {}

  async list(userId: string, userRole: string) {
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

    const overdueItems = tasks.map((t) => {
      const deadlineDate = new Date(t.deadline);
      let overdueStatus = OVERDUE_STATUS.NORMAL;
      if (deadlineDate < now) {
        overdueStatus = OVERDUE_STATUS.OVERDUE;
      } else if (deadlineDate <= threeDaysLater) {
        overdueStatus = OVERDUE_STATUS.NEAR_EXPIRY;
      }
      const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: t.id,
        taskNo: t.task_no,
        title: t.title,
        status: t.status,
        statusLabel: TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] || t.status,
        assigneeId: t.assignee_id,
        assigneeName: t.assignee_name,
        deadline: t.deadline,
        overdueStatus,
        overdueStatusLabel: OVERDUE_STATUS_LABELS[overdueStatus],
        daysRemaining,
        version: t.version,
      };
    }).filter((item) => item.overdueStatus !== OVERDUE_STATUS.NORMAL);

    const grouped = {
      nearExpiry: overdueItems.filter((i) => i.overdueStatus === OVERDUE_STATUS.NEAR_EXPIRY),
      overdue: overdueItems.filter((i) => i.overdueStatus === OVERDUE_STATUS.OVERDUE),
    };

    return {
      nearExpiryCount: grouped.nearExpiry.length,
      overdueCount: grouped.overdue.length,
      nearExpiry: grouped.nearExpiry,
      overdue: grouped.overdue,
    };
  }

  async batchAdvance(
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
    }> = [];

    for (const taskId of taskIds) {
      try {
        const task = this.dbService.queryOne(
          'SELECT id, task_no, status, version, deadline, assignee_id FROM planting_tasks WHERE id = ?',
          [taskId],
        ) as any;

        if (!task) {
          results.push({ taskId, taskNo: '', success: false, reason: '种植任务不存在' });
          continue;
        }

        const deadlineDate = new Date(task.deadline);
        const now = new Date();
        if (deadlineDate >= now) {
          results.push({ taskId, taskNo: task.task_no, success: false, reason: '该任务尚未逾期，不能使用逾期批量推进' });
          continue;
        }

        const targetStatus = this.getNextStatus(task.status);
        if (!targetStatus) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"无法自动推进`,
          });
          continue;
        }

        if (task.assignee_id !== userId && userRole !== USER_ROLES.COOPERATIVE_DIRECTOR) {
          results.push({
            taskId,
            taskNo: task.task_no,
            success: false,
            reason: '只有当前责任人或合作社主任可以推进逾期任务',
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

        this.dbService.run(
          `INSERT INTO audit_logs (id, task_id, operator_id, operator_role, action, before_status, after_status, remarks)
           VALUES (?, ?, ?, ?, 'overdue_advance', ?, ?, '逾期批量推进')`,
          [uuidv4(), taskId, userId, userRole, task.status, targetStatus],
        );

        results.push({ taskId, taskNo: task.task_no, success: true });
      } catch (e: any) {
        results.push({ taskId, taskNo: '', success: false, reason: e.message || '处理失败' });
      }
    }

    return {
      total: results.length,
      successCount: results.filter((r) => r.success).length,
      failCount: results.filter((r) => !r.success).length,
      results,
    };
  }

  private getNextStatus(currentStatus: string): string | null {
    const flow: Record<string, string> = {
      [TASK_STATUS.PENDING_ASSIGN]: TASK_STATUS.ASSIGNED,
      [TASK_STATUS.ASSIGNED]: TASK_STATUS.PROCESSING,
      [TASK_STATUS.PROCESSING]: TASK_STATUS.TRANSFERRED,
      [TASK_STATUS.TRANSFERRED]: TASK_STATUS.FOLLOWED_UP,
      [TASK_STATUS.FOLLOWED_UP]: TASK_STATUS.ARCHIVED,
      [TASK_STATUS.RETURNED_FOR_CORRECTION]: TASK_STATUS.PENDING_ASSIGN,
    };
    return flow[currentStatus] || null;
  }
}
