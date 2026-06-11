use rusqlite::Connection;
use std::sync::Mutex;
use crate::error::AppError;

pub struct Db(pub Mutex<Connection>);

pub fn init_db(path: &str) -> Result<Db, AppError> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    create_tables(&conn)?;
    create_indexes(&conn)?;
    seed_data(&conn)?;
    Ok(Db(Mutex::new(conn)))
}

fn create_tables(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS inspection (
            id TEXT PRIMARY KEY,
            pond_id TEXT NOT NULL,
            pond_name TEXT NOT NULL,
            inspector TEXT NOT NULL,
            inspector_role TEXT NOT NULL,
            status TEXT NOT NULL,
            current_handler TEXT NOT NULL,
            current_handler_role TEXT NOT NULL,
            deadline TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS test_indicator (
            id TEXT PRIMARY KEY,
            inspection_id TEXT NOT NULL,
            name TEXT NOT NULL,
            value TEXT NOT NULL,
            unit TEXT NOT NULL,
            standard TEXT NOT NULL,
            is_qualified INTEGER NOT NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspection(id)
        );
        CREATE TABLE IF NOT EXISTS attachment (
            id TEXT PRIMARY KEY,
            inspection_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspection(id)
        );
        CREATE TABLE IF NOT EXISTS audit_record (
            id TEXT PRIMARY KEY,
            inspection_id TEXT NOT NULL,
            action TEXT NOT NULL,
            operator TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            comment TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspection(id)
        );
        CREATE TABLE IF NOT EXISTS exception_reason (
            id TEXT PRIMARY KEY,
            inspection_id TEXT NOT NULL,
            audit_record_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspection(id),
            FOREIGN KEY (audit_record_id) REFERENCES audit_record(id)
        );"
    )?;
    Ok(())
}

fn create_indexes(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_inspection_status ON inspection(status);
        CREATE INDEX IF NOT EXISTS idx_inspection_pond_id ON inspection(pond_id);
        CREATE INDEX IF NOT EXISTS idx_inspection_deadline ON inspection(deadline);
        CREATE INDEX IF NOT EXISTS idx_test_indicator_inspection_id ON test_indicator(inspection_id);
        CREATE INDEX IF NOT EXISTS idx_attachment_inspection_id ON attachment(inspection_id);
        CREATE INDEX IF NOT EXISTS idx_audit_record_inspection_id ON audit_record(inspection_id);
        CREATE INDEX IF NOT EXISTS idx_exception_reason_inspection_id ON exception_reason(inspection_id);"
    )?;
    Ok(())
}

fn seed_data(conn: &Connection) -> Result<(), AppError> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM inspection", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let yesterday = (now - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let two_days_ago = (now - chrono::Duration::days(2)).format("%Y-%m-%d").to_string();
    let five_days_later = (now + chrono::Duration::days(5)).format("%Y-%m-%d").to_string();
    let ten_days_later = (now + chrono::Duration::days(10)).format("%Y-%m-%d").to_string();
    let one_day_later = (now + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let two_days_later = (now + chrono::Duration::days(2)).format("%Y-%m-%d").to_string();
    let seven_days_ago = (now - chrono::Duration::days(7)).format("%Y-%m-%d").to_string();
    let five_days_ago = (now - chrono::Duration::days(5)).format("%Y-%m-%d").to_string();
    let three_days_ago = (now - chrono::Duration::days(3)).format("%Y-%m-%d").to_string();
    let ts = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let ts_7d = (now - chrono::Duration::days(7)).format("%Y-%m-%d %H:%M:%S").to_string();
    let ts_5d = (now - chrono::Duration::days(5)).format("%Y-%m-%d %H:%M:%S").to_string();
    let ts_3d = (now - chrono::Duration::days(3)).format("%Y-%m-%d %H:%M:%S").to_string();
    let ts_2d = (now - chrono::Duration::days(2)).format("%Y-%m-%d %H:%M:%S").to_string();
    let ts_1d = (now - chrono::Duration::days(1)).format("%Y-%m-%d %H:%M:%S").to_string();

    let inspections = vec![
        ("ins-001", "A1", "A1-东塘", "张三", "pond_admin", "pending_review", "张三", "pond_admin", five_days_later.as_str(), &ts, &ts),
        ("ins-002", "A2", "A2-西塘", "张三", "pond_admin", "pending_review", "张三", "pond_admin", one_day_later.as_str(), &ts, &ts),
        ("ins-003", "B1", "B1-南塘", "张三", "pond_admin", "pending_review", "张三", "pond_admin", ten_days_later.as_str(), &ts, &ts),
        ("ins-004", "B2", "B2-北塘", "张三", "pond_admin", "under_review", "李工", "quality_engineer", two_days_later.as_str(), &ts_1d, &ts_1d),
        ("ins-005", "C1", "C1-中心塘", "张三", "pond_admin", "approved", "王主任", "base_director", five_days_later.as_str(), &ts_3d, &ts_2d),
        ("ins-006", "A1", "A1-东塘", "张三", "pond_admin", "approved", "王主任", "base_director", seven_days_ago.as_str(), &ts_5d, &ts_3d),
        ("ins-007", "A2", "A2-西塘", "张三", "pond_admin", "pending_correction", "张三", "pond_admin", yesterday.as_str(), &ts_3d, &ts_2d),
        ("ins-008", "B1", "B1-南塘", "张三", "pond_admin", "pending_correction", "张三", "pond_admin", two_days_ago.as_str(), &ts_2d, &ts_1d),
        ("ins-009", "B2", "B2-北塘", "张三", "pond_admin", "synced", "王主任", "base_director", seven_days_ago.as_str(), &ts_7d, &ts_5d),
        ("ins-010", "C1", "C1-中心塘", "张三", "pond_admin", "synced", "王主任", "base_director", five_days_ago.as_str(), &ts_5d, &ts_3d),
    ];

    let ins_stmt = conn.prepare(
        "INSERT INTO inspection (id, pond_id, pond_name, inspector, inspector_role, status, current_handler, current_handler_role, deadline, version, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,1,?10,?11)"
    )?;

    for ins in &inspections {
        ins_stmt.execute(rusqlite::params![ins.0, ins.1, ins.2, ins.3, ins.4, ins.5, ins.6, ins.7, ins.8, ins.9, ins.10])?;
    }
    drop(ins_stmt);

    let indicators = vec![
        ("ind-001", "ins-001", "pH值", "7.2", "", "6.5-8.5", 1),
        ("ind-002", "ins-001", "溶解氧", "6.8", "mg/L", "≥5", 1),
        ("ind-003", "ins-001", "氨氮", "0.3", "mg/L", "≤1.0", 1),
        ("ind-004", "ins-002", "pH值", "8.6", "", "6.5-8.5", 0),
        ("ind-005", "ins-002", "溶解氧", "4.2", "mg/L", "≥5", 0),
        ("ind-006", "ins-002", "氨氮", "0.8", "mg/L", "≤1.0", 1),
        ("ind-007", "ins-003", "pH值", "7.5", "", "6.5-8.5", 1),
        ("ind-008", "ins-003", "溶解氧", "7.1", "mg/L", "≥5", 1),
        ("ind-009", "ins-004", "pH值", "7.0", "", "6.5-8.5", 1),
        ("ind-010", "ins-004", "溶解氧", "5.5", "mg/L", "≥5", 1),
        ("ind-011", "ins-004", "氨氮", "0.5", "mg/L", "≤1.0", 1),
        ("ind-012", "ins-005", "pH值", "7.8", "", "6.5-8.5", 1),
        ("ind-013", "ins-005", "溶解氧", "6.2", "mg/L", "≥5", 1),
        ("ind-014", "ins-006", "pH值", "7.1", "", "6.5-8.5", 1),
        ("ind-015", "ins-006", "溶解氧", "5.8", "mg/L", "≥5", 1),
        ("ind-016", "ins-007", "pH值", "9.0", "", "6.5-8.5", 0),
        ("ind-017", "ins-007", "氨氮", "1.5", "mg/L", "≤1.0", 0),
        ("ind-018", "ins-008", "溶解氧", "3.5", "mg/L", "≥5", 0),
        ("ind-019", "ins-009", "pH值", "7.3", "", "6.5-8.5", 1),
        ("ind-020", "ins-009", "溶解氧", "6.0", "mg/L", "≥5", 1),
        ("ind-021", "ins-010", "pH值", "7.6", "", "6.5-8.5", 1),
        ("ind-022", "ins-010", "氨氮", "0.4", "mg/L", "≤1.0", 1),
    ];

    let ind_stmt = conn.prepare(
        "INSERT INTO test_indicator (id, inspection_id, name, value, unit, standard, is_qualified) VALUES (?1,?2,?3,?4,?5,?6,?7)"
    )?;
    for ind in &indicators {
        ind_stmt.execute(rusqlite::params![ind.0, ind.1, ind.2, ind.3, ind.4, ind.5, ind.6])?;
    }
    drop(ind_stmt);

    let attachments = vec![
        ("att-001", "ins-001", "水质检测报告.pdf", "application/pdf", 102400, "张三", &ts),
        ("att-002", "ins-001", "现场照片.jpg", "image/jpeg", 51200, "张三", &ts),
        ("att-003", "ins-002", "检测数据.xlsx", "application/xlsx", 204800, "张三", &ts),
        ("att-004", "ins-004", "水质检测报告.pdf", "application/pdf", 102400, "张三", &ts_1d),
        ("att-005", "ins-005", "核验通过报告.pdf", "application/pdf", 102400, "李工", &ts_2d),
        ("att-006", "ins-006", "检测报告.pdf", "application/pdf", 102400, "张三", &ts_5d),
        ("att-007", "ins-007", "补正材料.pdf", "application/pdf", 51200, "张三", &ts_2d),
        ("att-008", "ins-009", "同步确认单.pdf", "application/pdf", 102400, "王主任", &ts_5d),
        ("att-009", "ins-010", "检测报告.pdf", "application/pdf", 102400, "张三", &ts_5d),
    ];

    let att_stmt = conn.prepare(
        "INSERT INTO attachment (id, inspection_id, filename, file_type, file_size, uploaded_by, uploaded_at) VALUES (?1,?2,?3,?4,?5,?6,?7)"
    )?;
    for att in &attachments {
        att_stmt.execute(rusqlite::params![att.0, att.1, att.2, att.3, att.4, att.5, att.6])?;
    }
    drop(att_stmt);

    let audit_records = vec![
        ("aud-001", "ins-001", "submit", "张三", "pond_admin", None::<&str>, &ts),
        ("aud-002", "ins-002", "submit", "张三", "pond_admin", None::<&str>, &ts),
        ("aud-003", "ins-003", "submit", "张三", "pond_admin", None::<&str>, &ts),
        ("aud-004", "ins-004", "submit", "张三", "pond_admin", None::<&str>, &ts_1d),
        ("aud-005", "ins-005", "submit", "张三", "pond_admin", None::<&str>, &ts_3d),
        ("aud-006", "ins-005", "approve", "李工", "quality_engineer", Some("核验通过"), &ts_2d),
        ("aud-007", "ins-006", "submit", "张三", "pond_admin", None::<&str>, &ts_5d),
        ("aud-008", "ins-006", "approve", "李工", "quality_engineer", Some("数据合格"), &ts_3d),
        ("aud-009", "ins-007", "submit", "张三", "pond_admin", None::<&str>, &ts_3d),
        ("aud-010", "ins-007", "reject", "李工", "quality_engineer", Some("pH值超标，需补正"), &ts_2d),
        ("aud-011", "ins-008", "submit", "张三", "pond_admin", None::<&str>, &ts_2d),
        ("aud-012", "ins-008", "reject", "李工", "quality_engineer", Some("溶解氧不达标"), &ts_1d),
        ("aud-013", "ins-009", "submit", "张三", "pond_admin", None::<&str>, &ts_7d),
        ("aud-014", "ins-009", "approve", "李工", "quality_engineer", Some("合格"), &ts_5d),
        ("aud-015", "ins-009", "confirm_sync", "王主任", "base_director", Some("已同步至监管平台"), &ts_5d),
        ("aud-016", "ins-010", "submit", "张三", "pond_admin", None::<&str>, &ts_5d),
        ("aud-017", "ins-010", "approve", "李工", "quality_engineer", Some("合格"), &ts_3d),
        ("aud-018", "ins-010", "confirm_sync", "王主任", "base_director", Some("已同步"), &ts_3d),
    ];

    let aud_stmt = conn.prepare(
        "INSERT INTO audit_record (id, inspection_id, action, operator, operator_role, comment, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)"
    )?;
    for aud in &audit_records {
        aud_stmt.execute(rusqlite::params![aud.0, aud.1, aud.2, aud.3, aud.4, aud.5, aud.6])?;
    }
    drop(aud_stmt);

    let exception_reasons = vec![
        ("exc-001", "ins-007", "aud-010", "pH值8.6超出标准范围6.5-8.5，需重新检测", &ts_2d),
        ("exc-002", "ins-008", "aud-012", "溶解氧3.5mg/L低于标准5mg/L，需补正", &ts_1d),
    ];

    let exc_stmt = conn.prepare(
        "INSERT INTO exception_reason (id, inspection_id, audit_record_id, reason, created_at) VALUES (?1,?2,?3,?4,?5)"
    )?;
    for exc in &exception_reasons {
        exc_stmt.execute(rusqlite::params![exc.0, exc.1, exc.2, exc.3, exc.4])?;
    }

    Ok(())
}
