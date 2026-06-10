import aiosqlite
import os
from pathlib import Path

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "bank.db")


async def get_db():
    Path(os.path.dirname(DB_PATH)).mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys = ON")
    return db


async def init_db():
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                real_name TEXT NOT NULL,
                role TEXT NOT NULL,
                branch TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS account_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_no TEXT UNIQUE NOT NULL,
                customer_name TEXT NOT NULL,
                id_card_no TEXT NOT NULL,
                phone TEXT NOT NULL,
                address TEXT,
                account_type TEXT NOT NULL DEFAULT '个人储蓄卡',
                amount REAL DEFAULT 0,
                status TEXT NOT NULL DEFAULT '待签收',
                current_handler TEXT,
                current_role TEXT,
                customer_manager TEXT NOT NULL,
                branch TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                due_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                uploaded_by TEXT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS processing_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                from_status TEXT,
                to_status TEXT,
                operator TEXT NOT NULL,
                operator_role TEXT NOT NULL,
                remark TEXT,
                evidence_required TEXT,
                evidence_provided TEXT,
                version_before INTEGER,
                version_after INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                note TEXT NOT NULL,
                noted_by TEXT NOT NULL,
                noted_by_role TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS exception_reasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                reason_type TEXT NOT NULL,
                description TEXT NOT NULL,
                reported_by TEXT NOT NULL,
                reported_by_role TEXT NOT NULL,
                is_resolved INTEGER NOT NULL DEFAULT 0,
                resolved_by TEXT,
                resolved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_app_status ON account_applications(status);
            CREATE INDEX IF NOT EXISTS idx_app_handler ON account_applications(current_handler);
            CREATE INDEX IF NOT EXISTS idx_app_due ON account_applications(due_date);
            CREATE INDEX IF NOT EXISTS idx_records_app ON processing_records(application_id);
            CREATE INDEX IF NOT EXISTS idx_exceptions_app ON exception_reasons(application_id);
        """)
        await db.commit()
    finally:
        await db.close()
