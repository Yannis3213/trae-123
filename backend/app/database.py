import aiosqlite
import asyncio
from pathlib import Path
from .config import get_settings

settings = get_settings()

DB_PATH = Path(__file__).parent.parent / "data" / "exhibitor.db"


async def get_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        await conn.close()


async def init_database():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row

    async with conn.cursor() as cur:
        await cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        await cur.execute("""
        CREATE TABLE IF NOT EXISTS exhibitor_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_no TEXT UNIQUE NOT NULL,
            company_name TEXT NOT NULL,
            contact_person TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            contact_email TEXT,
            exhibition_type TEXT NOT NULL,
            booth_area REAL,
            booth_preference TEXT,
            status TEXT NOT NULL,
            queue TEXT NOT NULL,
            current_handler TEXT,
            version INTEGER DEFAULT 1,
            is_overdue BOOLEAN DEFAULT 0,
            warning_level TEXT DEFAULT 'normal',
            deadline TIMESTAMP,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT NOT NULL,
            booth_confirmation_evidence TEXT,
            sync_status TEXT DEFAULT 'pending'
        )
        """)

        await cur.execute("""
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            uploaded_by TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES exhibitor_applications(id) ON DELETE CASCADE
        )
        """)

        await cur.execute("""
        CREATE TABLE IF NOT EXISTS processing_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            handler TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            comment TEXT,
            correction_reason TEXT,
            reject_reason TEXT,
            evidence_required TEXT,
            previous_handler TEXT,
            version INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES exhibitor_applications(id) ON DELETE CASCADE
        )
        """)

        await cur.execute("""
        CREATE TABLE IF NOT EXISTS audit_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            note TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES exhibitor_applications(id) ON DELETE CASCADE
        )
        """)

        await cur.execute("""
        CREATE TABLE IF NOT EXISTS batch_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_no TEXT UNIQUE NOT NULL,
            operation_type TEXT NOT NULL,
            operator TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            total_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            fail_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        await cur.execute("""
        CREATE TABLE IF NOT EXISTS batch_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            application_id INTEGER NOT NULL,
            success BOOLEAN NOT NULL,
            error_code TEXT,
            error_message TEXT,
            FOREIGN KEY (batch_id) REFERENCES batch_operations(id) ON DELETE CASCADE,
            FOREIGN KEY (application_id) REFERENCES exhibitor_applications(id) ON DELETE CASCADE
        )
        """)

        await cur.execute("CREATE INDEX IF NOT EXISTS idx_app_status ON exhibitor_applications(status)")
        await cur.execute("CREATE INDEX IF NOT EXISTS idx_app_queue ON exhibitor_applications(queue)")
        await cur.execute("CREATE INDEX IF NOT EXISTS idx_app_handler ON exhibitor_applications(current_handler)")
        await cur.execute("CREATE INDEX IF NOT EXISTS idx_app_sync ON exhibitor_applications(sync_status)")
        await cur.execute("CREATE INDEX IF NOT EXISTS idx_records_app ON processing_records(application_id)")

    await conn.commit()
    await conn.close()
