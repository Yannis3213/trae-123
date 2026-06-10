use anyhow::{Context, Result};
use rusqlite::Connection;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
}

impl AppState {
    pub fn new() -> Result<Self> {
        let cwd = env::current_dir().context("Failed to get current directory")?;
        let data_dir = cwd.join("data");
        fs::create_dir_all(&data_dir).ok();

        let db_path = data_dir.join("patrol.db");
        let db_exists = Path::new(&db_path).exists();

        let conn = Connection::open(&db_path)
            .with_context(|| format!("Failed to open database at {:?}", db_path))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let schema_path = data_dir.join("schema.sql");
        let schema = fs::read_to_string(&schema_path)
            .with_context(|| format!("Failed to read schema.sql at {:?}", schema_path))?;
        conn.execute_batch(&schema)
            .context("Failed to execute schema.sql")?;

        let should_seed = if db_exists {
            let user_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))
                .unwrap_or(0);
            user_count == 0
        } else {
            true
        };

        if should_seed {
            let seed_path = data_dir.join("seed.sql");
            if let Ok(seed) = fs::read_to_string(&seed_path) {
                conn.execute_batch(&seed)
                    .context("Failed to execute seed.sql")?;
            }
        }

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
