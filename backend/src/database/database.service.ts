import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: Database.Database;

  onModuleInit() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'suitability.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createTables();
    this.seedIfEmpty();
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('financial_advisor', 'compliance_officer', 'branch_manager')),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS suitability_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_no TEXT UNIQUE NOT NULL,
        client_name TEXT NOT NULL,
        client_id_no TEXT NOT NULL,
        business_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_assign' CHECK(status IN ('pending_assign', 'transferred', 'visited')),
        expiry_status TEXT NOT NULL DEFAULT 'normal' CHECK(expiry_status IN ('normal', 'near_expiry', 'overdue')),
        expiry_date TEXT NOT NULL,
        assigned_to INTEGER,
        current_handler INTEGER,
        version INTEGER DEFAULT 1,
        has_suitability_evidence INTEGER DEFAULT 0,
        has_risk_assessment INTEGER DEFAULT 0,
        has_business_opening INTEGER DEFAULT 0,
        exception_reason TEXT,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (current_handler) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('suitability', 'risk_assessment', 'business_opening', 'correction', 'other')),
        uploaded_by INTEGER NOT NULL,
        uploaded_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (record_id) REFERENCES suitability_records(id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS processing_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        handler_id INTEGER NOT NULL,
        handler_role TEXT NOT NULL,
        comment TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (record_id) REFERENCES suitability_records(id),
        FOREIGN KEY (handler_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS audit_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (record_id) REFERENCES suitability_records(id),
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS exception_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        reason_type TEXT NOT NULL CHECK(reason_type IN ('missing_material', 'timeout', 'return_correction', 'status_conflict', 'other')),
        description TEXT NOT NULL,
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        FOREIGN KEY (record_id) REFERENCES suitability_records(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);
  }

  private seedIfEmpty() {
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count > 0) return;

    const insertUser = this.db.prepare(
      'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)'
    );

    const hash1 = bcrypt.hashSync('password123', 10);
    const hash2 = bcrypt.hashSync('password123', 10);
    const hash3 = bcrypt.hashSync('password123', 10);

    insertUser.run('advisor1', hash1, '理财顾问张三', 'financial_advisor');
    insertUser.run('compliance1', hash2, '合规专员李四', 'compliance_officer');
    insertUser.run('manager1', hash3, '营业部经理王五', 'branch_manager');

    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, days: number) => {
      const r = new Date(d);
      r.setDate(r.getDate() + days);
      return r;
    };

    const insertRecord = this.db.prepare(`
      INSERT INTO suitability_records (record_no, client_name, client_id_no, business_type, status, expiry_status, expiry_date, assigned_to, current_handler, version, has_suitability_evidence, has_risk_assessment, has_business_opening, exception_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertProcessing = this.db.prepare(`
      INSERT INTO processing_records (record_id, action, from_status, to_status, handler_id, handler_role, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertException = this.db.prepare(`
      INSERT INTO exception_reasons (record_id, reason_type, description, created_by, resolved)
      VALUES (?, ?, ?, ?, ?)
    `);

    const records = [
      { no: 'SR-2024-001', client: '王明', idNo: '110101199001011234', biz: '创业板开通', status: 'pending_assign', expiry: addDays(now, 60), assigned: null, handler: 1, v: 1, suit: 0, risk: 0, bizOpen: 0, exReason: null, creator: 1 },
      { no: 'SR-2024-002', client: '李华', idNo: '310101198805052345', biz: '融资融券', status: 'pending_assign', expiry: addDays(now, 45), assigned: null, handler: 1, v: 1, suit: 1, risk: 1, bizOpen: 0, exReason: null, creator: 1 },
      { no: 'SR-2024-003', client: '张伟', idNo: '440101199203033456', biz: '科创板开通', status: 'transferred', expiry: addDays(now, 30), assigned: 2, handler: 2, v: 2, suit: 1, risk: 1, bizOpen: 1, exReason: null, creator: 1 },
      { no: 'SR-2024-004', client: '赵芳', idNo: '500101199506064567', biz: '期权交易', status: 'transferred', expiry: addDays(now, 20), assigned: 2, handler: 2, v: 2, suit: 1, risk: 1, bizOpen: 1, exReason: null, creator: 1 },
      { no: 'SR-2024-005', client: '陈刚', idNo: '320101198707075678', biz: '北交所开通', status: 'visited', expiry: addDays(now, 50), assigned: 3, handler: 3, v: 3, suit: 1, risk: 1, bizOpen: 1, exReason: null, creator: 1 },

      { no: 'SR-2024-006', client: '刘洋', idNo: '110101199104046789', biz: '创业板开通', status: 'pending_assign', expiry: addDays(now, 25), assigned: null, handler: 1, v: 1, suit: 0, risk: 0, bizOpen: 0, exReason: '缺少适当性评估材料', creator: 1 },
      { no: 'SR-2024-007', client: '周敏', idNo: '330101199308087890', biz: '融资融券', status: 'transferred', expiry: addDays(now, 15), assigned: 2, handler: 2, v: 2, suit: 0, risk: 1, bizOpen: 1, exReason: '缺少风险揭示书', creator: 1 },
      { no: 'SR-2024-008', client: '吴强', idNo: '420101199209098901', biz: '科创板开通', status: 'pending_assign', expiry: addDays(now, 10), assigned: null, handler: 1, v: 1, suit: 0, risk: 0, bizOpen: 0, exReason: '三项材料均缺失', creator: 1 },
      { no: 'SR-2024-009', client: '郑丽', idNo: '510101199410109012', biz: '期权交易', status: 'transferred', expiry: addDays(now, 18), assigned: 2, handler: 2, v: 2, suit: 1, risk: 0, bizOpen: 1, exReason: '缺少风险评估报告', creator: 1 },

      { no: 'SR-2024-010', client: '孙磊', idNo: '120101198811111123', biz: '北交所开通', status: 'pending_assign', expiry: addDays(now, 5), assigned: null, handler: 1, v: 1, suit: 0, risk: 0, bizOpen: 0, exReason: null, creator: 1 },
      { no: 'SR-2024-011', client: '何静', idNo: '210101199512122234', biz: '创业板开通', status: 'transferred', expiry: addDays(now, -3), assigned: 2, handler: 2, v: 2, suit: 1, risk: 1, bizOpen: 1, exReason: null, creator: 1 },
      { no: 'SR-2024-012', client: '马超', idNo: '610101199003033345', biz: '融资融券', status: 'pending_assign', expiry: addDays(now, -7), assigned: null, handler: 1, v: 1, suit: 0, risk: 0, bizOpen: 0, exReason: null, creator: 1 },

      { no: 'SR-2024-013', client: '黄英', idNo: '340101198706064456', biz: '科创板开通', status: 'pending_assign', expiry: addDays(now, 40), assigned: null, handler: 1, v: 1, suit: 1, risk: 1, bizOpen: 0, exReason: '被退回修改：业务开通材料缺失', creator: 1 },
      { no: 'SR-2024-014', client: '许杰', idNo: '220101199408085567', biz: '期权交易', status: 'transferred', expiry: addDays(now, 22), assigned: 2, handler: 2, v: 2, suit: 1, risk: 1, bizOpen: 1, exReason: null, creator: 1 },
      { no: 'SR-2024-015', client: '林芳', idNo: '350101199509096678', biz: '北交所开通', status: 'visited', expiry: addDays(now, 35), assigned: 3, handler: 3, v: 3, suit: 1, risk: 1, bizOpen: 1, exReason: null, creator: 1 },
    ];

    const txn = this.db.transaction(() => {
      for (const r of records) {
        const expStatus = this.calcExpiryStatus(fmt(r.expiry));
        insertRecord.run(
          r.no, r.client, r.idNo, r.biz, r.status, expStatus, fmt(r.expiry),
          r.assigned, r.handler, r.v, r.suit, r.risk, r.bizOpen, r.exReason, r.creator
        );
      }

      insertProcessing.run(3, 'assign', 'pending_assign', 'transferred', 1, 'financial_advisor', '分派给合规专员李四');
      insertProcessing.run(3, 'transfer', 'transferred', 'visited', 2, 'compliance_officer', '材料齐全，转办给营业部经理');
      insertProcessing.run(4, 'assign', 'pending_assign', 'transferred', 1, 'financial_advisor', '分派给合规专员李四');
      insertProcessing.run(5, 'assign', 'pending_assign', 'transferred', 1, 'financial_advisor', '分派给合规专员李四');
      insertProcessing.run(5, 'transfer', 'transferred', 'visited', 2, 'compliance_officer', '材料齐全，转办');
      insertProcessing.run(7, 'assign', 'pending_assign', 'transferred', 1, 'financial_advisor', '分派给合规专员李四');
      insertProcessing.run(9, 'assign', 'pending_assign', 'transferred', 1, 'financial_advisor', '分派给合规专员李四');
      insertProcessing.run(11, 'assign', 'pending_assign', 'transferred', 1, 'financial_advisor', '分派给合规专员李四');
      insertProcessing.run(14, 'assign', 'pending_assign', 'transferred', 1, 'financial_advisor', '分派给合规专员李四');
      insertProcessing.run(15, 'assign', 'pending_assign', 'transferred', 1, 'financial_advisor', '分派给合规专员李四');
      insertProcessing.run(15, 'transfer', 'transferred', 'visited', 2, 'compliance_officer', '材料齐全，转办');

      insertException.run(6, 'missing_material', '缺少适当性评估材料，需补充', 1, 0);
      insertException.run(7, 'missing_material', '缺少风险揭示书，需补充后重新审核', 2, 0);
      insertException.run(8, 'missing_material', '三项材料均缺失，需全部补充', 1, 0);
      insertException.run(9, 'missing_material', '缺少风险评估报告', 2, 0);
      insertException.run(10, 'timeout', '即将到期，请尽快处理', 1, 0);
      insertException.run(11, 'timeout', '已超过到期日，需紧急处理', 2, 0);
      insertException.run(12, 'timeout', '已逾期，需紧急处理', 1, 0);
      insertException.run(13, 'return_correction', '被退回修改：业务开通材料缺失', 1, 0);
    });

    txn();
  }

  private calcExpiryStatus(expiryDate: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'overdue';
    if (diffDays <= 30) return 'near_expiry';
    return 'normal';
  }

  getDb(): Database.Database {
    return this.db;
  }

  calcExpiryStatusForRecord(expiryDate: string): string {
    return this.calcExpiryStatus(expiryDate);
  }

  recalcExpiryStatus(recordId: number): string {
    const row = this.db.prepare('SELECT expiry_date FROM suitability_records WHERE id = ?').get(recordId) as { expiry_date: string } | undefined;
    if (!row) return 'normal';
    const status = this.calcExpiryStatus(row.expiry_date);
    this.db.prepare('UPDATE suitability_records SET expiry_status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, recordId);
    return status;
  }

  recalcAllExpiryStatuses(): void {
    const records = this.db.prepare('SELECT id, expiry_date FROM suitability_records').all() as Array<{ id: number; expiry_date: string }>;
    const update = this.db.prepare('UPDATE suitability_records SET expiry_status = ?, updated_at = datetime(\'now\') WHERE id = ?');
    const txn = this.db.transaction(() => {
      for (const r of records) {
        const status = this.calcExpiryStatus(r.expiry_date);
        update.run(status, r.id);
      }
    });
    txn();
  }
}
