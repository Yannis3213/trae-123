import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { BusinessException, ErrorCodes } from '../common/exceptions';
import { FIELD_RECORD_TYPES } from '../common/constants';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FieldRecordService {
  constructor(private readonly dbService: DatabaseService) {}

  async listByTask(taskId: string) {
    return this.dbService.query(
      `SELECT f.*, u.display_name as recorder_name FROM field_records f LEFT JOIN users u ON f.recorder_id = u.id WHERE f.task_id = ? ORDER BY f.record_date DESC`,
      [taskId],
    );
  }

  async create(
    body: {
      taskId: string;
      recordDate: string;
      recordType: string;
      content: string;
      weather?: string;
      remarks?: string;
    },
    userId: string,
    userRole: string,
  ) {
    const task = this.dbService.queryOne('SELECT id FROM planting_tasks WHERE id = ?', [body.taskId]);
    if (!task) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '关联种植任务不存在', 404);
    }

    const validTypes = Object.values(FIELD_RECORD_TYPES);
    if (!validTypes.includes(body.recordType as any)) {
      throw new BusinessException(ErrorCodes.FORBIDDEN_ACTION, `无效的田间记录类型: ${body.recordType}`);
    }

    const id = uuidv4();
    this.dbService.run(
      `INSERT INTO field_records (id, task_id, record_date, record_type, content, recorder_id, recorder_role, weather, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.taskId, body.recordDate, body.recordType, body.content, userId, userRole, body.weather || null, body.remarks || null],
    );

    return this.dbService.queryOne('SELECT * FROM field_records WHERE id = ?', [id]);
  }
}
