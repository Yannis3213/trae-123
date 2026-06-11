import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: Database.Database;

  onModuleInit() {
    const dbPath = path.join(process.cwd(), 'data', 'agri_coop.db');
    const fs = require('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createTables();
    console.log(`SQLite 数据库已初始化: ${dbPath}`);
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('agricultural_technician', 'cooperative_director', 'field_manager')),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS planting_tasks (
        id TEXT PRIMARY KEY,
        task_no TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending_assign' CHECK(status IN (
          'pending_assign', 'assigned', 'processing', 'transferred',
          'followed_up', 'archived', 'returned_for_correction'
        )),
        assignee_id TEXT,
        assignee_role TEXT,
        creator_id TEXT NOT NULL,
        creator_role TEXT NOT NULL,
        plan_name TEXT,
        plan_year INTEGER,
        plan_month INTEGER,
        deadline TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        exception_reason TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (assignee_id) REFERENCES users(id),
        FOREIGN KEY (creator_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS material_requisitions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        material_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        requisition_status TEXT NOT NULL DEFAULT 'pending' CHECK(requisition_status IN ('pending', 'approved', 'rejected', 'returned')),
        applicant_id TEXT NOT NULL,
        applicant_role TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        approved_at TEXT,
        remarks TEXT,
        FOREIGN KEY (task_id) REFERENCES planting_tasks(id)
      );

      CREATE TABLE IF NOT EXISTS field_records (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        record_date TEXT NOT NULL,
        record_type TEXT NOT NULL CHECK(record_type IN ('sowing', 'fertilizing', 'pest_control', 'harvesting', 'inspection', 'other')),
        content TEXT NOT NULL,
        recorder_id TEXT NOT NULL,
        recorder_role TEXT NOT NULL,
        weather TEXT,
        remarks TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (task_id) REFERENCES planting_tasks(id)
      );

      CREATE TABLE IF NOT EXISTS processing_records (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        processor_id TEXT NOT NULL,
        processor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('success', 'failure')),
        fail_reason TEXT,
        evidence TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (task_id) REFERENCES planting_tasks(id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_role TEXT NOT NULL,
        action TEXT NOT NULL,
        before_status TEXT,
        after_status TEXT,
        fail_reason TEXT,
        remarks TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (task_id) REFERENCES planting_tasks(id)
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        uploaded_by_role TEXT NOT NULL,
        uploaded_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (task_id) REFERENCES planting_tasks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON planting_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON planting_tasks(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON planting_tasks(deadline);
      CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_material_task ON material_requisitions(task_id);
      CREATE INDEX IF NOT EXISTS idx_field_task ON field_records(task_id);
      CREATE INDEX IF NOT EXISTS idx_processing_task ON processing_records(task_id);
    `);
  }

  getDb(): Database.Database {
    return this.db;
  }

  query(sql: string, params?: any[]) {
    return this.db.prepare(sql).all(...(params || []));
  }

  queryOne(sql: string, params?: any[]) {
    return this.db.prepare(sql).get(...(params || []));
  }

  run(sql: string, params?: any[]) {
    return this.db.prepare(sql).run(...(params || []));
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
