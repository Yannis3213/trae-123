-- 打样任务表
CREATE TABLE IF NOT EXISTS sampling_tasks (
    id TEXT PRIMARY KEY,
    task_name TEXT NOT NULL,
    order_no TEXT NOT NULL,
    style_no TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending_assignment',
    current_handler TEXT NOT NULL,
    responsible_person TEXT NOT NULL,
    deadline DATETIME NOT NULL,
    sample_confirmation_status TEXT DEFAULT 'pending',
    mass_production_evidence TEXT DEFAULT 'missing',
    has_mass_production_evidence INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    last_updated_by TEXT NOT NULL,
    is_overdue INTEGER NOT NULL DEFAULT 0,
    overdue_reason TEXT,
    return_reason TEXT,
    abnormal_tags TEXT DEFAULT '[]'
);

-- 附件表
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    evidence_type TEXT,
    FOREIGN KEY (task_id) REFERENCES sampling_tasks(id) ON DELETE CASCADE
);

-- 处理记录表
CREATE TABLE IF NOT EXISTS processing_records (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    operator_role TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    handler_before TEXT,
    handler_after TEXT,
    opinion TEXT,
    result TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES sampling_tasks(id) ON DELETE CASCADE
);

-- 审计备注表
CREATE TABLE IF NOT EXISTS audit_notes (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    note_content TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES sampling_tasks(id) ON DELETE CASCADE
);

-- 异常原因表
CREATE TABLE IF NOT EXISTS abnormal_reasons (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    reason_type TEXT NOT NULL,
    description TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES sampling_tasks(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON sampling_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_handler ON sampling_tasks(current_handler);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON sampling_tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_responsible ON sampling_tasks(responsible_person);
CREATE INDEX IF NOT EXISTS idx_tasks_overdue ON sampling_tasks(is_overdue);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_records_task ON processing_records(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_abnormal_task ON abnormal_reasons(task_id);
