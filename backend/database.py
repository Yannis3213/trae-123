import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'loan_system.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS loan_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_no TEXT UNIQUE NOT NULL,
        applicant_name TEXT NOT NULL,
        id_card TEXT NOT NULL,
        phone TEXT NOT NULL,
        amount REAL NOT NULL,
        purpose TEXT,
        term_months INTEGER DEFAULT 12,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        current_node TEXT NOT NULL DEFAULT 'APPLICATION',
        current_handler TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        version INTEGER DEFAULT 1,
        verification_due_date TEXT,
        due_date TEXT,
        remark TEXT
    );

    CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_application_id INTEGER NOT NULL,
        attach_type TEXT NOT NULL,
        attach_name TEXT NOT NULL,
        file_path TEXT,
        is_required INTEGER DEFAULT 0,
        node TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id)
    );

    CREATE TABLE IF NOT EXISTS processing_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_application_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        handler TEXT NOT NULL,
        handler_role TEXT NOT NULL,
        node TEXT NOT NULL,
        remark TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id)
    );

    CREATE TABLE IF NOT EXISTS audit_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_application_id INTEGER NOT NULL,
        note TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id)
    );

    CREATE TABLE IF NOT EXISTS exception_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_application_id INTEGER NOT NULL,
        exception_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        detail TEXT,
        detected_by TEXT NOT NULL,
        detected_at TEXT DEFAULT (datetime('now', 'localtime')),
        resolved_at TEXT,
        resolution TEXT,
        FOREIGN KEY (loan_application_id) REFERENCES loan_applications(id)
    );
    ''')

    conn.commit()
    conn.close()
    print('数据库初始化完成')


if __name__ == '__main__':
    init_db()
