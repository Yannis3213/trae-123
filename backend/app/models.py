TABLE_DDL = [
    """CREATE TABLE IF NOT EXISTS repair_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    enterprise_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    category TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending_submit',
    current_handler_role TEXT NOT NULL,
    current_handler_id TEXT NOT NULL,
    current_handler_name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    deadline TEXT NOT NULL,
    return_reason TEXT,
    return_opinion TEXT,
    correction_reason TEXT,
    last_handler_id TEXT,
    last_handler_result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);""",
    """CREATE TABLE IF NOT EXISTS processing_records (
    id TEXT PRIMARY KEY,
    repair_id TEXT NOT NULL REFERENCES repair_orders(id),
    action TEXT NOT NULL,
    handler_id TEXT NOT NULL,
    handler_name TEXT NOT NULL,
    handler_role TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    opinion TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);""",
    """CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    repair_id TEXT NOT NULL REFERENCES repair_orders(id),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);""",
    """CREATE TABLE IF NOT EXISTS audit_notes (
    id TEXT PRIMARY KEY,
    repair_id TEXT NOT NULL REFERENCES repair_orders(id),
    note_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);""",
    """CREATE TABLE IF NOT EXISTS exception_reasons (
    id TEXT PRIMARY KEY,
    repair_id TEXT NOT NULL REFERENCES repair_orders(id),
    exception_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    detail TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
);""",
    """CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL
);""",
]

INDEX_DDL = [
    "CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status);",
    "CREATE INDEX IF NOT EXISTS idx_repair_orders_created_by ON repair_orders(created_by);",
    "CREATE INDEX IF NOT EXISTS idx_repair_orders_current_handler_id ON repair_orders(current_handler_id);",
    "CREATE INDEX IF NOT EXISTS idx_repair_orders_current_handler_role ON repair_orders(current_handler_role);",
    "CREATE INDEX IF NOT EXISTS idx_repair_orders_order_no ON repair_orders(order_no);",
    "CREATE INDEX IF NOT EXISTS idx_repair_orders_deadline ON repair_orders(deadline);",
    "CREATE INDEX IF NOT EXISTS idx_processing_records_repair_id ON processing_records(repair_id);",
    "CREATE INDEX IF NOT EXISTS idx_processing_records_handler_id ON processing_records(handler_id);",
    "CREATE INDEX IF NOT EXISTS idx_attachments_repair_id ON attachments(repair_id);",
    "CREATE INDEX IF NOT EXISTS idx_audit_notes_repair_id ON audit_notes(repair_id);",
    "CREATE INDEX IF NOT EXISTS idx_exception_reasons_repair_id ON exception_reasons(repair_id);",
    "CREATE INDEX IF NOT EXISTS idx_exception_reasons_resolved ON exception_reasons(resolved);",
    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);",
]


def create_tables(conn):
    cursor = conn.cursor()
    for ddl in TABLE_DDL:
        cursor.execute(ddl)
    for ddl in INDEX_DDL:
        cursor.execute(ddl)
    conn.commit()
