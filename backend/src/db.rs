use rusqlite::Connection;
use std::fs;
use std::path::Path;

use crate::models::*;

pub fn init_db() -> Result<Connection, rusqlite::Error> {
    let db_dir = Path::new("data");
    if !db_dir.exists() {
        fs::create_dir_all(db_dir).expect("Failed to create data directory");
    }
    let db_path = db_dir.join("app.db");
    let conn = Connection::open(&db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    create_tables(&conn)?;
    seed_data(&conn)?;
    Ok(conn)
}

fn create_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            display_name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_orders (
            id TEXT PRIMARY KEY,
            order_no TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            expiry_date TEXT NOT NULL,
            creator_id TEXT NOT NULL,
            current_handler_id TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (creator_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS nanny_profiles (
            id TEXT PRIMARY KEY,
            audit_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            id_card TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            service_type TEXT NOT NULL DEFAULT '',
            work_experience TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (audit_id) REFERENCES audit_orders(id)
        );
        CREATE TABLE IF NOT EXISTS qualification_reviews (
            id TEXT PRIMARY KEY,
            audit_id TEXT UNIQUE NOT NULL,
            health_cert TEXT NOT NULL DEFAULT '',
            health_cert_expiry TEXT NOT NULL DEFAULT '',
            training_cert TEXT NOT NULL DEFAULT '',
            training_cert_expiry TEXT NOT NULL DEFAULT '',
            background_check TEXT NOT NULL DEFAULT '',
            background_check_result TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (audit_id) REFERENCES audit_orders(id)
        );
        CREATE TABLE IF NOT EXISTS on_duty_confirmations (
            id TEXT PRIMARY KEY,
            audit_id TEXT UNIQUE NOT NULL,
            on_duty_date TEXT NOT NULL DEFAULT '',
            service_area TEXT NOT NULL DEFAULT '',
            contract_no TEXT NOT NULL DEFAULT '',
            confirmation_status TEXT NOT NULL DEFAULT '',
            FOREIGN KEY (audit_id) REFERENCES audit_orders(id)
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            audit_id TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT NOT NULL DEFAULT '',
            to_status TEXT NOT NULL DEFAULT '',
            comment TEXT NOT NULL DEFAULT '',
            exception_reason TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (audit_id) REFERENCES audit_orders(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        );"
    )?;
    Ok(())
}

fn seed_data(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    conn.execute_batch(
        "INSERT INTO users (id, username, password_hash, role, display_name) VALUES
            ('u1', 'dispatcher', 'demo123', 'dispatcher', '调度员张三'),
            ('u2', 'supervisor', 'demo123', 'supervisor', '主管李四'),
            ('u3', 'manager', 'demo123', 'manager', '经理王五');

        INSERT INTO audit_orders (id, order_no, status, expiry_date, creator_id, current_handler_id, version, created_at, updated_at) VALUES
            ('a1', 'AUD-2026-001', 'pending', '2026-07-15', 'u1', NULL, 1, '2026-06-10T09:00:00Z', '2026-06-10T09:00:00Z'),
            ('a2', 'AUD-2026-002', 'pending', '2026-07-10', 'u1', NULL, 1, '2026-06-08T10:30:00Z', '2026-06-08T10:30:00Z'),
            ('a3', 'AUD-2026-003', 'processing', '2026-06-05', 'u1', 'u2', 2, '2026-05-20T14:00:00Z', '2026-06-01T11:00:00Z'),
            ('a4', 'AUD-2026-004', 'correction_needed', '2026-07-20', 'u1', 'u2', 3, '2026-05-25T08:00:00Z', '2026-06-05T16:00:00Z');

        INSERT INTO nanny_profiles (id, audit_id, name, id_card, phone, service_type, work_experience) VALUES
            ('np1', 'a1', '王小花', '110101199001011234', '13800001111', '育婴师', '5年育婴经验'),
            ('np2', 'a2', '李小芳', '', '13800002222', '月嫂', '3年月嫂经验'),
            ('np3', 'a3', '张大梅', '110101198505052345', '13800003333', '家政保洁', '8年保洁经验'),
            ('np4', 'a4', '赵小丽', '110101199203033456', '13800004444', '养老护理', '4年养老护理经验');

        INSERT INTO qualification_reviews (id, audit_id, health_cert, health_cert_expiry, training_cert, training_cert_expiry, background_check, background_check_result) VALUES
            ('qr1', 'a1', 'yes', '2027-01-01', 'yes', '2027-06-01', 'yes', 'pass'),
            ('qr2', 'a2', 'yes', '2027-03-01', '', '', 'yes', 'pass'),
            ('qr3', 'a3', 'yes', '2026-12-01', 'yes', '2027-01-01', 'yes', 'pass'),
            ('qr4', 'a4', 'yes', '2027-02-01', 'yes', '2027-03-01', 'yes', 'pass');

        INSERT INTO on_duty_confirmations (id, audit_id, on_duty_date, service_area, contract_no, confirmation_status) VALUES
            ('od1', 'a1', '', '', '', ''),
            ('od2', 'a2', '', '', '', ''),
            ('od3', 'a3', '2026-06-10', '朝阳区', 'CT-2026-003', 'confirmed'),
            ('od4', 'a4', '2026-06-15', '海淀区', 'CT-2026-004', 'confirmed');

        INSERT INTO audit_logs (id, audit_id, operator_id, action, from_status, to_status, comment, exception_reason, created_at) VALUES
            ('log1', 'a3', 'u1', 'advance', 'pending', 'processing', '提交审核', '', '2026-05-20T14:00:00Z'),
            ('log2', 'a4', 'u1', 'advance', 'pending', 'processing', '提交审核', '', '2026-05-25T08:00:00Z'),
            ('log3', 'a4', 'u2', 'advance', 'processing', 'reviewing', '审核完成，提交复核', '', '2026-05-28T10:00:00Z'),
            ('log4', 'a4', 'u3', 'return_correction', 'reviewing', 'correction_needed', '资质材料不完整', '健康证过期需更新', '2026-06-05T16:00:00Z');"
    )?;
    Ok(())
}

pub fn query_user_by_username(conn: &Connection, username: &str) -> Result<Option<User>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, username, password_hash, role, display_name FROM users WHERE username = ?1"
    )?;
    let mut rows = stmt.query([username])?;
    match rows.next()? {
        Some(row) => Ok(Some(User {
            id: row.get(0)?,
            username: row.get(1)?,
            password_hash: row.get(2)?,
            role: row.get(3)?,
            display_name: row.get(4)?,
        })),
        None => Ok(None),
    }
}

pub fn query_user_by_id(conn: &Connection, id: &str) -> Result<Option<User>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, username, password_hash, role, display_name FROM users WHERE id = ?1"
    )?;
    let mut rows = stmt.query([id])?;
    match rows.next()? {
        Some(row) => Ok(Some(User {
            id: row.get(0)?,
            username: row.get(1)?,
            password_hash: row.get(2)?,
            role: row.get(3)?,
            display_name: row.get(4)?,
        })),
        None => Ok(None),
    }
}

pub fn query_audit_by_id(conn: &Connection, id: &str) -> Result<Option<AuditOrder>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, order_no, status, expiry_date, creator_id, current_handler_id, version, created_at, updated_at FROM audit_orders WHERE id = ?1"
    )?;
    let mut rows = stmt.query([id])?;
    match rows.next()? {
        Some(row) => Ok(Some(AuditOrder {
            id: row.get(0)?,
            order_no: row.get(1)?,
            status: row.get(2)?,
            expiry_date: row.get(3)?,
            creator_id: row.get(4)?,
            current_handler_id: row.get(5)?,
            version: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })),
        None => Ok(None),
    }
}

pub fn query_nanny_profile(conn: &Connection, audit_id: &str) -> Result<Option<NannyProfile>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, audit_id, name, id_card, phone, service_type, work_experience FROM nanny_profiles WHERE audit_id = ?1"
    )?;
    let mut rows = stmt.query([audit_id])?;
    match rows.next()? {
        Some(row) => Ok(Some(NannyProfile {
            id: row.get(0)?,
            audit_id: row.get(1)?,
            name: row.get(2)?,
            id_card: row.get(3)?,
            phone: row.get(4)?,
            service_type: row.get(5)?,
            work_experience: row.get(6)?,
        })),
        None => Ok(None),
    }
}

pub fn query_qualification_review(conn: &Connection, audit_id: &str) -> Result<Option<QualificationReview>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, audit_id, health_cert, health_cert_expiry, training_cert, training_cert_expiry, background_check, background_check_result FROM qualification_reviews WHERE audit_id = ?1"
    )?;
    let mut rows = stmt.query([audit_id])?;
    match rows.next()? {
        Some(row) => Ok(Some(QualificationReview {
            id: row.get(0)?,
            audit_id: row.get(1)?,
            health_cert: row.get(2)?,
            health_cert_expiry: row.get(3)?,
            training_cert: row.get(4)?,
            training_cert_expiry: row.get(5)?,
            background_check: row.get(6)?,
            background_check_result: row.get(7)?,
        })),
        None => Ok(None),
    }
}

pub fn query_on_duty_confirmation(conn: &Connection, audit_id: &str) -> Result<Option<OnDutyConfirmation>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, audit_id, on_duty_date, service_area, contract_no, confirmation_status FROM on_duty_confirmations WHERE audit_id = ?1"
    )?;
    let mut rows = stmt.query([audit_id])?;
    match rows.next()? {
        Some(row) => Ok(Some(OnDutyConfirmation {
            id: row.get(0)?,
            audit_id: row.get(1)?,
            on_duty_date: row.get(2)?,
            service_area: row.get(3)?,
            contract_no: row.get(4)?,
            confirmation_status: row.get(5)?,
        })),
        None => Ok(None),
    }
}

pub fn query_audit_logs(conn: &Connection, audit_id: &str) -> Result<Vec<AuditLog>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, audit_id, operator_id, action, from_status, to_status, comment, exception_reason, created_at FROM audit_logs WHERE audit_id = ?1 ORDER BY created_at ASC"
    )?;
    let rows = stmt.query_map([audit_id], |row| {
        Ok(AuditLog {
            id: row.get(0)?,
            audit_id: row.get(1)?,
            operator_id: row.get(2)?,
            action: row.get(3)?,
            from_status: row.get(4)?,
            to_status: row.get(5)?,
            comment: row.get(6)?,
            exception_reason: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;
    rows.collect()
}
