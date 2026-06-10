import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_ROOT = resolve(__dirname, "..", "..");
export const DATA_DIR = join(BACKEND_ROOT, "data");
export const DB_PATH = join(DATA_DIR, "dispatch.db");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('dispatcher', 'route_supervisor', 'ops_center'))
  );

  CREATE TABLE IF NOT EXISTS dispatch_plans (
    id TEXT PRIMARY KEY,
    plan_number TEXT UNIQUE NOT NULL,
    route_name TEXT NOT NULL,
    plan_date TEXT NOT NULL,
    vehicle_id TEXT NOT NULL DEFAULT '',
    driver_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_review','reviewing','pending_approval','approving','archived','returned')),
    due_date TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    current_handler TEXT NOT NULL DEFAULT '',
    current_role TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('vehicle_schedule','driver_checkin','dispatch_confirm','other')),
    file_name TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES dispatch_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS processing_records (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('created','submitted','reviewing','approved','rejected','corrected','archived')),
    handler_id TEXT NOT NULL,
    handler_role TEXT NOT NULL,
    comment TEXT,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES dispatch_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (handler_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_notes (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    note_type TEXT NOT NULL CHECK(note_type IN ('pending_sign','exception_return','sign_complete')),
    content TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES dispatch_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS exception_reasons (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    record_id TEXT,
    reason_code TEXT,
    reason_detail TEXT NOT NULL,
    responsible_role TEXT NOT NULL CHECK(responsible_role IN ('dispatcher','route_supervisor','ops_center')),
    responsible_user_id TEXT,
    action TEXT,
    status TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES dispatch_plans(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_plans_status ON dispatch_plans(status);
  CREATE INDEX IF NOT EXISTS idx_plans_handler ON dispatch_plans(current_handler);
  CREATE INDEX IF NOT EXISTS idx_plans_role ON dispatch_plans(current_role);
  CREATE INDEX IF NOT EXISTS idx_attachments_plan ON attachments(plan_id);
  CREATE INDEX IF NOT EXISTS idx_records_plan ON processing_records(plan_id);
  CREATE INDEX IF NOT EXISTS idx_audit_plan ON audit_notes(plan_id);
`);

export default db;
