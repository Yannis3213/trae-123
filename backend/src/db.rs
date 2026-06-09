use rusqlite::{Connection, params, OptionalExtension, types::ToSql};
use chrono::{DateTime, Utc, NaiveDate, Duration};
use uuid::Uuid;
use anyhow::{Result, Context, anyhow};

use crate::models::*;

pub type DbPool = Connection;

const NODE_TIMEOUT_DAYS: i64 = 3;

pub fn init_db() -> Result<DbPool> {
    let conn = Connection::open("library_borrow.db")?;
    create_tables(&conn)?;
    seed_data(&conn)?;
    Ok(conn)
}

fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS readers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            card_number TEXT NOT NULL UNIQUE,
            department TEXT NOT NULL,
            phone TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS borrow_records (
            id TEXT PRIMARY KEY,
            reader_id TEXT NOT NULL,
            reader_name TEXT NOT NULL,
            reader_card_number TEXT NOT NULL,
            book_title TEXT NOT NULL,
            book_isbn TEXT NOT NULL,
            borrow_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            return_date TEXT,
            status TEXT NOT NULL,
            current_handler TEXT,
            current_handler_role TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            created_by TEXT NOT NULL,
            created_by_role TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            missing_materials TEXT
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            borrow_record_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS process_records (
            id TEXT PRIMARY KEY,
            borrow_record_id TEXT NOT NULL,
            from_status TEXT NOT NULL,
            to_status TEXT NOT NULL,
            action TEXT NOT NULL,
            operator TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            remark TEXT,
            evidence_required TEXT,
            evidence_provided TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_notes (
            id TEXT PRIMARY KEY,
            borrow_record_id TEXT NOT NULL,
            status_snapshot TEXT NOT NULL,
            note TEXT NOT NULL,
            operator TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            exception_type TEXT,
            exception_detail TEXT,
            created_at TEXT NOT NULL
        );
        ",
    )?;
    Ok(())
}

fn seed_data(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM readers", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let readers = vec![
        ("张三", "R2024001", "计算机学院", "13800138001"),
        ("李四", "R2024002", "经济管理学院", "13800138002"),
        ("王五", "R2024003", "外国语学院", "13800138003"),
        ("赵六", "R2024004", "机械工程学院", "13800138004"),
        ("钱七", "R2024005", "艺术设计学院", "13800138005"),
    ];

    for (name, card, dept, phone) in readers {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO readers (id, name, card_number, department, phone, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, name, card, dept, phone, now],
        )?;
    }

    let sample_records = vec![
        (
            "R2024001", "张三",
            "深入理解计算机系统", "978-7-111-54493-7",
            Utc::now().checked_sub_signed(Duration::days(30)).unwrap().date_naive(),
            Utc::now().checked_sub_signed(Duration::days(5)).unwrap().date_naive(),
            "待分派", Some("流通馆员小王"), Some("流通馆员"),
            vec!["借阅凭证".to_string()],
        ),
        (
            "R2024002", "李四",
            "经济学原理", "978-7-301-20778-1",
            Utc::now().checked_sub_signed(Duration::days(20)).unwrap().date_naive(),
            Utc::now().checked_add_signed(Duration::days(10)).unwrap().date_naive(),
            "已转办", Some("采编馆员小李"), Some("采编馆员"),
            vec!["借阅凭证".to_string(), "身份证明".to_string()],
        ),
        (
            "R2024003", "王五",
            "高级英语阅读", "978-7-5600-2407-9",
            Utc::now().checked_sub_signed(Duration::days(25)).unwrap().date_naive(),
            Utc::now().checked_add_signed(Duration::days(2)).unwrap().date_naive(),
            "待分派", None, None,
            vec![],
        ),
        (
            "R2024004", "赵六",
            "机械设计基础", "978-7-04-019209-5",
            Utc::now().checked_sub_signed(Duration::days(15)).unwrap().date_naive(),
            Utc::now().checked_add_signed(Duration::days(15)).unwrap().date_naive(),
            "已回访", Some("借阅审核主管张主管"), Some("借阅审核主管"),
            vec!["借阅凭证".to_string(), "身份证明".to_string(), "回访记录".to_string()],
        ),
    ];

    for (card, name, title, isbn, borrow, due, status, handler, handler_role, missing) in sample_records {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let reader_id: String = conn.query_row(
            "SELECT id FROM readers WHERE card_number = ?1",
            params![card],
            |row| row.get(0),
        )?;
        let missing_json = serde_json::to_string(&missing)?;
        conn.execute(
            "INSERT INTO borrow_records (
                id, reader_id, reader_name, reader_card_number,
                book_title, book_isbn, borrow_date, due_date,
                status, current_handler, current_handler_role,
                version, created_by, created_by_role, created_at, updated_at,
                missing_materials
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, ?12, ?13, ?14, ?14, ?15)",
            params![
                id, reader_id, name, card,
                title, isbn, borrow.to_string(), due.to_string(),
                status, handler, handler_role.map(|r| r.to_string()),
                "系统初始化", "借阅登记员",
                now, missing_json
            ],
        )?;
    }

    Ok(())
}

fn compute_overdue_level(due_date: &NaiveDate) -> (OverdueLevel, bool, Option<String>) {
    let today = Utc::now().date_naive();
    let diff = (*due_date - today).num_days();

    if diff < 0 {
        (OverdueLevel::Overdue, true, Some("借阅登记员".to_string()))
    } else if diff <= 3 {
        (OverdueLevel::Approaching, diff <= 0, None)
    } else {
        (OverdueLevel::Normal, false, None)
    }
}

fn row_to_borrow_record(row: &rusqlite::Row) -> Result<BorrowRecord> {
    let id: String = row.get("id")?;
    let reader_id: String = row.get("reader_id")?;
    let reader_name: String = row.get("reader_name")?;
    let reader_card_number: String = row.get("reader_card_number")?;
    let book_title: String = row.get("book_title")?;
    let book_isbn: String = row.get("book_isbn")?;
    let borrow_date_str: String = row.get("borrow_date")?;
    let due_date_str: String = row.get("due_date")?;
    let return_date_str: Option<String> = row.get("return_date")?;
    let status_str: String = row.get("status")?;
    let current_handler: Option<String> = row.get("current_handler")?;
    let current_handler_role_str: Option<String> = row.get("current_handler_role")?;
    let version: i64 = row.get("version")?;
    let created_by: String = row.get("created_by")?;
    let created_by_role_str: String = row.get("created_by_role")?;
    let created_at_str: String = row.get("created_at")?;
    let updated_at_str: String = row.get("updated_at")?;
    let missing_materials_str: Option<String> = row.get("missing_materials")?;

    let borrow_date = NaiveDate::parse_from_str(&borrow_date_str, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive());
    let due_date = NaiveDate::parse_from_str(&due_date_str, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive());
    let return_date = return_date_str.and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok());
    let status = BorrowStatus::from_str(&status_str).unwrap_or(BorrowStatus::PendingAssignment);
    let current_handler_role = current_handler_role_str
        .as_deref()
        .and_then(Role::from_str);
    let created_by_role = Role::from_str(&created_by_role_str).unwrap_or(Role::RegistrationClerk);
    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or(Utc::now());
    let updated_at = DateTime::parse_from_rfc3339(&updated_at_str)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or(Utc::now());
    let missing_materials: Vec<String> = missing_materials_str
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    let (overdue_level, node_timeout, timeout_responsible) = compute_overdue_level(&due_date);

    Ok(BorrowRecord {
        id: Uuid::parse_str(&id)?,
        reader_id: Uuid::parse_str(&reader_id)?,
        reader_name,
        reader_card_number,
        book_title,
        book_isbn,
        borrow_date,
        due_date,
        return_date,
        status,
        current_handler,
        current_handler_role,
        version,
        created_by,
        created_by_role,
        created_at,
        updated_at,
        overdue_level,
        node_timeout,
        timeout_responsible,
        missing_materials,
    })
}

pub fn list_borrow_records(conn: &Connection, params: &ListQueryParams) -> Result<Vec<BorrowRecord>> {
    let mut sql = String::from("SELECT * FROM borrow_records WHERE 1=1");
    let mut sql_params: Vec<Box<dyn ToSql>> = Vec::new();

    if let Some(status) = &params.status {
        sql.push_str(" AND status = ?");
        sql_params.push(Box::new(status.as_str().to_string()));
    }

    if let Some(keyword) = &params.reader_keyword {
        let kw = format!("%{}%", keyword);
        sql.push_str(" AND (reader_name LIKE ? OR reader_card_number LIKE ? OR book_title LIKE ?)");
        sql_params.push(Box::new(kw.clone()));
        sql_params.push(Box::new(kw.clone()));
        sql_params.push(Box::new(kw));
    }

    if let Some(handler) = &params.handler {
        let h = format!("%{}%", handler);
        sql.push_str(" AND current_handler LIKE ?");
        sql_params.push(Box::new(h));
    }

    sql.push_str(" ORDER BY updated_at DESC");

    let page_size = params.page_size.unwrap_or(50);
    let page = params.page.unwrap_or(1);
    let offset = (page - 1) * page_size;
    sql.push_str(&format!(" LIMIT {} OFFSET {}", page_size, offset));

    let param_refs: Vec<&dyn ToSql> = sql_params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(param_refs.as_slice(), row_to_borrow_record)?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }

    if let Some(role) = &params.role {
        results = filter_by_role(results, *role);
    }
    if let Some(ol) = &params.overdue_level {
        results = results.into_iter().filter(|r| &r.overdue_level == ol).collect();
    }

    Ok(results)
}

fn filter_by_role(records: Vec<BorrowRecord>, role: Role) -> Vec<BorrowRecord> {
    match role {
        Role::RegistrationClerk => {
            records.into_iter().filter(|r| {
                r.status == BorrowStatus::ReturnedForCorrection ||
                r.created_by_role == Role::RegistrationClerk
            }).collect()
        }
        Role::CirculationLibrarian => {
            records.into_iter().filter(|r| {
                r.status == BorrowStatus::PendingAssignment
            }).collect()
        }
        Role::CatalogingLibrarian => {
            records.into_iter().filter(|r| {
                r.status == BorrowStatus::Transferred ||
                r.current_handler_role == Some(Role::CatalogingLibrarian)
            }).collect()
        }
        Role::AuditSupervisor => {
            records.into_iter().filter(|r| {
                r.status == BorrowStatus::Revisited ||
                r.current_handler_role == Some(Role::AuditSupervisor)
            }).collect()
        }
        Role::LibraryDirector => records,
    }
}

pub fn get_borrow_record(conn: &Connection, id: &Uuid) -> Result<Option<BorrowRecord>> {
    let id_str = id.to_string();
    let mut stmt = conn.prepare("SELECT * FROM borrow_records WHERE id = ?1")?;
    let result = stmt.query_row(params![id_str], row_to_borrow_record).optional()?;
    Ok(result)
}

pub fn create_borrow_record(conn: &Connection, req: &CreateBorrowRecordRequest) -> Result<BorrowRecord> {
    let reader = get_reader(conn, &req.reader_id)?
        .ok_or_else(|| anyhow!("Reader not found"))?;

    let id = Uuid::new_v4();
    let now = Utc::now();
    let now_str = now.to_rfc3339();
    let missing_json = if req.initial_materials.is_empty() {
        serde_json::to_string(&vec!["借阅凭证".to_string()])?
    } else {
        serde_json::to_string(&Vec::<String>::new())?
    };

    conn.execute(
        "INSERT INTO borrow_records (
            id, reader_id, reader_name, reader_card_number,
            book_title, book_isbn, borrow_date, due_date,
            status, current_handler, current_handler_role,
            version, created_by, created_by_role, created_at, updated_at,
            missing_materials
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, ?12, ?13, ?14, ?14, ?15)",
        params![
            id.to_string(),
            req.reader_id.to_string(),
            reader.name,
            reader.card_number,
            req.book_title,
            req.book_isbn,
            req.borrow_date.to_string(),
            req.due_date.to_string(),
            BorrowStatus::PendingAssignment.as_str(),
            Option::<String>::None,
            Option::<String>::None,
            req.operator,
            req.operator_role.as_str(),
            now_str,
            missing_json,
        ],
    )?;

    add_process_record(
        conn, &id,
        BorrowStatus::PendingAssignment, BorrowStatus::PendingAssignment,
        "创建借阅登记", &req.operator, req.operator_role,
        Some("初始登记创建".to_string()),
        &vec!["借阅凭证".to_string()],
        &req.initial_materials,
    )?;

    add_audit_note(
        conn, &id,
        BorrowStatus::PendingAssignment,
        "借阅记录已创建，进入待分派队列",
        &req.operator, req.operator_role,
        None, None,
    )?;

    let missing: Vec<String> = serde_json::from_str(&missing_json)?;
    let (overdue_level, node_timeout, timeout_responsible) = compute_overdue_level(&req.due_date);

    Ok(BorrowRecord {
        id,
        reader_id: req.reader_id,
        reader_name: reader.name,
        reader_card_number: reader.card_number,
        book_title: req.book_title.clone(),
        book_isbn: req.book_isbn.clone(),
        borrow_date: req.borrow_date,
        due_date: req.due_date,
        return_date: None,
        status: BorrowStatus::PendingAssignment,
        current_handler: None,
        current_handler_role: None,
        version: 1,
        created_by: req.operator.clone(),
        created_by_role: req.operator_role,
        created_at: now,
        updated_at: now,
        overdue_level,
        node_timeout,
        timeout_responsible,
        missing_materials: missing,
    })
}

pub fn add_process_record(
    conn: &Connection,
    record_id: &Uuid,
    from_status: BorrowStatus,
    to_status: BorrowStatus,
    action: &str,
    operator: &str,
    operator_role: Role,
    remark: Option<String>,
    evidence_required: &[String],
    evidence_provided: &[String],
) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let ev_req = serde_json::to_string(evidence_required)?;
    let ev_prov = serde_json::to_string(evidence_provided)?;

    conn.execute(
        "INSERT INTO process_records (
            id, borrow_record_id, from_status, to_status, action,
            operator, operator_role, remark, evidence_required, evidence_provided, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            id, record_id.to_string(),
            from_status.as_str(), to_status.as_str(), action,
            operator, operator_role.as_str(), remark,
            ev_req, ev_prov, now
        ],
    )?;
    Ok(())
}

pub fn add_audit_note(
    conn: &Connection,
    record_id: &Uuid,
    status_snapshot: BorrowStatus,
    note: &str,
    operator: &str,
    operator_role: Role,
    exception_type: Option<&str>,
    exception_detail: Option<&str>,
) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit_notes (
            id, borrow_record_id, status_snapshot, note,
            operator, operator_role, exception_type, exception_detail, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id, record_id.to_string(),
            status_snapshot.as_str(), note,
            operator, operator_role.as_str(),
            exception_type, exception_detail, now
        ],
    )?;
    Ok(())
}

pub fn validate_and_process(
    conn: &Connection,
    record_id: &Uuid,
    req: &ProcessBorrowRecordRequest,
) -> Result<BorrowRecord> {
    let mut record = get_borrow_record(conn, record_id)?
        .ok_or_else(|| anyhow!("借阅记录不存在"))?;

    if record.version != req.version {
        add_audit_note(
            conn, record_id, record.status,
            &format!("版本冲突: 期望版本 {}，收到版本 {}", record.version, req.version),
            &req.operator, req.operator_role,
            Some("版本冲突"),
            Some(&format!("expected={}, actual={}", record.version, req.version)),
        )?;
        return Err(anyhow!("版本冲突，请刷新后重试"));
    }

    crate::auth::check_permission(&record, req.operator_role, &req.target_status)?;

    if record.node_timeout && req.operator_role != Role::LibraryDirector {
        add_audit_note(
            conn, record_id, record.status,
            "节点超时: 非馆长角色无法推进超时记录",
            &req.operator, req.operator_role,
            Some("超期未处理"),
            Some(&format!("timeout_responsible={:?}, operator_role={}", record.timeout_responsible, req.operator_role.as_str())),
        )?;
        return Err(anyhow!("节点已超时，仅馆长可推进此记录"));
    }

    if let Some(handler_role) = record.current_handler_role {
        if handler_role != req.operator_role
            && req.operator_role != Role::LibraryDirector
            && record.current_handler.is_some()
        {
            add_audit_note(
                conn, record_id, record.status,
                &format!(
                    "当前处理人越权: 记录归属角色为 {}，操作角色为 {}",
                    handler_role.as_str(), req.operator_role.as_str()
                ),
                &req.operator, req.operator_role,
                Some("越权推进"),
                Some(&format!("expected_handler_role={}, actual={}", handler_role.as_str(), req.operator_role.as_str())),
            )?;
            return Err(anyhow!(
                "该记录当前处理人为 {}（{}），您无权操作",
                record.current_handler.as_deref().unwrap_or("-"),
                handler_role.as_str()
            ));
        }
    }

    if let Some(handler_name) = &record.current_handler {
        if req.operator_role != Role::LibraryDirector
            && !handler_name.is_empty()
            && handler_name != &req.operator
        {
            add_audit_note(
                conn, record_id, record.status,
                &format!(
                    "处理人姓名不匹配: 记录当前处理人 {}，操作人 {}",
                    handler_name, req.operator
                ),
                &req.operator, req.operator_role,
                Some("越权推进"),
                Some(&format!("expected_handler={}, actual={}", handler_name, req.operator)),
            )?;
            return Err(anyhow!(
                "该记录当前处理人为 {}，操作人 {} 无权办理（仅馆长可代操作）",
                handler_name, req.operator
            ));
        }
    }

    let required_evidence = required_evidence_for(&record.status, &req.target_status);
    let missing_evidence: Vec<String> = required_evidence
        .iter()
        .filter(|e| !req.evidence.contains(e))
        .cloned()
        .collect();

    if !missing_evidence.is_empty() && req.target_status != BorrowStatus::ReturnedForCorrection {
        add_audit_note(
            conn, record_id, record.status,
            &format!("缺少必要证据: {:?}", missing_evidence),
            &req.operator, req.operator_role,
            Some("资料缺失"),
            Some(&missing_evidence.join(", ")),
        )?;
        return Err(anyhow!("缺少必要证据: {}", missing_evidence.join(", ")));
    }

    let from_status = record.status;

    if let Some(items) = &req.correction_items {
        let missing_json = serde_json::to_string(items)?;
        conn.execute(
            "UPDATE borrow_records SET missing_materials = ?1, version = version + 1, updated_at = ?2 WHERE id = ?3",
            params![missing_json, Utc::now().to_rfc3339(), record_id.to_string()],
        )?;
        record.missing_materials = items.clone();
        record.version += 1;
    }

    let (new_handler, new_handler_role) = if let Some(assign) = &req.assign_to {
        (Some(assign.clone()), req.assign_to_role)
    } else {
        match req.target_status {
            BorrowStatus::Transferred => (Some("采编馆员默认处理人".to_string()), Some(Role::CatalogingLibrarian)),
            BorrowStatus::Revisited => (Some("审核主管默认处理人".to_string()), Some(Role::AuditSupervisor)),
            BorrowStatus::ReviewedArchived => (Some("馆长".to_string()), Some(Role::LibraryDirector)),
            BorrowStatus::ReturnedForCorrection => (Some("借阅登记员默认处理人".to_string()), Some(Role::RegistrationClerk)),
            BorrowStatus::Overdue => (Some("流通馆员默认处理人".to_string()), Some(Role::CirculationLibrarian)),
            _ => (record.current_handler.clone(), record.current_handler_role),
        }
    };

    record.status = req.target_status;
    record.current_handler = new_handler;
    record.current_handler_role = new_handler_role;
    record.version = req.version + 1;
    record.updated_at = Utc::now();

    conn.execute(
        "UPDATE borrow_records SET
            status = ?1, current_handler = ?2, current_handler_role = ?3,
            version = ?4, updated_at = ?5
        WHERE id = ?6",
        params![
            record.status.as_str(),
            record.current_handler,
            record.current_handler_role.as_ref().map(|r| r.as_str().to_string()),
            record.version,
            record.updated_at.to_rfc3339(),
            record_id.to_string(),
        ],
    )?;

    add_process_record(
        conn, record_id,
        from_status, req.target_status,
        &req.action, &req.operator, req.operator_role,
        req.remark.clone(),
        &required_evidence,
        &req.evidence,
    )?;

    add_audit_note(
        conn, record_id, req.target_status,
        &format!("状态由 {} 变更为 {}", from_status.as_str(), req.target_status.as_str()),
        &req.operator, req.operator_role,
        None, None,
    )?;

    Ok(record)
}

pub fn required_evidence_for(from: &BorrowStatus, to: &BorrowStatus) -> Vec<String> {
    match (from, to) {
        (BorrowStatus::PendingAssignment, BorrowStatus::Transferred) => {
            vec!["借阅凭证".to_string(), "身份证明".to_string()]
        }
        (BorrowStatus::Transferred, BorrowStatus::Revisited) => {
            vec!["借阅凭证".to_string(), "身份证明".to_string(), "催还记录".to_string()]
        }
        (BorrowStatus::Revisited, BorrowStatus::ReviewedArchived) => {
            vec!["借阅凭证".to_string(), "身份证明".to_string(), "回访记录".to_string(), "处理结果确认".to_string()]
        }
        (BorrowStatus::ReturnedForCorrection, BorrowStatus::PendingAssignment) => {
            vec!["补正材料清单".to_string(), "补正确认".to_string()]
        }
        _ => vec!["借阅凭证".to_string()],
    }
}

pub fn get_process_history(conn: &Connection, record_id: &Uuid) -> Result<Vec<ProcessRecord>> {
    let id_str = record_id.to_string();
    let mut stmt = conn.prepare(
        "SELECT * FROM process_records WHERE borrow_record_id = ?1 ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map(params![id_str], |row| {
        let id: String = row.get("id")?;
        let br_id: String = row.get("borrow_record_id")?;
        let from_str: String = row.get("from_status")?;
        let to_str: String = row.get("to_status")?;
        let action: String = row.get("action")?;
        let operator: String = row.get("operator")?;
        let op_role_str: String = row.get("operator_role")?;
        let remark: Option<String> = row.get("remark")?;
        let ev_req_str: String = row.get("evidence_required")?;
        let ev_prov_str: String = row.get("evidence_provided")?;
        let created_at_str: String = row.get("created_at")?;

        Ok(ProcessRecord {
            id: Uuid::parse_str(&id).unwrap_or(Uuid::nil()),
            borrow_record_id: Uuid::parse_str(&br_id).unwrap_or(Uuid::nil()),
            from_status: BorrowStatus::from_str(&from_str).unwrap_or(BorrowStatus::PendingAssignment),
            to_status: BorrowStatus::from_str(&to_str).unwrap_or(BorrowStatus::PendingAssignment),
            action,
            operator,
            operator_role: Role::from_str(&op_role_str).unwrap_or(Role::RegistrationClerk),
            remark,
            evidence_required: serde_json::from_str(&ev_req_str).unwrap_or_default(),
            evidence_provided: serde_json::from_str(&ev_prov_str).unwrap_or_default(),
            created_at: DateTime::parse_from_rfc3339(&created_at_str)
                .map(|d| d.with_timezone(&Utc)).unwrap_or(Utc::now()),
        })
    })?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn get_audit_notes(conn: &Connection, record_id: &Uuid) -> Result<Vec<AuditNote>> {
    let id_str = record_id.to_string();
    let mut stmt = conn.prepare(
        "SELECT * FROM audit_notes WHERE borrow_record_id = ?1 ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map(params![id_str], |row| {
        let id: String = row.get("id")?;
        let br_id: String = row.get("borrow_record_id")?;
        let status_str: String = row.get("status_snapshot")?;
        let note: String = row.get("note")?;
        let operator: String = row.get("operator")?;
        let op_role_str: String = row.get("operator_role")?;
        let exc_type: Option<String> = row.get("exception_type")?;
        let exc_detail: Option<String> = row.get("exception_detail")?;
        let created_at_str: String = row.get("created_at")?;

        Ok(AuditNote {
            id: Uuid::parse_str(&id).unwrap_or(Uuid::nil()),
            borrow_record_id: Uuid::parse_str(&br_id).unwrap_or(Uuid::nil()),
            status_snapshot: BorrowStatus::from_str(&status_str).unwrap_or(BorrowStatus::PendingAssignment),
            note,
            operator,
            operator_role: Role::from_str(&op_role_str).unwrap_or(Role::RegistrationClerk),
            exception_type: exc_type,
            exception_detail: exc_detail,
            created_at: DateTime::parse_from_rfc3339(&created_at_str)
                .map(|d| d.with_timezone(&Utc)).unwrap_or(Utc::now()),
        })
    })?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn list_readers(conn: &Connection) -> Result<Vec<Reader>> {
    let mut stmt = conn.prepare("SELECT * FROM readers ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |row| {
        let id: String = row.get("id")?;
        let name: String = row.get("name")?;
        let card: String = row.get("card_number")?;
        let dept: String = row.get("department")?;
        let phone: String = row.get("phone")?;
        let created_at_str: String = row.get("created_at")?;

        Ok(Reader {
            id: Uuid::parse_str(&id).unwrap_or(Uuid::nil()),
            name,
            card_number: card,
            department: dept,
            phone,
            created_at: DateTime::parse_from_rfc3339(&created_at_str)
                .map(|d| d.with_timezone(&Utc)).unwrap_or(Utc::now()),
        })
    })?;

    let mut results = Vec::new();
    for r in rows {
        results.push(r?);
    }
    Ok(results)
}

pub fn get_reader(conn: &Connection, id: &Uuid) -> Result<Option<Reader>> {
    let id_str = id.to_string();
    let mut stmt = conn.prepare("SELECT * FROM readers WHERE id = ?1")?;
    let result = stmt.query_row(params![id_str], |row| {
        let id: String = row.get("id")?;
        let name: String = row.get("name")?;
        let card: String = row.get("card_number")?;
        let dept: String = row.get("department")?;
        let phone: String = row.get("phone")?;
        let created_at_str: String = row.get("created_at")?;

        Ok(Reader {
            id: Uuid::parse_str(&id).unwrap_or(Uuid::nil()),
            name,
            card_number: card,
            department: dept,
            phone,
            created_at: DateTime::parse_from_rfc3339(&created_at_str)
                .map(|d| d.with_timezone(&Utc)).unwrap_or(Utc::now()),
        })
    }).optional()?;
    Ok(result)
}

pub fn get_statistics(conn: &Connection) -> Result<Statistics> {
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM borrow_records", [], |row| row.get(0))?;
    let pending: i64 = conn.query_row(
        "SELECT COUNT(*) FROM borrow_records WHERE status = ?1",
        params![BorrowStatus::PendingAssignment.as_str()],
        |row| row.get(0),
    )?;
    let transferred: i64 = conn.query_row(
        "SELECT COUNT(*) FROM borrow_records WHERE status = ?1",
        params![BorrowStatus::Transferred.as_str()],
        |row| row.get(0),
    )?;
    let revisited: i64 = conn.query_row(
        "SELECT COUNT(*) FROM borrow_records WHERE status = ?1",
        params![BorrowStatus::Revisited.as_str()],
        |row| row.get(0),
    )?;
    let returned: i64 = conn.query_row(
        "SELECT COUNT(*) FROM borrow_records WHERE status = ?1",
        params![BorrowStatus::ReturnedForCorrection.as_str()],
        |row| row.get(0),
    )?;
    let archived: i64 = conn.query_row(
        "SELECT COUNT(*) FROM borrow_records WHERE status = ?1",
        params![BorrowStatus::ReviewedArchived.as_str()],
        |row| row.get(0),
    )?;

    let records = list_borrow_records(conn, &ListQueryParams {
        role: None, handler: None, status: None,
        overdue_level: None, reader_keyword: None,
        page: Some(1), page_size: Some(10000),
    })?;

    let normal = records.iter().filter(|r| r.overdue_level == OverdueLevel::Normal).count() as i64;
    let approaching = records.iter().filter(|r| r.overdue_level == OverdueLevel::Approaching).count() as i64;
    let overdue = records.iter().filter(|r| r.overdue_level == OverdueLevel::Overdue).count() as i64;
    let timeout = records.iter().filter(|r| r.node_timeout).count() as i64;

    Ok(Statistics {
        total_count: total,
        pending_assignment: pending,
        transferred,
        revisited,
        returned_for_correction: returned,
        reviewed_archived: archived,
        overdue: records.iter().filter(|r| r.status == BorrowStatus::Overdue).count() as i64,
        normal,
        approaching,
        overdue_count: overdue,
        node_timeout_count: timeout,
    })
}
