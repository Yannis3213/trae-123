const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'orders.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('store_manager', 'qc_specialist', 'operations_manager')),
  store_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  manager_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  store_id INTEGER NOT NULL,
  order_date DATE NOT NULL,
  expected_arrival DATE,
  status TEXT NOT NULL DEFAULT 'pending_material' CHECK(status IN (
    'pending_material',
    'pending_acceptance',
    'pending_review',
    'exception',
    'recheck_pending',
    'completed',
    'rejected'
  )),
  current_handler TEXT NOT NULL,
  current_role TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  total_amount DECIMAL(12,2) DEFAULT 0,
  material_evidence JSON,
  acceptance_evidence JSON,
  inventory_evidence JSON,
  exception_reason TEXT,
  exception_type TEXT,
  deadline DATETIME,
  node_started_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  material_name TEXT NOT NULL,
  spec TEXT,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  arrived_quantity DECIMAL(10,2) DEFAULT 0,
  accepted_quantity DECIMAL(10,2) DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES store_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by INTEGER NOT NULL,
  upload_type TEXT NOT NULL CHECK(upload_type IN ('material', 'acceptance', 'inventory', 'correction')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES store_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS processing_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  operator_id INTEGER NOT NULL,
  operator_role TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  remark TEXT,
  evidence JSON,
  version INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES store_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  noted_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES store_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (noted_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exception_reasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  exception_type TEXT NOT NULL CHECK(exception_type IN (
    'missing_material',
    'timeout',
    'rejection',
    'status_conflict'
  )),
  description TEXT NOT NULL,
  detected_by INTEGER,
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT 0,
  resolved_by INTEGER,
  resolved_at DATETIME,
  resolution TEXT,
  FOREIGN KEY (order_id) REFERENCES store_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON store_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_handler ON store_orders(current_handler, current_role);
CREATE INDEX IF NOT EXISTS idx_orders_deadline ON store_orders(deadline);
CREATE INDEX IF NOT EXISTS idx_records_order ON processing_records(order_id);
CREATE INDEX IF NOT EXISTS idx_exception_order ON exception_reasons(order_id);
`);

console.log('数据库初始化完成:', dbPath);
db.close();
