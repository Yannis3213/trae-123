use anyhow::{Context, Result};
use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

impl AppState {
    pub fn new() -> Result<Self> {
        let db_path = PathBuf::from("data/patrol.db");
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&db_path)
            .with_context(|| format!("Failed to open database at {:?}", db_path))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let schema = fs::read_to_string("data/schema.sql")
            .context("Failed to read schema.sql")?;
        conn.execute_batch(&schema)
            .context("Failed to execute schema.sql")?;

        let seed = fs::read_to_string("data/seed.sql")
            .context("Failed to read seed.sql")?;
        conn.execute_batch(&seed)
            .context("Failed to execute seed.sql")?;

        Ok(Self {
            db: Mutex::new(conn),
        })
    }
}

pub fn json_from_row<T: serde::de::DeserializeOwned>(value: &rusqlite::types::Value) -> Result<T> {
    match value {
        rusqlite::types::Value::Text(s) => {
            serde_json::from_str(s).map_err(|e| anyhow::anyhow!("JSON parse error: {}", e))
        }
        rusqlite::types::Value::Null => {
            serde_json::from_str("null").map_err(|e| anyhow::anyhow!("JSON parse error: {}", e))
        }
        _ => Err(anyhow::anyhow!("Unexpected value type for JSON")),
    }
}

pub fn json_to_params<T: serde::Serialize>(value: &T) -> Result<serde_json::Value> {
    Ok(serde_json::to_value(value)?)
}
