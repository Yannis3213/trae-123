import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BatchProcessDto, BatchOverdueAdvanceDto, UpdateStatusDto } from '../common/dto';

@Injectable()
export class BatchService {
  constructor(private dbService: DatabaseService) {}

  batchProcess(dto: BatchProcessDto, user: any) {
    const results: Array<{ record_id: number; record_no?: string; success: boolean; reason?: string }> = [];

    for (const recordId of dto.record_ids) {
      try {
        const statusDto: UpdateStatusDto = {
          action: dto.action,
          assigned_to: dto.assigned_to,
          comment: dto.comment,
          version: -1,
          review_opinion: dto.review_opinion,
          review_result: dto.review_result,
          return_reason: dto.return_reason,
        };

        const db = this.dbService.getDb();
        const record = db.prepare('SELECT * FROM suitability_records WHERE id = ?').get(recordId) as any;
        if (!record) {
          results.push({ record_id: recordId, success: false, reason: 'INVALID_STATUS: 记录不存在' });
          continue;
        }

        statusDto.version = record.version;
        this.processSingleRecord(recordId, statusDto, user, record);
        results.push({ record_id: recordId, record_no: record.record_no, success: true });
      } catch (err: any) {
        const msg = err.message || '未知错误';
        const db = this.dbService.getDb();
        const record = db.prepare('SELECT record_no FROM suitability_records WHERE id = ?').get(recordId) as any;
        results.push({ record_id: recordId, record_no: record?.record_no, success: false, reason: msg });
      }
    }

    return results;
  }

  batchOverdueAdvance(dto: BatchOverdueAdvanceDto, user: any) {
    const results: Array<{ record_id: number; record_no?: string; success: boolean; reason?: string }> = [];
    const db = this.dbService.getDb();

    for (const recordId of dto.record_ids) {
      try {
        this.dbService.recalcExpiryStatus(recordId);
        const record = db.prepare('SELECT * FROM suitability_records WHERE id = ?').get(recordId) as any;
        if (!record) {
          results.push({ record_id: recordId, success: false, reason: 'INVALID_STATUS: 记录不存在' });
          continue;
        }

        if (record.expiry_status !== 'overdue') {
          results.push({ record_id: recordId, record_no: record.record_no, success: false, reason: 'INVALID_STATUS: 记录未逾期' });
          continue;
        }

        let action: 'assign' | 'transfer' | 'review' | 'return';
        if (record.status === 'pending_assign') {
          action = 'assign';
        } else if (record.status === 'transferred') {
          action = 'transfer';
        } else if (record.status === 'visited') {
          action = 'review';
        } else {
          results.push({ record_id: recordId, record_no: record.record_no, success: false, reason: 'INVALID_STATUS: 无法推进当前状态' });
          continue;
        }

        const statusDto: UpdateStatusDto = {
          action,
          assigned_to: this.getNextHandler(record),
          comment: dto.comment || '逾期批量推进处理',
          version: record.version,
          review_opinion: action === 'review' ? (dto.comment || '逾期批量推进审核通过') : undefined,
          review_result: action === 'review' ? 'approved' : undefined,
        };

        this.processSingleRecord(recordId, statusDto, user, record);
        results.push({ record_id: recordId, record_no: record.record_no, success: true });
      } catch (err: any) {
        const msg = err.message || '未知错误';
        const record = db.prepare('SELECT record_no FROM suitability_records WHERE id = ?').get(recordId) as any;
        results.push({ record_id: recordId, record_no: record?.record_no, success: false, reason: msg });
      }
    }

    return results;
  }

  private getNextHandler(record: any): number | undefined {
    const db = this.dbService.getDb();
    if (record.status === 'pending_assign') {
      const co = db.prepare("SELECT id FROM users WHERE role = 'compliance_officer' LIMIT 1").get() as any;
      return co?.id;
    }
    if (record.status === 'transferred') {
      const bm = db.prepare("SELECT id FROM users WHERE role = 'branch_manager' LIMIT 1").get() as any;
      return bm?.id;
    }
    return undefined;
  }

  private processSingleRecord(id: number, dto: UpdateStatusDto, user: any, record: any) {
    const db = this.dbService.getDb();

    if (dto.version !== record.version) {
      throw new Error('VERSION_CONFLICT: 记录已被其他人修改，请刷新后重试');
    }

    this.validateStatusTransition(record, dto, user);

    const txn = db.transaction(() => {
      let newStatus = record.status;
      let newAssignedTo = record.assigned_to;
      let newCurrentHandler = record.current_handler;

      switch (dto.action) {
        case 'assign':
          newStatus = 'transferred';
          newAssignedTo = dto.assigned_to;
          newCurrentHandler = dto.assigned_to;
          break;
        case 'transfer':
          newStatus = 'visited';
          newAssignedTo = dto.assigned_to;
          newCurrentHandler = dto.assigned_to;
          break;
        case 'review':
          newStatus = 'visited';
          break;
        case 'return':
          if (record.status === 'transferred') {
            newStatus = 'pending_assign';
            newCurrentHandler = record.created_by;
          } else if (record.status === 'visited') {
            newStatus = 'transferred';
            newCurrentHandler = record.assigned_to;
          }
          break;
      }

      const newRound = dto.action === 'return' ? (record.correction_round || 0) + 1 : record.correction_round;
      const newCorrectionNote = dto.action === 'return' ? null : record.correction_note;

      db.prepare(`
        UPDATE suitability_records SET status = ?, assigned_to = ?, current_handler = ?, version = version + 1, updated_at = datetime('now'),
        review_opinion = ?, review_result = ?, return_reason = ?, correction_note = ?, correction_round = ?
        WHERE id = ?
      `).run(newStatus, newAssignedTo, newCurrentHandler,
        dto.review_opinion || record.review_opinion,
        dto.review_result || record.review_result,
        dto.return_reason || record.return_reason,
        newCorrectionNote,
        newRound,
        id);

      this.dbService.recalcExpiryStatus(id);

      db.prepare(`
        INSERT INTO processing_records (record_id, action, from_status, to_status, handler_id, handler_role, comment, review_opinion, review_result, return_reason, correction_note, round)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, dto.action, record.status, newStatus, user.id, user.role, dto.comment || null,
        dto.review_opinion || null,
        dto.review_result || null,
        dto.return_reason || null,
        dto.action === 'return' ? null : record.correction_note,
        newRound);

      if (dto.action === 'return' && dto.return_reason) {
        db.prepare('INSERT INTO exception_reasons (record_id, reason_type, description, created_by, round) VALUES (?, ?, ?, ?, ?)')
          .run(id, 'return_correction', dto.return_reason, user.id, newRound);
      }
    });

    txn();
  }

  private validateStatusTransition(record: any, dto: UpdateStatusDto, user: any) {
    switch (dto.action) {
      case 'assign':
        if (user.role !== 'financial_advisor') {
          throw new Error('UNAUTHORIZED_ROLE: 只有理财顾问可以分派记录');
        }
        if (record.status !== 'pending_assign') {
          throw new Error('INVALID_STATUS: 只有待分派状态的记录可以分派');
        }
        if (!dto.assigned_to) {
          throw new Error('MISSING_EVIDENCE: 必须指定分派目标');
        }
        const targetUser = this.dbService.getDb().prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(dto.assigned_to, 'compliance_officer') as any;
        if (!targetUser) {
          throw new Error('INVALID_STATUS: 分派目标必须是合规专员');
        }
        break;

      case 'transfer':
        if (user.role !== 'compliance_officer') {
          throw new Error('UNAUTHORIZED_ROLE: 只有合规专员可以转办记录');
        }
        if (record.status !== 'transferred') {
          throw new Error('INVALID_STATUS: 只有已转办状态的记录可以转办');
        }
        if (record.current_handler !== user.id) {
          throw new Error('NOT_ASSIGNED_HANDLER: 您不是该记录的当前处理人');
        }
        if (!dto.assigned_to) {
          throw new Error('MISSING_EVIDENCE: 必须指定转办目标');
        }
        const bmUser = this.dbService.getDb().prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(dto.assigned_to, 'branch_manager') as any;
        if (!bmUser) {
          throw new Error('INVALID_STATUS: 转办目标必须是营业部经理');
        }
        if (!record.has_suitability_evidence || !record.has_risk_assessment || !record.has_business_opening) {
          throw new Error('MISSING_EVIDENCE: 三项材料（适当性凭证、风险评估、业务开通）必须齐全才能转办');
        }
        break;

      case 'review':
        if (user.role !== 'branch_manager') {
          throw new Error('UNAUTHORIZED_ROLE: 只有营业部经理可以审核记录');
        }
        if (record.status !== 'visited') {
          throw new Error('INVALID_STATUS: 只有已回访状态的记录可以审核');
        }
        if (record.current_handler !== user.id) {
          throw new Error('NOT_ASSIGNED_HANDLER: 您不是该记录的当前处理人');
        }
        if (!dto.review_opinion) {
          throw new Error('MISSING_EVIDENCE: 审核必须填写复核意见');
        }
        if (!dto.review_result) {
          throw new Error('MISSING_EVIDENCE: 审核必须选择复核结果');
        }
        break;

      case 'return':
        if (user.role !== 'compliance_officer' && user.role !== 'branch_manager') {
          throw new Error('UNAUTHORIZED_ROLE: 只有合规专员或营业部经理可以退回记录');
        }
        if (record.current_handler !== user.id) {
          throw new Error('NOT_ASSIGNED_HANDLER: 您不是该记录的当前处理人');
        }
        if (!dto.comment) {
          throw new Error('MISSING_EVIDENCE: 退回必须填写原因');
        }
        if (!dto.return_reason) {
          throw new Error('MISSING_EVIDENCE: 退回必须填写补正要求');
        }
        if (record.status !== 'transferred' && record.status !== 'visited') {
          throw new Error('INVALID_STATUS: 只有已转办或已回访状态的记录可以退回');
        }
        break;

      default:
        throw new Error('INVALID_STATUS: 未知的操作类型');
    }
  }
}
