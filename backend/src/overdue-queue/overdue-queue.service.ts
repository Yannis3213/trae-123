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

@Injectable()
export class OverdueQueueService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly taskService: PlantingTaskService,
  ) {}

  async list(userId?: string, userRole?: string): Promise<{
    nearExpiryCount: number;
    overdueCount: number;
    nearExpiry: any[];
    overdue: any[];
  }> {
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
    evidence: string | undefined,
    userId: string,
    userRole: string,
  ): Promise<{
    total: number;
    successCount: number;
    failCount: number;
    results: Array<{ taskId: string; taskNo: string; success: boolean; reason?: string }>;
  }> {
    const results: Array<{
      taskId: string;
      taskNo: string;
      success: boolean;
      reason?: string;
    }> = [];

    const now = new Date();

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
        if (deadlineDate >= now) {
          const failReason = '该任务尚未逾期，不能使用逾期批量推进';
          this.dbService.run(
            `INSERT INTO audit_logs (id, task_id, operator_id, operator_role, action, before_status, after_status, fail_reason, remarks)
             VALUES (?, ?, ?, ?, 'overdue_advance', ?, ?, ?, ?)`,
            [uuidv4(), taskId, userId, userRole, task.status, task.status, failReason, `逾期批量推进失败: ${failReason}`],
          );
          this.dbService.run(
            `INSERT INTO processing_records (id, task_id, processor_id, processor_role, action, result, fail_reason, evidence)
             VALUES (?, ?, ?, ?, 'overdue_advance', 'failure', ?, ?)`,
            [uuidv4(), taskId, userId, userRole, failReason, failReason],
          );
          results.push({ taskId, taskNo: task.task_no, success: false, reason: failReason });
          continue;
        }

        const advanceAction = this.getAdvanceAction(task.status);
        if (!advanceAction) {
          const failReason = `当前状态"${TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS]}"无法自动推进`;
          this.dbService.run(
            `INSERT INTO audit_logs (id, task_id, operator_id, operator_role, action, before_status, after_status, fail_reason, remarks)
             VALUES (?, ?, ?, ?, 'overdue_advance', ?, ?, ?, ?)`,
            [uuidv4(), taskId, userId, userRole, task.status, task.status, failReason, `逾期批量推进失败: ${failReason}`],
          );
          this.dbService.run(
            `INSERT INTO processing_records (id, task_id, processor_id, processor_role, action, result, fail_reason, evidence)
             VALUES (?, ?, ?, ?, 'overdue_advance', 'failure', ?, ?)`,
            [uuidv4(), taskId, userId, userRole, failReason, failReason],
          );
          results.push({ taskId, taskNo: task.task_no, success: false, reason: failReason });
          continue;
        }

        const executeResult = await this.taskService.executeBatchAction(
          taskId,
          advanceAction,
          evidence || `逾期批量推进`,
          userId,
          userRole,
        );

        results.push({
          taskId,
          taskNo: task.task_no,
          success: executeResult.success,
          reason: executeResult.reason,
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

  private getAdvanceAction(currentStatus: string): string | null {
    const flow: Record<string, string> = {
      [TASK_STATUS.PENDING_ASSIGN]: 'assign',
      [TASK_STATUS.ASSIGNED]: 'process',
      [TASK_STATUS.PROCESSING]: 'complete_processing',
      [TASK_STATUS.TRANSFERRED]: 'follow_up',
      [TASK_STATUS.FOLLOWED_UP]: 'archive',
      [TASK_STATUS.RETURNED_FOR_CORRECTION]: 'assign',
    };
    return flow[currentStatus] || null;
  }
}
