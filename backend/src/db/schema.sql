CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  real_name VARCHAR(50) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('reimbursement_clerk', 'expense_accountant', 'finance_manager')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reimbursement_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_no VARCHAR(50) NOT NULL UNIQUE,
  applicant_id INTEGER NOT NULL,
  applicant_name VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('travel', 'entertainment', 'office', 'other')),
  status VARCHAR(30) NOT NULL CHECK (status IN ('pending_review', 'reviewing', 'verifying', 'confirming', 'exception', 'completed', 'rejected', 'returned')),
  current_handler INTEGER,
  current_handler_role VARCHAR(30),
  due_date DATETIME,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_overdue BOOLEAN DEFAULT 0,
  payment_evidence TEXT,
  FOREIGN KEY (applicant_id) REFERENCES users(id),
  FOREIGN KEY (current_handler) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_url VARCHAR(500) NOT NULL,
  uploader_id INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN ('invoice', 'receipt', 'contract', 'other')),
  FOREIGN KEY (application_id) REFERENCES reimbursement_applications(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS process_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  operator_id INTEGER NOT NULL,
  operator_name VARCHAR(50) NOT NULL,
  operator_role VARCHAR(30) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  action VARCHAR(30) NOT NULL CHECK (action IN ('submit', 'review', 'verify', 'confirm', 'return', 'reject', 'exception', 'rectify')),
  comment TEXT,
  evidence_snapshot JSON,
  version INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES reimbursement_applications(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  operator_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES reimbursement_applications(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS exception_reasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL,
  process_record_id INTEGER,
  reason_code VARCHAR(50) NOT NULL CHECK (reason_code IN ('missing_evidence', 'timeout', 'state_conflict', 'returned_rectify', 'risky_amount')),
  reason_detail TEXT,
  handler_id INTEGER,
  resolved BOOLEAN DEFAULT 0,
  resolved_at DATETIME,
  rectify_note TEXT,
  FOREIGN KEY (application_id) REFERENCES reimbursement_applications(id),
  FOREIGN KEY (process_record_id) REFERENCES process_records(id),
  FOREIGN KEY (handler_id) REFERENCES users(id)
);
