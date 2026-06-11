const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'merchant_entry.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Existing database removed.');
}

const db = new Database(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE merchant_entry_forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_no TEXT UNIQUE NOT NULL,
    merchant_name TEXT NOT NULL,
    credit_code TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    business_type TEXT,
    registered_capital TEXT,
    business_scope TEXT,
    business_license_no TEXT,
    tax_registration_no TEXT,
    organization_code TEXT,
    legal_person_name TEXT,
    legal_person_id_card TEXT,
    bank_account_name TEXT,
    bank_account_no TEXT,
    bank_name TEXT,
    warehouse_address TEXT,
    office_address TEXT,
    current_node TEXT NOT NULL,
    status TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    current_handler TEXT,
    previous_handler TEXT,
    previous_opinion TEXT,
    previous_attachment_id INTEGER,
    deadline TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT,
    FOREIGN KEY (previous_attachment_id) REFERENCES attachments(id)
  );

  CREATE TABLE attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    file_path TEXT,
    upload_by TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES merchant_entry_forms(id) ON DELETE CASCADE
  );

  CREATE TABLE processing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    operation_type TEXT NOT NULL,
    operator TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    from_node TEXT,
    to_node TEXT,
    from_status TEXT,
    to_status TEXT,
    opinion TEXT,
    version INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES merchant_entry_forms(id) ON DELETE CASCADE
  );

  CREATE TABLE audit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    note_content TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES merchant_entry_forms(id) ON DELETE CASCADE
  );

  CREATE TABLE exception_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    exception_type TEXT NOT NULL,
    exception_detail TEXT NOT NULL,
    exception_node TEXT,
    created_by TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    resolved_by TEXT,
    resolved_at TEXT,
    resolution_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES merchant_entry_forms(id) ON DELETE CASCADE
  );

  CREATE TABLE batch_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL,
    form_id INTEGER,
    form_no TEXT,
    success INTEGER NOT NULL,
    error_type TEXT,
    error_message TEXT,
    operator TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_form_status ON merchant_entry_forms(status);
  CREATE INDEX idx_form_node ON merchant_entry_forms(current_node);
  CREATE INDEX idx_form_handler ON merchant_entry_forms(current_handler);
  CREATE INDEX idx_form_deadline ON merchant_entry_forms(deadline);
  CREATE INDEX idx_attach_form ON attachments(form_id);
  CREATE INDEX idx_record_form ON processing_records(form_id);
  CREATE INDEX idx_audit_form ON audit_notes(form_id);
  CREATE INDEX idx_exception_form ON exception_reasons(form_id);
  CREATE INDEX idx_batch_no ON batch_results(batch_no);
`);

console.log('Database initialized successfully.');
console.log('Tables created: users, merchant_entry_forms, attachments, processing_records, audit_notes, exception_reasons, batch_results');

db.close();
