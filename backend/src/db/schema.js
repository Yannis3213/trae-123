const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  store_id TEXT,
  area_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescription_orders (
  id TEXT PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,
  patient_name TEXT NOT NULL,
  patient_id_card TEXT,
  store_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  area_id TEXT NOT NULL,
  area_name TEXT NOT NULL,
  drugs_count INTEGER NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  handler_role TEXT,
  handler_id TEXT,
  handler_name TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_at DATETIME NOT NULL,
  abnormal_reason TEXT,
  abnormal_type TEXT,
  correction_note TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_by_name TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES prescription_orders(id)
);

CREATE TABLE IF NOT EXISTS processing_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_version INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  handler_id TEXT NOT NULL,
  handler_name TEXT NOT NULL,
  handler_role TEXT NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES prescription_orders(id)
);

CREATE TABLE IF NOT EXISTS audit_notes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_version INTEGER NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  action TEXT NOT NULL,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES prescription_orders(id)
);

CREATE TABLE IF NOT EXISTS abnormal_reasons (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  abnormal_type TEXT NOT NULL,
  description TEXT NOT NULL,
  responsible_person TEXT,
  reported_by TEXT NOT NULL,
  reported_by_name TEXT NOT NULL,
  reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN NOT NULL DEFAULT 0,
  resolved_by TEXT,
  resolved_at DATETIME,
  FOREIGN KEY (order_id) REFERENCES prescription_orders(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON prescription_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_handler ON prescription_orders(handler_id, handler_role);
CREATE INDEX IF NOT EXISTS idx_orders_due ON prescription_orders(due_at);
CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id);
CREATE INDEX IF NOT EXISTS idx_records_order ON processing_records(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_abnormal_order ON abnormal_reasons(order_id);
`;

module.exports = SCHEMA_SQL;
