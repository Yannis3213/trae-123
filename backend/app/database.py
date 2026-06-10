import sqlite3
import os
from contextlib import contextmanager
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "repair_orders.db")


def get_db_path() -> str:
    return DB_PATH


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        c = conn.cursor()

        c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS repair_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            owner_name TEXT,
            owner_phone TEXT,
            address TEXT,
            repair_type TEXT,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'pending_dispatch',
            priority TEXT DEFAULT 'normal',
            current_handler TEXT,
            current_handler_role TEXT,
            deadline TEXT,
            source_module TEXT NOT NULL DEFAULT 'owner_report',
            evidence_required INTEGER DEFAULT 0,
            version INTEGER DEFAULT 1,
            created_by TEXT,
            created_by_role TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            last_opinion TEXT,
            last_attachment_id INTEGER,
            is_overdue INTEGER DEFAULT 0,
            is_near_deadline INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_by TEXT,
            uploaded_by_role TEXT,
            submitted_version INTEGER,
            intercept_type TEXT,
            uploaded_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS processing_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            handler TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            opinion TEXT,
            evidence_provided INTEGER DEFAULT 0,
            version INTEGER,
            intercept_type TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            note_type TEXT NOT NULL,
            content TEXT NOT NULL,
            operator TEXT,
            operator_role TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS exception_reasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            reason_code TEXT NOT NULL,
            reason_text TEXT NOT NULL,
            field_name TEXT,
            detected_by TEXT,
            detected_by_role TEXT,
            resolved INTEGER DEFAULT 0,
            resolved_by TEXT,
            resolved_at TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (order_id) REFERENCES repair_orders(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_orders_status ON repair_orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_handler ON repair_orders(current_handler);
        CREATE INDEX IF NOT EXISTS idx_orders_deadline ON repair_orders(deadline);
        CREATE INDEX IF NOT EXISTS idx_records_order ON processing_records(order_id);
        CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_notes(order_id);
        CREATE INDEX IF NOT EXISTS idx_exception_order ON exception_reasons(order_id);

        """)

    # 字段升级（兼容旧库）
    with get_conn() as conn2:
        for sql in [
            "ALTER TABLE attachments ADD COLUMN submitted_version INTEGER",
            "ALTER TABLE attachments ADD COLUMN intercept_type TEXT",
            "ALTER TABLE processing_records ADD COLUMN intercept_type TEXT",
        ]:
            try:
                conn2.execute(sql)
            except sqlite3.OperationalError:
                pass  # 字段已存在，忽略
