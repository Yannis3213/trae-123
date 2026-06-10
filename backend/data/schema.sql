PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('inspector', 'engineer', 'manager', 'admin')),
    name TEXT NOT NULL,
    region TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    capacity_mw REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patrol_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    station_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending_dispatch', 'in_progress', 'returned', 'reviewing', 'closed', 'cancelled')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    inspector_id INTEGER,
    engineer_id INTEGER,
    manager_id INTEGER,
    current_handler TEXT NOT NULL DEFAULT 'inspector',
    patrol_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    patrol_content TEXT,
    weather TEXT,
    temperature TEXT,
    patrol_evidence JSON,
    defect_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    previous_handler_id INTEGER,
    previous_opinion TEXT,
    previous_attachment TEXT,
    audit_remark TEXT,
    anomaly_reason TEXT,
    is_overdue INTEGER NOT NULL DEFAULT 0,
    overdue_level TEXT CHECK (overdue_level IN ('normal', 'near', 'overdue')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (inspector_id) REFERENCES users(id),
    FOREIGN KEY (engineer_id) REFERENCES users(id),
    FOREIGN KEY (manager_id) REFERENCES users(id),
    FOREIGN KEY (previous_handler_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_patrol_status ON patrol_orders(status);
CREATE INDEX IF NOT EXISTS idx_patrol_station ON patrol_orders(station_id);
CREATE INDEX IF NOT EXISTS idx_patrol_due ON patrol_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_patrol_handler ON patrol_orders(current_handler);

CREATE TABLE IF NOT EXISTS defect_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patrol_order_id INTEGER NOT NULL,
    defect_no TEXT UNIQUE NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
    category TEXT NOT NULL,
    reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deadline TEXT,
    status TEXT NOT NULL CHECK (status IN ('reported', 'in_progress', 'resolved', 'verified', 'rejected')) DEFAULT 'reported',
    reporter_id INTEGER,
    assignee_id INTEGER,
    evidence JSON,
    anomaly_reason TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patrol_order_id) REFERENCES patrol_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_defect_patrol ON defect_reports(patrol_order_id);
CREATE INDEX IF NOT EXISTS idx_defect_status ON defect_reports(status);

CREATE TABLE IF NOT EXISTS acceptance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    defect_id INTEGER NOT NULL,
    patrol_order_id INTEGER NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'pending')),
    evidence JSON,
    remark TEXT,
    acceptor_id INTEGER,
    accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    anomaly_reason TEXT,
    FOREIGN KEY (defect_id) REFERENCES defect_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (patrol_order_id) REFERENCES patrol_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (acceptor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_acceptance_defect ON acceptance_records(defect_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_patrol ON acceptance_records(patrol_order_id);

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patrol_order_id INTEGER,
    defect_id INTEGER,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    uploaded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patrol_order_id) REFERENCES patrol_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (defect_id) REFERENCES defect_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_trails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patrol_order_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_id INTEGER NOT NULL,
    actor_role TEXT NOT NULL,
    remark TEXT,
    anomaly_reason TEXT,
    evidence JSON,
    previous_opinion TEXT,
    previous_attachment TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patrol_order_id) REFERENCES patrol_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_patrol ON audit_trails(patrol_order_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_trails(created_at);

CREATE TABLE IF NOT EXISTS process_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patrol_order_id INTEGER NOT NULL,
    step_order INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    handler_id INTEGER,
    handler_role TEXT,
    status TEXT NOT NULL,
    opinion TEXT,
    evidence JSON,
    started_at TEXT,
    finished_at TEXT,
    anomaly_reason TEXT,
    correction_note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patrol_order_id) REFERENCES patrol_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (handler_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_process_patrol ON process_records(patrol_order_id);
CREATE INDEX IF NOT EXISTS idx_process_order ON process_records(patrol_order_id, step_order);

INSERT OR IGNORE INTO users (id, username, password, role, name, region) VALUES
    (1, 'admin', 'admin123', 'admin', '系统管理员', '总部'),
    (2, 'inspector01', 'ins123', 'inspector', '张伟-巡检员', '华北区'),
    (3, 'inspector02', 'ins123', 'inspector', '李娜-巡检员', '华东区'),
    (4, 'engineer01', 'eng123', 'engineer', '王强-运维工程师', '华北区'),
    (5, 'engineer02', 'eng123', 'engineer', '赵敏-运维工程师', '华东区'),
    (6, 'manager01', 'mgr123', 'manager', '陈刚-区域负责人', '华北区'),
    (7, 'manager02', 'mgr123', 'manager', '刘洋-区域负责人', '华东区');

INSERT OR IGNORE INTO stations (id, code, name, region, capacity_mw) VALUES
    (1, 'ST-HB-001', '华北一号光伏电站', '华北区', 50.0),
    (2, 'ST-HB-002', '华北二号光伏电站', '华北区', 30.0),
    (3, 'ST-HD-001', '华东一号光伏电站', '华东区', 80.0),
    (4, 'ST-HD-002', '华东二号光伏电站', '华东区', 45.0);
