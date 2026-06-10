use sqlx::{sqlite::SqlitePoolOptions, SqlitePool, Executor};
use std::path::Path;
use anyhow::Result;

pub type DbPool = SqlitePool;

pub async fn init_db_with_migrations(database_url: &str) -> Result<DbPool> {
    let db_path = database_url.trim_start_matches("sqlite:");
    let db_path = db_path.split('?').next().unwrap_or("");
    
    if !Path::new(db_path).exists() {
        if let Some(parent) = Path::new(db_path).parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;

    let migration_sql = include_str!("../../migrations/001_init.sql");
    sqlx::query(migration_sql).execute(&pool).await?;

    Ok(pool)
}
