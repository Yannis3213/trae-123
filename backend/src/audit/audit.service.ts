import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditService {
  constructor(private dbService: DatabaseService) {}

  getRecordAuditTrail(recordId: number) {
    const db = this.dbService.getDb();
    this.dbService.recalcExpiryStatus(recordId);

    const record = db.prepare(`
      SELECT sr.*, u1.name as assigned_to_name, u2.name as current_handler_name, u3.name as created_by_name
      FROM suitability_records sr
      LEFT JOIN users u1 ON sr.assigned_to = u1.id
      LEFT JOIN users u2 ON sr.current_handler = u2.id
      LEFT JOIN users u3 ON sr.created_by = u3.id
      WHERE sr.id = ?
    `).get(recordId) as any;

    const processingRecords = db.prepare(`
      SELECT pr.*, u.name as handler_name
      FROM processing_records pr
      LEFT JOIN users u ON pr.handler_id = u.id
      WHERE pr.record_id = ?
      ORDER BY pr.created_at ASC
    `).all(recordId);

    const auditNotes = db.prepare(`
      SELECT an.*, u.name as author_name
      FROM audit_notes an
      LEFT JOIN users u ON an.author_id = u.id
      WHERE an.record_id = ?
      ORDER BY an.created_at ASC
    `).all(recordId);

    const attachments = db.prepare(`
      SELECT a.*, u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.record_id = ?
      ORDER BY a.uploaded_at ASC
    `).all(recordId);

    const exceptionReasons = db.prepare(`
      SELECT er.*, u.name as created_by_name
      FROM exception_reasons er
      LEFT JOIN users u ON er.created_by = u.id
      WHERE er.record_id = ?
      ORDER BY er.created_at ASC
    `).all(recordId);

    return {
      record: record ? {
        ...record,
        current_handler: record.current_handler ? { id: record.current_handler, name: record.current_handler_name } : null,
        assigned_to: record.assigned_to ? { id: record.assigned_to, name: record.assigned_to_name } : null,
        created_by: record.created_by ? { id: record.created_by, name: record.created_by_name } : null,
        suitability_check: !!record.has_suitability_evidence,
        risk_assessment: !!record.has_risk_assessment,
        business_opening: !!record.has_business_opening,
      } : null,
      processing_records: processingRecords.map((pr: any) => ({ ...pr, handler: pr.handler_id ? { id: pr.handler_id, name: pr.handler_name } : null })),
      audit_notes: auditNotes.map((n: any) => ({ ...n, created_by: n.author_id ? { id: n.author_id, name: n.author_name } : null })),
      attachments: attachments.map((a: any) => ({ ...a, filename: a.file_name })),
      exception_reasons: exceptionReasons.map((er: any) => ({ ...er, reason: er.description, created_by_name: er.created_by_name })),
    };
  }

  getStats() {
    this.dbService.recalcAllExpiryStatuses();
    const db = this.dbService.getDb();

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM suitability_records GROUP BY status
    `).all() as Array<{ status: string; count: number }>;

    const byExpiry = db.prepare(`
      SELECT expiry_status, COUNT(*) as count FROM suitability_records GROUP BY expiry_status
    `).all() as Array<{ expiry_status: string; count: number }>;

    const auditLogs = db.prepare(`
      SELECT pr.*, u.name as handler_name, sr.record_no
      FROM processing_records pr
      LEFT JOIN users u ON pr.handler_id = u.id
      LEFT JOIN suitability_records sr ON pr.record_id = sr.id
      ORDER BY pr.created_at DESC
    `).all();

    return {
      status_counts: byStatus,
      expiry_counts: byExpiry,
      timeline: [],
      audit_logs: auditLogs.map((pr: any) => ({ ...pr, handler: pr.handler_id ? { id: pr.handler_id, name: pr.handler_name } : null })),
    };
  }
}
