CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    case_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    case_type TEXT NOT NULL,
    location TEXT NOT NULL,
    reporter_name TEXT NOT NULL,
    reporter_phone TEXT NOT NULL,
    status TEXT NOT NULL,
    current_stage TEXT NOT NULL,
    current_handler_id TEXT,
    current_handler_name TEXT,
    registration_materials_complete INTEGER NOT NULL DEFAULT 0,
    dispatch_timeline_met INTEGER NOT NULL DEFAULT 1,
    followup_evidence_complete INTEGER NOT NULL DEFAULT 0,
    deadline TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_by_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    category TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_by_name TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS processing_records (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    handler_id TEXT NOT NULL,
    handler_name TEXT NOT NULL,
    handler_role TEXT NOT NULL,
    remarks TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_notes (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    note TEXT NOT NULL,
    anomaly_reason TEXT,
    noted_by TEXT NOT NULL,
    noted_by_name TEXT NOT NULL,
    noted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_stage ON cases(current_stage);
CREATE INDEX IF NOT EXISTS idx_cases_deadline ON cases(deadline);
CREATE INDEX IF NOT EXISTS idx_attachments_case ON attachments(case_id);
CREATE INDEX IF NOT EXISTS idx_records_case ON processing_records(case_id);
CREATE INDEX IF NOT EXISTS idx_notes_case ON audit_notes(case_id);
