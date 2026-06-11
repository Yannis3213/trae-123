use rusqlite::{params, Connection};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::error::AppError;

pub type DbPool = Arc<Mutex<Connection>>;

pub fn init_pool(db_path: &str) -> Result<DbPool, AppError> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    Ok(Arc::new(Mutex::new(conn)))
}

pub fn init_schema(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            role TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS creative_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_number TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            client_name TEXT NOT NULL,
            brand TEXT NOT NULL DEFAULT '',
            campaign_name TEXT NOT NULL DEFAULT '',
            brief_status TEXT NOT NULL DEFAULT 'pending',
            schedule_status TEXT NOT NULL DEFAULT 'pending',
            status TEXT NOT NULL DEFAULT 'draft',
            current_handler_role TEXT NOT NULL,
            current_handler_id INTEGER NOT NULL,
            deadline TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            description TEXT NOT NULL DEFAULT '',
            created_by INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (created_by) REFERENCES users(id),
            FOREIGN KEY (current_handler_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL DEFAULT 'other',
            uploaded_by INTEGER NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES creative_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS processing_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            handler_id INTEGER NOT NULL,
            handler_role TEXT NOT NULL,
            action TEXT NOT NULL,
            opinion TEXT NOT NULL DEFAULT '',
            from_status TEXT NOT NULL,
            to_status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES creative_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (handler_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS audit_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            author_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            note_type TEXT NOT NULL DEFAULT 'audit',
            created_at TEXT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES creative_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS exception_reasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            reason_type TEXT NOT NULL,
            description TEXT NOT NULL,
            reported_by INTEGER NOT NULL,
            resolved INTEGER NOT NULL DEFAULT 0,
            resolved_at TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (request_id) REFERENCES creative_requests(id) ON DELETE CASCADE,
            FOREIGN KEY (reported_by) REFERENCES users(id)
        );"
    )?;
    Ok(())
}

pub fn seed_data(conn: &Connection) -> Result<(), AppError> {
    let user_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .unwrap_or(0);

    if user_count > 0 {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO users (username, display_name, role) VALUES (?1, ?2, ?3)",
        params!["zhangsan", "张三", "creative_registrar"],
    )?;
    conn.execute(
        "INSERT INTO users (username, display_name, role) VALUES (?1, ?2, ?3)",
        params!["lisi", "李四", "review_supervisor"],
    )?;
    conn.execute(
        "INSERT INTO users (username, display_name, role) VALUES (?1, ?2, ?3)",
        params!["wangwu", "王五", "review_manager"],
    )?;

    let now = chrono::Utc::now().naive_utc();
    let now_str = now.format("%Y-%m-%d %H:%M:%S").to_string();

    let deadline_7d = (now + chrono::Duration::days(7)).format("%Y-%m-%d").to_string();
    let deadline_2d = (now + chrono::Duration::days(2)).format("%Y-%m-%d").to_string();
    let deadline_1d_ago = (now - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
    let deadline_10d = (now + chrono::Duration::days(10)).format("%Y-%m-%d").to_string();

    conn.execute(
        "INSERT INTO creative_requests (request_number, title, client_name, brand, campaign_name, brief_status, schedule_status, status, current_handler_role, current_handler_id, deadline, version, description, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params!["CR-2024-001", "夏季品牌推广创意需求", "星河科技有限公司", "星河", "夏日清凉季", "received", "scheduled", "submitted", "review_supervisor", 2, deadline_7d, 1, "需要为夏季品牌推广制作系列创意物料", 1, now_str, now_str],
    )?;

    let submitted_at = now.format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![1, 1, "creative_registrar", "submit", "提交审核", "pending_submit", "submitted", submitted_at],
    )?;

    let returned_at = now.format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO creative_requests (request_number, title, client_name, brand, campaign_name, brief_status, schedule_status, status, current_handler_role, current_handler_id, deadline, version, description, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params!["CR-2024-002", "秋季新品发布创意需求", "锦绣商贸集团", "锦绣", "金秋新品发布会", "missing", "pending", "returned", "creative_registrar", 1, deadline_2d, 2, "秋季新品发布全套创意方案，Brief缺失需补正", 1, now_str, now_str],
    )?;

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![2, 2, "review_supervisor", "submit", "提交审核", "pending_submit", "submitted", returned_at],
    )?;

    let review_start_at = now.format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![2, 2, "review_supervisor", "start_review", "开始审核", "submitted", "under_review", review_start_at],
    )?;

    let return_at = now.format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![2, 2, "review_supervisor", "return", "Brief缺失，需补正后重新提交", "under_review", "returned", return_at],
    )?;

    conn.execute(
        "INSERT INTO exception_reasons (request_id, reason_type, description, reported_by, resolved, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![2, "brief_missing", "客户Brief未提供，无法确认创意方向", 2, 0, return_at],
    )?;

    conn.execute(
        "INSERT INTO audit_notes (request_id, author_id, content, note_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![2, 2, "Brief缺失，需尽快联系客户获取", "exception", return_at],
    )?;

    conn.execute(
        "INSERT INTO creative_requests (request_number, title, client_name, brand, campaign_name, brief_status, schedule_status, status, current_handler_role, current_handler_id, deadline, version, description, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params!["CR-2024-003", "双十一大促创意需求", "云端电商有限公司", "云端", "双十一狂欢节", "received", "scheduled", "reviewed", "review_manager", 3, deadline_1d_ago, 1, "双十一大促全渠道创意物料需求，已超期", 1, now_str, now_str],
    )?;

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![3, 1, "creative_registrar", "submit", "提交审核", "pending_submit", "submitted", now_str],
    )?;

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![3, 2, "review_supervisor", "start_review", "开始审核", "submitted", "under_review", now_str],
    )?;

    conn.execute(
        "INSERT INTO processing_records (request_id, handler_id, handler_role, action, opinion, from_status, to_status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![3, 2, "review_supervisor", "approve", "审核通过，创意方向明确", "under_review", "reviewed", now_str],
    )?;

    conn.execute(
        "INSERT INTO audit_notes (request_id, author_id, content, note_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![3, 2, "审核通过，建议尽快归档", "audit", now_str],
    )?;

    conn.execute(
        "INSERT INTO creative_requests (request_number, title, client_name, brand, campaign_name, brief_status, schedule_status, status, current_handler_role, current_handler_id, deadline, version, description, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params!["CR-2024-004", "年终答谢会创意需求", "明德投资集团", "明德", "年终感恩答谢会", "pending", "pending", "draft", "creative_registrar", 1, deadline_10d, 1, "年终客户答谢会全套创意策划方案", 1, now_str, now_str],
    )?;

    Ok(())
}
