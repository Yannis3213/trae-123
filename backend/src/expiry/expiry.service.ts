import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ExpiryService {
  constructor(private dbService: DatabaseService) {}

  getSummary() {
    this.dbService.recalcAllExpiryStatuses();
    const db = this.dbService.getDb();
    const normal = (db.prepare("SELECT COUNT(*) as count FROM suitability_records WHERE expiry_status = 'normal'").get() as any).count;
    const nearExpiry = (db.prepare("SELECT COUNT(*) as count FROM suitability_records WHERE expiry_status = 'near_expiry'").get() as any).count;
    const overdue = (db.prepare("SELECT COUNT(*) as count FROM suitability_records WHERE expiry_status = 'overdue'").get() as any).count;
    return { normal, near_expiry: nearExpiry, overdue };
  }

  private mapRecord(r: any) {
    return {
      ...r,
      days_remaining: Math.ceil((new Date(r.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      responsible_person: r.current_handler_name || '未分派',
      current_handler: r.current_handler ? { id: r.current_handler, name: r.current_handler_name } : null,
      assigned_to: r.assigned_to ? { id: r.assigned_to, name: r.assigned_to_name } : null,
      created_by: r.created_by ? { id: r.created_by, name: r.created_by_name } : null,
      suitability_check: !!r.has_suitability_evidence,
      risk_assessment: !!r.has_risk_assessment,
      business_opening: !!r.has_business_opening,
    };
  }

  getNormalRecords() {
    this.dbService.recalcAllExpiryStatuses();
    const db = this.dbService.getDb();
    const rows = db.prepare(`
      SELECT sr.*, u1.name as assigned_to_name, u2.name as current_handler_name, u3.name as created_by_name
      FROM suitability_records sr
      LEFT JOIN users u1 ON sr.assigned_to = u1.id
      LEFT JOIN users u2 ON sr.current_handler = u2.id
      LEFT JOIN users u3 ON sr.created_by = u3.id
      WHERE sr.expiry_status = 'normal'
      ORDER BY sr.expiry_date ASC
    `).all();
    return rows.map((r: any) => this.mapRecord(r));
  }

  getNearExpiryRecords() {
    this.dbService.recalcAllExpiryStatuses();
    const db = this.dbService.getDb();
    const rows = db.prepare(`
      SELECT sr.*, u1.name as assigned_to_name, u2.name as current_handler_name, u3.name as created_by_name
      FROM suitability_records sr
      LEFT JOIN users u1 ON sr.assigned_to = u1.id
      LEFT JOIN users u2 ON sr.current_handler = u2.id
      LEFT JOIN users u3 ON sr.created_by = u3.id
      WHERE sr.expiry_status = 'near_expiry'
      ORDER BY sr.expiry_date ASC
    `).all();
    return rows.map((r: any) => this.mapRecord(r));
  }

  getOverdueRecords() {
    this.dbService.recalcAllExpiryStatuses();
    const db = this.dbService.getDb();
    const rows = db.prepare(`
      SELECT sr.*, u1.name as assigned_to_name, u2.name as current_handler_name, u3.name as created_by_name,
        u2.role as handler_role
      FROM suitability_records sr
      LEFT JOIN users u1 ON sr.assigned_to = u1.id
      LEFT JOIN users u2 ON sr.current_handler = u2.id
      LEFT JOIN users u3 ON sr.created_by = u3.id
      WHERE sr.expiry_status = 'overdue'
      ORDER BY sr.expiry_date ASC
    `).all();
    return rows.map((r: any) => this.mapRecord(r));
  }
}
