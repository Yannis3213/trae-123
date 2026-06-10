use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::params;
use std::fs;
use std::path::Path;

pub type DbPool = r2d2::Pool<SqliteConnectionManager>;

pub fn init_db_pool(db_path: &str) -> DbPool {
    let manager = SqliteConnectionManager::file(db_path);
    r2d2::Pool::builder()
        .max_size(8)
        .build(manager)
        .expect("Failed to create DB pool")
}

pub fn init_database(db_path: &str) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = Path::new(db_path).parent() {
        fs::create_dir_all(parent).ok();
    }

    let manager = SqliteConnectionManager::file(db_path);
    let pool = r2d2::Pool::builder()
        .max_size(2)
        .build(manager)?;
    let conn = pool.get()?;

    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS replenishment_applications (
            id TEXT PRIMARY KEY,
            application_no TEXT UNIQUE NOT NULL,
            store_id TEXT NOT NULL,
            store_name TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            responsible_person TEXT NOT NULL,
            current_handler TEXT NOT NULL,
            deadline TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            exception_tags TEXT NOT NULL DEFAULT '[]',
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            is_evidence INTEGER NOT NULL DEFAULT 0,
            file_content_base64 TEXT,
            FOREIGN KEY (application_id) REFERENCES replenishment_applications(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS processing_records (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            action TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            result TEXT,
            return_reason TEXT,
            processed_at TEXT NOT NULL,
            FOREIGN KEY (application_id) REFERENCES replenishment_applications(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_notes (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_name TEXT NOT NULL,
            note TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (application_id) REFERENCES replenishment_applications(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS exception_logs (
            id TEXT PRIMARY KEY,
            application_id TEXT NOT NULL,
            exception_type TEXT NOT NULL,
            description TEXT NOT NULL,
            operator_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (application_id) REFERENCES replenishment_applications(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_app_status ON replenishment_applications(status);
        CREATE INDEX IF NOT EXISTS idx_app_handler ON replenishment_applications(current_handler);
        CREATE INDEX IF NOT EXISTS idx_app_deadline ON replenishment_applications(deadline);
        CREATE INDEX IF NOT EXISTS idx_records_app ON processing_records(application_id);
        ",
    )?;

    Ok(())
}

pub fn insert_user(
    conn: &rusqlite::Connection,
    id: &str,
    username: &str,
    display_name: &str,
    role: &str,
    created_at: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO users (id, username, display_name, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, username, display_name, role, created_at],
    )?;
    Ok(())
}
