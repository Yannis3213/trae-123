import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { BusinessException, ErrorCodes } from '../common/exceptions';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MaterialRequisitionService {
  constructor(private readonly dbService: DatabaseService) {}

  async listByTask(taskId: string) {
    return this.dbService.query(
      `SELECT m.*, u.display_name as applicant_name FROM material_requisitions m LEFT JOIN users u ON m.applicant_id = u.id WHERE m.task_id = ? ORDER BY m.applied_at DESC`,
      [taskId],
    );
  }

  async create(
    body: { taskId: string; materialName: string; quantity: number; unit: string; remarks?: string },
    userId: string,
    userRole: string,
  ) {
    const task = this.dbService.queryOne('SELECT id FROM planting_tasks WHERE id = ?', [body.taskId]);
    if (!task) {
      throw new BusinessException(ErrorCodes.NOT_FOUND, '关联种植任务不存在', 404);
    }

    const id = uuidv4();
    this.dbService.run(
      `INSERT INTO material_requisitions (id, task_id, material_name, quantity, unit, requisition_status, applicant_id, applicant_role, remarks)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [id, body.taskId, body.materialName, body.quantity, body.unit, userId, userRole, body.remarks || null],
    );

    return this.dbService.queryOne('SELECT * FROM material_requisitions WHERE id = ?', [id]);
  }

  async approve(id: string, userId: string, userRole: string) {
    const req = this.dbService.queryOne('SELECT * FROM material_requisitions WHERE id = ?', [id]) as any;
    if (!req) throw new BusinessException(ErrorCodes.NOT_FOUND, '农资领用记录不存在', 404);
    if (req.requisition_status !== 'pending') {
      throw new BusinessException(ErrorCodes.STATUS_CONFLICT, '只有待审批状态可以审批');
    }

    this.dbService.run(
      `UPDATE material_requisitions SET requisition_status = 'approved', approved_at = datetime('now', 'localtime') WHERE id = ?`,
      [id],
    );

    return this.dbService.queryOne('SELECT * FROM material_requisitions WHERE id = ?', [id]);
  }

  async reject(id: string, remarks: string, userId: string, userRole: string) {
    const req = this.dbService.queryOne('SELECT * FROM material_requisitions WHERE id = ?', [id]) as any;
    if (!req) throw new BusinessException(ErrorCodes.NOT_FOUND, '农资领用记录不存在', 404);
    if (req.requisition_status !== 'pending') {
      throw new BusinessException(ErrorCodes.STATUS_CONFLICT, '只有待审批状态可以驳回');
    }

    this.dbService.run(
      `UPDATE material_requisitions SET requisition_status = 'rejected', approved_at = datetime('now', 'localtime'), remarks = ? WHERE id = ?`,
      [remarks || '被驳回', id],
    );

    return this.dbService.queryOne('SELECT * FROM material_requisitions WHERE id = ?', [id]);
  }
}
