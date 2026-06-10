import sqlite3
import os
from contextlib import contextmanager
from .config import settings


def get_db_path() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    project_root = os.path.dirname(base_dir)
    db_rel = settings.DB_PATH
    if not os.path.isabs(db_rel):
        db_path = os.path.join(project_root, db_rel)
    else:
        db_path = db_rel
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    return db_path


@contextmanager
def get_connection():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    with get_connection() as conn:
        cur = conn.cursor()
        cur.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            real_name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_code TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            contact_person TEXT,
            contact_phone TEXT,
            address TEXT,
            voltage_level TEXT,
            monthly_usage_kwh REAL,
            industry TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pricing_calculations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            calculation_code TEXT UNIQUE NOT NULL,
            customer_id INTEGER NOT NULL,
            contract_term_months INTEGER DEFAULT 12,
            base_price REAL NOT NULL,
            peak_price REAL,
            valley_price REAL,
            expected_annual_kwh REAL,
            estimated_annual_amount REAL,
            discount_rate REAL DEFAULT 0,
            status TEXT DEFAULT 'draft',
            created_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE IF NOT EXISTS sale_contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_no TEXT UNIQUE NOT NULL,
            customer_id INTEGER NOT NULL,
            pricing_id INTEGER,
            contract_name TEXT NOT NULL,
            contract_amount REAL DEFAULT 0,
            term_start_date TEXT,
            term_end_date TEXT,
            sign_date TEXT,
            deadline TEXT NOT NULL,
            current_stage TEXT NOT NULL DEFAULT 'customer_manager',
            status TEXT NOT NULL DEFAULT '待提交',
            version INTEGER NOT NULL DEFAULT 1,
            current_handler_id INTEGER,
            previous_handler_id INTEGER,
            previous_opinion TEXT,
            audit_remark TEXT,
            created_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (pricing_id) REFERENCES pricing_calculations(id)
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            uploaded_by INTEGER,
            stage TEXT,
            uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contract_id) REFERENCES sale_contracts(id)
        );

        CREATE TABLE IF NOT EXISTS processing_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id INTEGER NOT NULL,
            stage TEXT NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            handler_id INTEGER NOT NULL,
            handler_name TEXT,
            handler_role TEXT,
            opinion TEXT,
            evidence_json TEXT,
            version INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contract_id) REFERENCES sale_contracts(id)
        );

        CREATE TABLE IF NOT EXISTS audit_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id INTEGER NOT NULL,
            note TEXT NOT NULL,
            noted_by INTEGER,
            noted_by_name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contract_id) REFERENCES sale_contracts(id)
        );

        CREATE TABLE IF NOT EXISTS exception_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_id INTEGER NOT NULL,
            exception_type TEXT NOT NULL,
            exception_code TEXT NOT NULL,
            message TEXT NOT NULL,
            detail_json TEXT,
            stage TEXT,
            triggered_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contract_id) REFERENCES sale_contracts(id)
        );

        CREATE INDEX IF NOT EXISTS idx_contracts_status ON sale_contracts(status);
        CREATE INDEX IF NOT EXISTS idx_contracts_stage ON sale_contracts(current_stage);
        CREATE INDEX IF NOT EXISTS idx_contracts_deadline ON sale_contracts(deadline);
        CREATE INDEX IF NOT EXISTS idx_records_contract ON processing_records(contract_id);
        CREATE INDEX IF NOT EXISTS idx_attach_contract ON attachments(contract_id);
        CREATE INDEX IF NOT EXISTS idx_audit_contract ON audit_notes(contract_id);
        CREATE INDEX IF NOT EXISTS idx_except_contract ON exception_records(contract_id);
        """)
