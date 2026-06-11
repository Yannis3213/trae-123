import { Injectable, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRecordDto, UpdateStatusDto, AddAuditNoteDto, AddAttachmentDto } from '../common/dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RecordsService {
  constructor(private dbService: DatabaseService) {}

  list(filters: { status?: string; role?: string; handler?: string; expiry_status?: string }, user: any) {
    this.dbService.recalcAllExpiryStatuses();
    const db = this.dbService.getDb();
    let sql = `
      SELECT sr.*, u1.name as assigned_to_name, u2.name as current_handler_name, u3.name as created_by_name
      FROM suitability_records sr
      LEFT JOIN users u1 ON sr.assigned_to = u1.id
      LEFT JOIN users u2 ON sr.current_handler = u2.id
      LEFT JOIN users u3 ON sr.created_by = u3.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.role === 'financial_advisor') {
      sql += ' AND sr.created_by = ?';
      params.push(user.id);
      if (filters.status) {
        sql += ' AND sr.status = ?';
        params.push(filters.status);
      }
    } else if (user.role === 'compliance_officer') {
      if (filters.status === 'pending_assign' || !filters.status) {
        sql += ' AND (sr.status = ? OR (sr.status = ? AND sr.current_handler = ?))';
        params.push('transferred', 'transferred', user.id);
      } else {
        sql += ' AND sr.status = ? AND sr.current_handler = ?';
        params.push(filters.status, user.id);
      }
    } else if (user.role === 'branch_manager') {
      if (filters.status === 'pending_assign' || !filters.status) {
        sql += ' AND (sr.status = ? OR (sr.status = ? AND sr.current_handler = ?))';
        params.push('visited', 'visited', user.id);
      } else {
        sql += ' AND sr.status = ? AND sr.current_handler = ?';
        params.push(filters.status, user.id);
      }
    }

    if (filters.expiry_status) {
      sql += ' AND sr.expiry_status = ?';
      params.push(filters.expiry_status);
    }

    sql += ' ORDER BY sr.updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    return rows.map((r: any) => ({
      ...r,
      current_handler: r.current_handler ? { id: r.current_handler, name: r.current_handler_name } : null,
      assigned_to: r.assigned_to ? { id: r.assigned_to, name: r.assigned_to_name } : null,
      created_by: r.created_by ? { id: r.created_by, name: r.created_by_name } : null,
      suitability_check: !!r.has_suitability_evidence,
      risk_assessment: !!r.has_risk_assessment,
      business_opening: !!r.has_business_opening,
    }));
  }

  getDetail(id: number) {
    this.dbService.recalcExpiryStatus(id);
    const db = this.dbService.getDb();
    const record = db.prepare(`
      SELECT sr.*, u1.name as assigned_to_name, u2.name as current_handler_name, u3.name as created_by_name
      FROM suitability_records sr
      LEFT JOIN users u1 ON sr.assigned_to = u1.id
      LEFT JOIN users u2 ON sr.current_handler = u2.id
      LEFT JOIN users u3 ON sr.created_by = u3.id
      WHERE sr.id = ?
    `).get(id) as any;
    if (!record) return null;

    const attachments = db.prepare('SELECT * FROM attachments WHERE record_id = ? ORDER BY uploaded_at DESC').all(id);
    const processingRecords = db.prepare('SELECT pr.*, u.name as handler_name FROM processing_records pr LEFT JOIN users u ON pr.handler_id = u.id WHERE pr.record_id = ? ORDER BY created_at DESC').all(id);
    const auditNotes = db.prepare('SELECT an.*, u.name as author_name FROM audit_notes an LEFT JOIN users u ON an.author_id = u.id WHERE an.record_id = ? ORDER BY created_at DESC').all(id);
    const exceptionReasons = db.prepare('SELECT er.*, u.name as created_by_name FROM exception_reasons er LEFT JOIN users u ON er.created_by = u.id WHERE er.record_id = ? ORDER BY created_at DESC').all(id);

    return {
      ...record,
      current_handler: record.current_handler ? { id: record.current_handler, name: record.current_handler_name } : null,
      assigned_to: record.assigned_to ? { id: record.assigned_to, name: record.assigned_to_name } : null,
      created_by: record.created_by ? { id: record.created_by, name: record.created_by_name } : null,
      suitability_check: !!record.has_suitability_evidence,
      risk_assessment: !!record.has_risk_assessment,
      business_opening: !!record.has_business_opening,
      attachments: attachments.map((a: any) => ({ ...a, filename: a.file_name })),
      processing_records: processingRecords.map((pr: any) => ({ ...pr, handler: pr.handler_id ? { id: pr.handler_id, name: pr.handler_name } : null })),
      audit_notes: auditNotes.map((n: any) => ({ ...n, created_by: n.author_id ? { id: n.author_id, name: n.author_name } : null })),
      exception_reasons: exceptionReasons.map((er: any) => ({ ...er, reason: er.description, created_by_name: er.created_by_name })),
    };
  }

  create(dto: CreateRecordDto, user: any) {
    const db = this.dbService.getDb();
    const recordNo = `SR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const expiryStatus = this.dbService.calcExpiryStatusForRecord(dto.expiry_date);

    const result = db.prepare(`
      INSERT INTO suitability_records (record_no, client_name, client_id_no, business_type, status, expiry_status, expiry_date, current_handler, has_suitability_evidence, has_risk_assessment, has_business_opening, exception_reason, created_by)
      VALUES (?, ?, ?, ?, 'pending_assign', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordNo, dto.client_name, dto.client_id_no, dto.business_type,
      expiryStatus, dto.expiry_date, user.id,
      dto.has_suitability_evidence, dto.has_risk_assessment, dto.has_business_opening,
      dto.exception_reason || null, user.id
    );

    if (dto.exception_reason) {
      db.prepare('INSERT INTO exception_reasons (record_id, reason_type, description, created_by) VALUES (?, ?, ?, ?)')
        .run(result.lastInsertRowid as number, 'other', dto.exception_reason, user.id);
    }

    return this.getDetail(result.lastInsertRowid as number);
  }

  updateStatus(id: number, dto: UpdateStatusDto, user: any) {
    const db = this.dbService.getDb();
    const record = db.prepare('SELECT * FROM suitability_records WHERE id = ?').get(id) as any;
    if (!record) {
      throw new BadRequestException('记录不存在');
    }

    if (dto.version !== record.version) {
      throw new ConflictException('VERSION_CONFLICT: 记录已被其他人修改，请刷新后重试');
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

      db.prepare(`
        UPDATE suitability_records SET status = ?, assigned_to = ?, current_handler = ?, version = version + 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(newStatus, newAssignedTo, newCurrentHandler, id);

      this.dbService.recalcExpiryStatus(id);

      db.prepare(`
        INSERT INTO processing_records (record_id, action, from_status, to_status, handler_id, handler_role, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, dto.action, record.status, newStatus, user.id, user.role, dto.comment || null);
    });

    txn();
    return this.getDetail(id);
  }

  private validateStatusTransition(record: any, dto: UpdateStatusDto, user: any) {
    switch (dto.action) {
      case 'assign':
        if (user.role !== 'financial_advisor') {
          throw new ForbiddenException('UNAUTHORIZED_ROLE: 只有理财顾问可以分派记录');
        }
        if (record.status !== 'pending_assign') {
          throw new BadRequestException('INVALID_STATUS: 只有待分派状态的记录可以分派');
        }
        if (!dto.assigned_to) {
          throw new BadRequestException('MISSING_EVIDENCE: 必须指定分派目标');
        }
        const targetUser = this.dbService.getDb().prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(dto.assigned_to, 'compliance_officer') as any;
        if (!targetUser) {
          throw new BadRequestException('INVALID_STATUS: 分派目标必须是合规专员');
        }
        break;

      case 'transfer':
        if (user.role !== 'compliance_officer') {
          throw new ForbiddenException('UNAUTHORIZED_ROLE: 只有合规专员可以转办记录');
        }
        if (record.status !== 'transferred') {
          throw new BadRequestException('INVALID_STATUS: 只有已转办状态的记录可以转办');
        }
        if (record.current_handler !== user.id) {
          throw new ForbiddenException('NOT_ASSIGNED_HANDLER: 您不是该记录的当前处理人');
        }
        if (!dto.assigned_to) {
          throw new BadRequestException('MISSING_EVIDENCE: 必须指定转办目标');
        }
        const bmUser = this.dbService.getDb().prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(dto.assigned_to, 'branch_manager') as any;
        if (!bmUser) {
          throw new BadRequestException('INVALID_STATUS: 转办目标必须是营业部经理');
        }
        if (!record.has_suitability_evidence || !record.has_risk_assessment || !record.has_business_opening) {
          throw new BadRequestException('MISSING_EVIDENCE: 三项材料（适当性凭证、风险评估、业务开通）必须齐全才能转办');
        }
        break;

      case 'review':
        if (user.role !== 'branch_manager') {
          throw new ForbiddenException('UNAUTHORIZED_ROLE: 只有营业部经理可以审核记录');
        }
        if (record.status !== 'visited') {
          throw new BadRequestException('INVALID_STATUS: 只有已回访状态的记录可以审核');
        }
        if (record.current_handler !== user.id) {
          throw new ForbiddenException('NOT_ASSIGNED_HANDLER: 您不是该记录的当前处理人');
        }
        break;

      case 'return':
        if (user.role !== 'compliance_officer' && user.role !== 'branch_manager') {
          throw new ForbiddenException('UNAUTHORIZED_ROLE: 只有合规专员或营业部经理可以退回记录');
        }
        if (record.current_handler !== user.id) {
          throw new ForbiddenException('NOT_ASSIGNED_HANDLER: 您不是该记录的当前处理人');
        }
        if (!dto.comment) {
          throw new BadRequestException('MISSING_EVIDENCE: 退回必须填写原因');
        }
        if (record.status !== 'transferred' && record.status !== 'visited') {
          throw new BadRequestException('INVALID_STATUS: 只有已转办或已回访状态的记录可以退回');
        }
        break;

      default:
        throw new BadRequestException('INVALID_STATUS: 未知的操作类型');
    }
  }

  submitCorrection(id: number, user: any, comment?: string) {
    const db = this.dbService.getDb();
    const record = db.prepare('SELECT * FROM suitability_records WHERE id = ?').get(id) as any;
    if (!record) {
      throw new BadRequestException('记录不存在');
    }

    const txn = db.transaction(() => {
      db.prepare(`
        UPDATE suitability_records SET version = version + 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(id);

      db.prepare(`
        INSERT INTO processing_records (record_id, action, from_status, to_status, handler_id, handler_role, comment)
        VALUES (?, 'correction', ?, ?, ?, ?, ?)
      `).run(id, record.status, record.status, user.id, user.role, comment || '提交修正材料');

      this.dbService.recalcExpiryStatus(id);
    });

    txn();
    return this.getDetail(id);
  }

  addAttachment(id: number, dto: AddAttachmentDto, user: any) {
    const db = this.dbService.getDb();
    const record = db.prepare('SELECT * FROM suitability_records WHERE id = ?').get(id) as any;
    if (!record) {
      throw new BadRequestException('记录不存在');
    }

    const txn = db.transaction(() => {
      db.prepare(`
        INSERT INTO attachments (record_id, file_name, file_type, category, uploaded_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, dto.file_name, dto.file_type, dto.category, user.id);

      if (dto.category === 'suitability') {
        db.prepare('UPDATE suitability_records SET has_suitability_evidence = 1, updated_at = datetime(\'now\') WHERE id = ?').run(id);
      } else if (dto.category === 'risk_assessment') {
        db.prepare('UPDATE suitability_records SET has_risk_assessment = 1, updated_at = datetime(\'now\') WHERE id = ?').run(id);
      } else if (dto.category === 'business_opening') {
        db.prepare('UPDATE suitability_records SET has_business_opening = 1, updated_at = datetime(\'now\') WHERE id = ?').run(id);
      }
    });

    txn();
    return this.getDetail(id);
  }

  addAuditNote(id: number, dto: AddAuditNoteDto, user: any) {
    const db = this.dbService.getDb();
    const record = db.prepare('SELECT * FROM suitability_records WHERE id = ?').get(id) as any;
    if (!record) {
      throw new BadRequestException('记录不存在');
    }

    db.prepare('INSERT INTO audit_notes (record_id, author_id, content) VALUES (?, ?, ?)')
      .run(id, user.id, dto.content);

    return this.getDetail(id);
  }
}
