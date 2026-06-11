use parking_lot::Mutex;
use rusqlite::{params, Connection, Error as RusqliteError, OptionalExtension};
use std::path::PathBuf;
use std::sync::Arc;
use anyhow::{Result, Context};
use chrono::Utc;

pub mod models;

pub use models::*;

#[derive(Clone)]
pub struct DbPool {
    inner: Arc<DbPoolInner>,
}

struct DbPoolInner {
    conn: Mutex<Connection>,
    path: PathBuf,
}

impl DbPool {
    pub fn new() -> Result<Self> {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../database/legal_service.db");
        
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create database directory: {:?}", parent))?;
        }

        let conn = Connection::open(&path)
            .with_context(|| format!("Failed to open database at: {:?}", path))?;
        
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .context("Failed to enable foreign keys")?;

        let pool = Self {
            inner: Arc::new(DbPoolInner {
                conn: Mutex::new(conn),
                path,
            }),
        };

        pool.init_schema()?;
        
        Ok(pool)
    }

    fn init_schema(&self) -> Result<()> {
        let schema_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../database/schema.sql");
        
        let schema = std::fs::read_to_string(&schema_path)
            .with_context(|| format!("Failed to read schema file: {:?}", schema_path))?;
        
        self.with_conn(|conn| {
            conn.execute_batch(&schema)
                .context("Failed to execute schema")
        })?;

        log::info!("Database schema initialized successfully");
        Ok(())
    }

    pub fn with_conn<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T, RusqliteError>,
    {
        let conn = self.inner.conn.lock();
        f(&conn).map_err(|e| anyhow::anyhow!(e))
    }

    pub fn path(&self) -> &PathBuf {
        &self.inner.path
    }
}

impl std::fmt::Debug for DbPool {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DbPool")
            .field("path", &self.inner.path)
            .finish()
    }
}

pub fn init_db() -> Result<DbPool> {
    DbPool::new()
}

#[derive(Clone)]
pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(path: PathBuf) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create database directory: {:?}", parent))?;
        }

        let conn = Connection::open(&path)
            .with_context(|| format!("Failed to open database at: {:?}", path))?;
        
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .context("Failed to enable foreign keys")?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };

        db.init_schema()?;
        
        Ok(db)
    }

    pub fn init_schema(&self) -> Result<()> {
        let schema_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../database/schema.sql");
        
        let schema = std::fs::read_to_string(&schema_path)
            .with_context(|| format!("Failed to read schema file: {:?}", schema_path))?;
        
        let conn = self.conn.lock();
        conn.execute_batch(&schema)
            .context("Failed to execute schema")?;

        log::info!("Database schema initialized successfully");
        Ok(())
    }

    pub fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        let conn = self.conn.lock();
        let mut stmt = conn.prepare(
            "SELECT id, username, password_hash, real_name, role, department, created_at, updated_at 
             FROM users WHERE username = ?1"
        )?;
        
        let user = stmt.query_row(params![username], |row| {
            User::from_row(row)
        }).optional()?;
        
        Ok(user)
    }

    pub fn create_user(&self, username: &str, password_hash: &str, real_name: &str, role: &UserRole, department: Option<&str>) -> Result<i64> {
        let conn = self.conn.lock();
        let now = Utc::now();
        
        conn.execute(
            "INSERT INTO users (username, password_hash, real_name, role, department, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                username,
                password_hash,
                real_name,
                role.as_str(),
                department,
                now,
                now
            ],
        )?;
        
        Ok(conn.last_insert_rowid())
    }
}
