import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { BusinessException, ErrorCodes } from '../common/exceptions';

@Injectable()
export class AuditLogService {
  constructor(private readonly dbService: DatabaseService) {}

  async list(filters: { taskId?: string; operatorId?: string; action?: string }) {
    let sql = `
      SELECT a.*, u.display_name as operator_name, t.task_no, t.title as task_title
      FROM audit_logs a
      LEFT JOIN users u ON a.operator_id = u.id
      LEFT JOIN planting_tasks t ON a.task_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.taskId) {
      sql += ' AND a.task_id = ?';
      params.push(filters.taskId);
    }
    if (filters.operatorId) {
      sql += ' AND a.operator_id = ?';
      params.push(filters.operatorId);
    }
    if (filters.action) {
      sql += ' AND a.action = ?';
      params.push(filters.action);
    }

    sql += ' ORDER BY a.created_at DESC LIMIT 500';

    return this.dbService.query(sql, params);
  }

  async detail(id: string) {
    const log = this.dbService.queryOne(
      `SELECT a.*, u.display_name as operator_name, t.task_no, t.title as task_title
       FROM audit_logs a
       LEFT JOIN users u ON a.operator_id = u.id
       LEFT JOIN planting_tasks t ON a.task_id = t.id
       WHERE a.id = ?`,
      [id],
    ) as any;
    if (!log) throw new BusinessException(ErrorCodes.NOT_FOUND, '审计记录不存在', 404);
    return log;
  }
}
