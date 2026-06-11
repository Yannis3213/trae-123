use chrono::{Duration, Utc};
use sqlx::{Pool, Sqlite, SqlitePool};
use uuid::Uuid;

use crate::error::AppError;
use crate::models::*;

pub async fn init_db(database_url: &str) -> Result<Pool<Sqlite>, AppError> {
    let pool = SqlitePool::connect(database_url).await?;
    run_migrations(&pool).await?;
    Ok(pool)
}

async fn run_migrations(pool: &Pool<Sqlite>) -> Result<(), AppError> {
    let migrations = [
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            status TEXT NOT NULL,
            priority TEXT NOT NULL,
            responsible_id TEXT NOT NULL,
            responsible_name TEXT NOT NULL,
            current_handler_id TEXT NOT NULL,
            current_handler_name TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deadline DATETIME NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            exception_tags TEXT NOT NULL DEFAULT '[]',
            processing_result TEXT,
            return_reason TEXT
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            ticket_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_type TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_by_name TEXT NOT NULL,
            uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            url TEXT NOT NULL
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS processing_records (
            id TEXT PRIMARY KEY,
            ticket_id TEXT NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT NOT NULL,
            to_status TEXT NOT NULL,
            from_handler_id TEXT NOT NULL DEFAULT '',
            from_handler_name TEXT NOT NULL DEFAULT '',
            to_handler_id TEXT NOT NULL DEFAULT '',
            to_handler_name TEXT NOT NULL DEFAULT '',
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            remark TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS audit_remarks (
            id TEXT PRIMARY KEY,
            ticket_id TEXT NOT NULL,
            content TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        "#,
        r#"
        CREATE TABLE IF NOT EXISTS exception_reasons (
            id TEXT PRIMARY KEY,
            ticket_id TEXT NOT NULL,
            reason_type TEXT NOT NULL,
            description TEXT NOT NULL,
            reported_by TEXT NOT NULL,
            reported_by_name TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved INTEGER NOT NULL DEFAULT 0
        )
        "#,
    ];
    for m in migrations {
        sqlx::query(m).execute(pool).await?;
    }

    let alters = [
        "ALTER TABLE processing_records ADD COLUMN from_handler_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE processing_records ADD COLUMN from_handler_name TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE processing_records ADD COLUMN to_handler_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE processing_records ADD COLUMN to_handler_name TEXT NOT NULL DEFAULT ''",
    ];
    for s in alters {
        let _ = sqlx::query(s).execute(pool).await;
    }

    Ok(())
}

fn compute_expiry(deadline: chrono::DateTime<Utc>) -> (String, String) {
    let now = Utc::now();
    let diff = deadline.signed_duration_since(now);
    if diff < Duration::zero() {
        ("overdue".to_string(), ExpiryStatus::Overdue.display_name().to_string())
    } else if diff < Duration::hours(24) {
        ("near_expiry".to_string(), ExpiryStatus::NearExpiry.display_name().to_string())
    } else {
        ("normal".to_string(), ExpiryStatus::Normal.display_name().to_string())
    }
}

pub async fn compute_next_handler(
    pool: &Pool<Sqlite>,
    current_status: TicketStatus,
    target_status: TicketStatus,
    priority: Priority,
    current_handler_id: &str,
    current_handler_name: &str,
    operator_id: &str,
    operator_name: &str,
) -> Result<(String, String, Option<(String, String)>), AppError> {
    match (current_status, target_status) {
        (TicketStatus::PendingReceipt, TicketStatus::CallRegistered)
        | (TicketStatus::ExceptionReturned, TicketStatus::CallRegistered) => {
            let target_role = if priority == Priority::Urgent || priority == Priority::High {
                "qa_supervisor"
            } else {
                "supervisor"
            };
            let row: Option<(String, String)> = sqlx::query_as(
                "SELECT id, name FROM users WHERE role = ? LIMIT 1",
            )
            .bind(target_role)
            .fetch_optional(pool)
            .await?;
            let (next_id, next_name) = row.unwrap_or_else(|| (operator_id.to_string(), operator_name.to_string()));
            let future_hint = Some(("u_supervisor".to_string(), if target_role == "qa_supervisor" { "质检主管-陈强".to_string() } else { "客服审核主管-王芳".to_string() }));
            Ok((next_id, next_name, future_hint))
        }
        (TicketStatus::CallRegistered, TicketStatus::Dispatched) => {
            let row: Option<(String, String)> = sqlx::query_as(
                "SELECT id, name FROM users WHERE role = 'agent' LIMIT 1",
            )
            .fetch_optional(pool)
            .await?;
            let (next_id, next_name) = row.unwrap_or_else(|| (operator_id.to_string(), operator_name.to_string()));
            Ok((next_id, next_name, Some(("u_reviewer".to_string(), "复核负责人-张伟".to_string()))))
        }
        (TicketStatus::Dispatched, TicketStatus::CallbackClosed)
        | (TicketStatus::Dispatched, TicketStatus::ReceiptCompleted) => {
            let row: Option<(String, String)> = sqlx::query_as(
                "SELECT id, name FROM users WHERE role = 'reviewer' LIMIT 1",
            )
            .fetch_optional(pool)
            .await?;
            let (next_id, next_name) = row.unwrap_or_else(|| (operator_id.to_string(), operator_name.to_string()));
            Ok((next_id, next_name, None))
        }
        (TicketStatus::CallbackClosed, TicketStatus::Archived)
        | (TicketStatus::ReceiptCompleted, TicketStatus::Archived) => {
            Ok((operator_id.to_string(), operator_name.to_string(), None))
        }
        (_, TicketStatus::ExceptionReturned) => {
            let row: Option<(String, String)> = sqlx::query_as(
                "SELECT id, name FROM users WHERE role = 'registrar' LIMIT 1",
            )
            .fetch_optional(pool)
            .await?;
            let (next_id, next_name) = row.unwrap_or_else(|| (operator_id.to_string(), operator_name.to_string()));
            Ok((next_id, next_name, None))
        }
        _ => {
            Ok((current_handler_id.to_string(), current_handler_name.to_string(), None))
        }
    }
}

pub fn peek_next_handler_hint(
    status: &str,
    priority: &str,
) -> (Option<String>, Option<String>) {
    match TicketStatus::from_str(status) {
        Some(TicketStatus::PendingReceipt) | Some(TicketStatus::ExceptionReturned) => {
            if priority == "urgent" || priority == "high" {
                (Some("u_qa".to_string()), Some("质检主管-陈强".to_string()))
            } else {
                (Some("u_supervisor".to_string()), Some("客服审核主管-王芳".to_string()))
            }
        }
        Some(TicketStatus::CallRegistered) => (Some("u_agent".to_string()), Some("客服坐席-赵敏".to_string())),
        Some(TicketStatus::Dispatched) => (Some("u_reviewer".to_string()), Some("复核负责人-张伟".to_string())),
        Some(TicketStatus::CallbackClosed) | Some(TicketStatus::ReceiptCompleted) => (Some("u_reviewer".to_string()), Some("复核负责人-张伟".to_string())),
        _ => (None, None),
    }
}

pub async fn seed_data(pool: &Pool<Sqlite>) -> Result<(), AppError> {
    let user_count: i64 = match sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
    {
        Ok(c) => c,
        Err(_) => 0,
    };
    if user_count > 0 {
        return Ok(());
    }

    let users = [
        ("u_registrar", "registrar", "客服登记员-李明", Role::Registrar, "123456"),
        ("u_supervisor", "supervisor", "客服审核主管-王芳", Role::Supervisor, "123456"),
        ("u_reviewer", "reviewer", "复核负责人-张伟", Role::Reviewer, "123456"),
        ("u_agent", "agent", "客服坐席-赵敏", Role::Agent, "123456"),
        ("u_qa", "qa_supervisor", "质检主管-陈强", Role::QaSupervisor, "123456"),
        ("u_manager", "cs_manager", "客服经理-刘洋", Role::CsManager, "123456"),
    ];

    for (id, username, name, role, pwd) in &users {
        sqlx::query(
            "INSERT INTO users (id, username, password, name, role) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(username)
        .bind(pwd)
        .bind(name)
        .bind(role.as_str())
        .execute(pool)
        .await?;
    }

    let now = Utc::now();

    let tickets = [
        (
            "t_normal",
            "【正常】客户咨询产品退换货流程",
            "客户来电咨询7天无理由退换货流程，需要详细解答并指引操作。客服坐席签收登记后转交主管审核派单。",
            "孙先生", "13800138001",
            TicketStatus::PendingReceipt, Priority::Medium,
            "u_agent", "客服坐席-赵敏", "u_agent", "客服坐席-赵敏",
            now + Duration::days(3), 1,
            vec![],
        ),
        (
            "t_missing",
            "【缺材料·质检退回】客户退款申请缺少凭证",
            "客户申请退款，但未上传购买凭证和商品照片，被质检主管退回补正。登记员补正并上传附件后重新提交，高优工单转交质检主管审核。",
            "周女士", "13800138002",
            TicketStatus::ExceptionReturned, Priority::High,
            "u_registrar", "客服登记员-李明", "u_registrar", "客服登记员-李明",
            now + Duration::days(1), 4,
            vec!["缺材料".to_string(), "质检退回".to_string()],
        ),
        (
            "t_overdue",
            "【逾期】客户投诉物流超时未送达",
            "客户投诉物流已超过承诺送达时间3天，商品仍未收到，情绪激动。已派单给客服坐席进行回访关闭，完成后转交复核负责人归档。",
            "吴先生", "13800138003",
            TicketStatus::Dispatched, Priority::Urgent,
            "u_supervisor", "客服审核主管-王芳", "u_agent", "客服坐席-赵敏",
            now - Duration::days(1), 3,
            vec!["逾期".to_string(), "物流异常".to_string()],
        ),
        (
            "t_returned",
            "【退回·主管退回】质量问题工单被审核主管退回补正",
            "客户反映收到商品有质量问题，前次处理因证据不足被审核主管退回，需重新补充照片和视频证据。中优工单上传证据后提交主管审核。",
            "郑女士", "13800138004",
            TicketStatus::ExceptionReturned, Priority::Medium,
            "u_registrar", "客服登记员-李明", "u_registrar", "客服登记员-李明",
            now + Duration::hours(20), 3,
            vec!["退回补正".to_string()],
        ),
        (
            "t_qa_dispatch_return",
            "【质检退回·派单状态】紧急投诉被质检退回补正",
            "客户紧急投诉商品破损，已派单给坐席处理，但质检主管审核发现缺少商品破损照片，退回给登记员补正。登记员上传证据后重新提交质检审核。",
            "王先生", "13800138005",
            TicketStatus::ExceptionReturned, Priority::Urgent,
            "u_registrar", "客服登记员-李明", "u_registrar", "客服登记员-李明",
            now + Duration::hours(12), 5,
            vec!["质检退回".to_string(), "缺材料".to_string()],
        ),
    ];

    for (id, title, desc, cname, cphone, status, priority, rid, rname, hid, hname, deadline, version, tags) in tickets {
        let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
        sqlx::query(
            r#"INSERT INTO tickets (id, title, description, customer_name, customer_phone, status, priority,
                responsible_id, responsible_name, current_handler_id, current_handler_name, deadline, version, exception_tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(id)
        .bind(title)
        .bind(desc)
        .bind(cname)
        .bind(cphone)
        .bind(status.as_str())
        .bind(priority.as_str())
        .bind(rid)
        .bind(rname)
        .bind(hid)
        .bind(hname)
        .bind(deadline)
        .bind(version)
        .bind(tags_json)
        .execute(pool)
        .await?;
    }

    let exception_seeds = [
        ("t_missing", "缺材料", "缺少购买凭证和商品照片，客户仅提供了订单截图，无法证明商品问题", "u_qa", "质检主管-陈强"),
        ("t_missing", "质检退回", "质检审核发现材料不完整，退回给登记员补充购买凭证和商品问题照片", "u_qa", "质检主管-陈强"),
        ("t_returned", "退回补正", "证据照片模糊，无法辨认商品问题，需要重新上传高清图片和开箱视频", "u_supervisor", "客服审核主管-王芳"),
        ("t_overdue", "逾期", "已超过承诺处理时效1天，客户已3次来电催单，要求今天内给出明确答复", "u_manager", "客服经理-刘洋"),
        ("t_overdue", "物流异常", "物流信息显示已签收，但客户称未收到商品，疑似快递员虚假签收", "u_supervisor", "客服审核主管-王芳"),
        ("t_qa_dispatch_return", "质检退回", "派单后质检审核发现缺少商品破损照片，退回给登记员补充证据", "u_qa", "质检主管-陈强"),
        ("t_qa_dispatch_return", "缺材料", "商品破损投诉缺少破损部位照片和开箱视频，需要补充上传", "u_qa", "质检主管-陈强"),
    ];
    for (tid, rt, desc, rb, rbn) in exception_seeds {
        sqlx::query(
            r#"INSERT INTO exception_reasons (id, ticket_id, reason_type, description, reported_by, reported_by_name, resolved)
               VALUES (?, ?, ?, ?, ?, ?, 0)"#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(tid)
        .bind(rt)
        .bind(desc)
        .bind(rb)
        .bind(rbn)
        .execute(pool)
        .await?;
    }

    let audit_seeds = [
        ("t_missing", "质检审核发现材料不完整，已退回给登记员补充，并电话通知客户准备购买凭证", "u_qa", "质检主管-陈强", "qa_supervisor"),
        ("t_missing", "首次登记时客户仅提供了订单截图，缺少商品实物照片和问题部位照片", "u_registrar", "客服登记员-李明", "registrar"),
        ("t_returned", "质量问题证据不足，已电话告知登记员需要补充的材料类型", "u_supervisor", "客服审核主管-王芳", "supervisor"),
        ("t_overdue", "逾期工单已升级处理，客服经理正在跟进，承诺24小时内解决", "u_manager", "客服经理-刘洋", "cs_manager"),
        ("t_qa_dispatch_return", "派单后质检审核发现缺少商品破损照片，退回给登记员补充", "u_qa", "质检主管-陈强", "qa_supervisor"),
        ("t_qa_dispatch_return", "紧急投诉优先派单，但质检环节发现证据不足需补充破损照片和开箱视频", "u_qa", "质检主管-陈强", "qa_supervisor"),
    ];
    for (tid, content, oid, oname, orole) in audit_seeds {
        sqlx::query(
            r#"INSERT INTO audit_remarks (id, ticket_id, content, operator_id, operator_name, operator_role)
               VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(tid)
        .bind(content)
        .bind(oid)
        .bind(oname)
        .bind(orole)
        .execute(pool)
        .await?;
    }

    let record_seeds = [
        ("t_normal", "创建工单", "", "pending_receipt",
            "", "", "u_agent", "客服坐席-赵敏",
            "u_agent", "客服坐席-赵敏", "agent", "系统自动创建，客服坐席负责签收登记"),

        ("t_missing", "创建工单", "", "pending_receipt",
            "", "", "u_registrar", "客服登记员-李明",
            "u_registrar", "客服登记员-李明", "registrar", "客户来电申请退款，创建高优工单"),
        ("t_missing", "登记来电", "pending_receipt", "call_registered",
            "u_registrar", "客服登记员-李明", "u_qa", "质检主管-陈强",
            "u_registrar", "客服登记员-李明", "registrar", "客户来电登记，高优工单转交质检主管审核"),
        ("t_missing", "质检退回补正", "call_registered", "exception_returned",
            "u_qa", "质检主管-陈强", "u_registrar", "客服登记员-李明",
            "u_qa", "质检主管-陈强", "qa_supervisor", "缺少购买凭证和商品照片，质检退回补正"),

        ("t_returned", "创建工单", "", "pending_receipt",
            "", "", "u_registrar", "客服登记员-李明",
            "u_registrar", "客服登记员-李明", "registrar", "客户反馈商品质量问题，创建中优工单"),
        ("t_returned", "登记来电", "pending_receipt", "call_registered",
            "u_registrar", "客服登记员-李明", "u_supervisor", "客服审核主管-王芳",
            "u_registrar", "客服登记员-李明", "registrar", "客户来电登记，中优工单转交主管审核"),
        ("t_returned", "主管退回补正", "call_registered", "exception_returned",
            "u_supervisor", "客服审核主管-王芳", "u_registrar", "客服登记员-李明",
            "u_supervisor", "客服审核主管-王芳", "supervisor", "证据照片模糊，无法辨认，主管退回补正"),

        ("t_overdue", "创建工单", "", "pending_receipt",
            "", "", "u_agent", "客服坐席-赵敏",
            "u_agent", "客服坐席-赵敏", "agent", "客户投诉物流超时，创建紧急工单"),
        ("t_overdue", "登记来电", "pending_receipt", "call_registered",
            "u_agent", "客服坐席-赵敏", "u_qa", "质检主管-陈强",
            "u_agent", "客服坐席-赵敏", "agent", "客户来电登记，紧急工单转交质检主管"),
        ("t_overdue", "派单处理", "call_registered", "dispatched",
            "u_qa", "质检主管-陈强", "u_agent", "客服坐席-赵敏",
            "u_qa", "质检主管-陈强", "qa_supervisor", "紧急投诉优先处理，质检主管派单给客服坐席回访"),

        ("t_qa_dispatch_return", "创建工单", "", "pending_receipt",
            "", "", "u_registrar", "客服登记员-李明",
            "u_registrar", "客服登记员-李明", "registrar", "客户紧急投诉商品破损，创建工单"),
        ("t_qa_dispatch_return", "登记来电", "pending_receipt", "call_registered",
            "u_registrar", "客服登记员-李明", "u_qa", "质检主管-陈强",
            "u_registrar", "客服登记员-李明", "registrar", "客户来电登记，紧急工单转交质检主管"),
        ("t_qa_dispatch_return", "派单处理", "call_registered", "dispatched",
            "u_qa", "质检主管-陈强", "u_agent", "客服坐席-赵敏",
            "u_qa", "质检主管-陈强", "qa_supervisor", "紧急投诉优先派单，质检主管派单给客服坐席"),
        ("t_qa_dispatch_return", "质检退回补正", "dispatched", "exception_returned",
            "u_qa", "质检主管-陈强", "u_registrar", "客服登记员-李明",
            "u_qa", "质检主管-陈强", "qa_supervisor", "缺少商品破损照片，质检在派单状态退回给登记员补正"),
    ];

    for (tid, action, fs, ts, fh_id, fh_name, th_id, th_name, oid, oname, orole, remark) in record_seeds {
        sqlx::query(
            r#"INSERT INTO processing_records (id, ticket_id, action, from_status, to_status,
                from_handler_id, from_handler_name, to_handler_id, to_handler_name,
                operator_id, operator_name, operator_role, remark)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(tid)
        .bind(action)
        .bind(fs)
        .bind(ts)
        .bind(fh_id)
        .bind(fh_name)
        .bind(th_id)
        .bind(th_name)
        .bind(oid)
        .bind(oname)
        .bind(orole)
        .bind(remark)
        .execute(pool)
        .await?;
    }

    sqlx::query(
        "UPDATE tickets SET return_reason = ? WHERE id = ?"
    )
    .bind("质检退回：缺少购买凭证和商品问题照片，请补充上传后重新提交")
    .bind("t_missing")
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE tickets SET return_reason = ? WHERE id = ?"
    )
    .bind("主管退回：证据照片模糊，请补充高清图片和开箱视频后重新提交")
    .bind("t_returned")
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE tickets SET return_reason = ? WHERE id = ?"
    )
    .bind("质检退回：缺少商品破损照片和开箱视频，请补充上传后重新提交")
    .bind("t_qa_dispatch_return")
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE tickets SET processing_result = ? WHERE id = ?"
    )
    .bind("已联系物流方核实，确认快递员虚假签收，承诺24小时内安排二次派送，并由客服经理电话致歉客户")
    .bind("t_overdue")
    .execute(pool)
    .await?;

    Ok(())
}

fn map_user_row(id: String, username: String, name: String, role: String) -> User {
    let r = Role::from_str(&role).unwrap_or(Role::Agent);
    User {
        id,
        username,
        role,
        role_display: r.display_name().to_string(),
        name,
    }
}

pub async fn get_user_by_username(pool: &Pool<Sqlite>, username: &str) -> Result<Option<User>, AppError> {
    let row: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT id, username, name, role FROM users WHERE username = ?",
    )
    .bind(username)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(id, username, name, role)| map_user_row(id, username, name, role)))
}

pub async fn verify_user(pool: &Pool<Sqlite>, username: &str, password: &str) -> Result<Option<User>, AppError> {
    let row: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT id, username, name, role FROM users WHERE username = ? AND password = ?",
    )
    .bind(username)
    .bind(password)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(id, username, name, role)| map_user_row(id, username, name, role)))
}

pub async fn list_users(pool: &Pool<Sqlite>) -> Result<Vec<User>, AppError> {
    let rows: Vec<(String, String, String, String)> = sqlx::query_as(
        "SELECT id, username, name, role FROM users ORDER BY role",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(id, username, name, role)| map_user_row(id, username, name, role))
        .collect())
}

fn map_ticket_row(
    id: String, title: String, description: String, customer_name: String, customer_phone: String,
    status: String, priority: String, responsible_id: String, responsible_name: String,
    current_handler_id: String, current_handler_name: String,
    created_at: chrono::DateTime<Utc>, deadline: chrono::DateTime<Utc>,
    version: i64, exception_tags: String,
) -> Ticket {
    let tags: Vec<String> = serde_json::from_str(&exception_tags).unwrap_or_default();
    let status_enum = TicketStatus::from_str(&status).unwrap_or(TicketStatus::PendingReceipt);
    let prio_enum = Priority::from_str(&priority).unwrap_or(Priority::Medium);
    let (exp_key, exp_display) = compute_expiry(deadline);
    let (next_id, next_name) = peek_next_handler_hint(&status, &priority);

    Ticket {
        id, title, description, customer_name, customer_phone,
        status, status_display: status_enum.display_name().to_string(),
        priority, priority_display: prio_enum.display_name().to_string(),
        responsible_id, responsible_name,
        current_handler_id, current_handler_name,
        next_handler_id: next_id,
        next_handler_name: next_name,
        created_at, deadline, version,
        exception_tags: tags,
        expiry_status: exp_key, expiry_display: exp_display,
    }
}

type TicketRow = (
    String, String, String, String, String, String, String,
    String, String, String, String, chrono::DateTime<Utc>, chrono::DateTime<Utc>, i64, String,
);

pub async fn list_tickets(
    pool: &Pool<Sqlite>,
    user: &User,
    status_filter: Option<&str>,
    priority_filter: Option<&str>,
    keyword: Option<&str>,
    only_my: bool,
    page: i64,
    page_size: i64,
) -> Result<TicketListResponse, AppError> {
    let role = Role::from_str(&user.role).unwrap_or(Role::Agent);
    let offset = (page - 1) * page_size;

    let mut conds: Vec<String> = Vec::new();
    let mut binds: Vec<String> = Vec::new();

    match role {
        Role::Agent | Role::Registrar => {
            conds.push("(current_handler_id = ? OR responsible_id = ?)".to_string());
            binds.push(user.id.clone());
            binds.push(user.id.clone());
        }
        Role::Supervisor | Role::QaSupervisor => {
            conds.push("status IN (?, ?, ?)".to_string());
            binds.push(TicketStatus::CallRegistered.as_str().to_string());
            binds.push(TicketStatus::Dispatched.as_str().to_string());
            binds.push(TicketStatus::ExceptionReturned.as_str().to_string());
        }
        _ => {}
    }

    if only_my {
        conds.push("(current_handler_id = ? OR responsible_id = ?)".to_string());
        binds.push(user.id.clone());
        binds.push(user.id.clone());
    }

    if let Some(s) = status_filter {
        if !s.is_empty() {
            conds.push("status = ?".to_string());
            binds.push(s.to_string());
        }
    }
    if let Some(p) = priority_filter {
        if !p.is_empty() {
            conds.push("priority = ?".to_string());
            binds.push(p.to_string());
        }
    }
    if let Some(k) = keyword {
        if !k.is_empty() {
            conds.push("(title LIKE ? OR description LIKE ? OR customer_name LIKE ?)".to_string());
            let like = format!("%{}%", k);
            binds.push(like.clone());
            binds.push(like.clone());
            binds.push(like);
        }
    }

    let where_sql = if conds.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conds.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM tickets {}", where_sql);
    let mut q_count = sqlx::query_scalar::<_, i64>(&count_sql);
    for b in &binds {
        q_count = q_count.bind(b);
    }
    let total: i64 = q_count.fetch_one(pool).await?;

    let data_sql = format!(
        r#"SELECT id, title, description, customer_name, customer_phone, status, priority,
                  responsible_id, responsible_name, current_handler_id, current_handler_name,
                  created_at, deadline, version, exception_tags
           FROM tickets {} ORDER BY created_at DESC LIMIT ? OFFSET ?"#,
        where_sql
    );
    let mut q_data = sqlx::query_as::<_, TicketRow>(&data_sql);
    for b in &binds {
        q_data = q_data.bind(b);
    }
    q_data = q_data.bind(page_size).bind(offset);

    let rows: Vec<TicketRow> = q_data.fetch_all(pool).await?;
    let items: Vec<Ticket> = rows
        .into_iter()
        .map(|r| map_ticket_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11, r.12, r.13, r.14))
        .collect();

    Ok(TicketListResponse { items, total, page, page_size })
}

pub async fn get_ticket_detail(pool: &Pool<Sqlite>, ticket_id: &str) -> Result<TicketDetail, AppError> {
    type DetailRow = (
        String, String, String, String, String, String, String,
        String, String, String, String, chrono::DateTime<Utc>, chrono::DateTime<Utc>, i64, String,
        Option<String>, Option<String>,
    );

    let row: Option<DetailRow> = sqlx::query_as(
        r#"SELECT id, title, description, customer_name, customer_phone, status, priority,
                  responsible_id, responsible_name, current_handler_id, current_handler_name,
                  created_at, deadline, version, exception_tags, processing_result, return_reason
           FROM tickets WHERE id = ?"#,
    )
    .bind(ticket_id)
    .fetch_optional(pool)
    .await?;

    let r = row.ok_or_else(|| AppError::NotFound(format!("工单 {} 不存在", ticket_id)))?;

    let ticket = map_ticket_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11, r.12, r.13, r.14);
    let processing_result = r.15;
    let return_reason = r.16;

    type AttRow = (String, String, String, String, String, String, chrono::DateTime<Utc>, String);
    let att_rows: Vec<AttRow> = sqlx::query_as(
        r#"SELECT id, ticket_id, filename, file_type, uploaded_by, uploaded_by_name, uploaded_at, url
           FROM attachments WHERE ticket_id = ? ORDER BY uploaded_at DESC"#,
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await?;
    let attachments: Vec<Attachment> = att_rows
        .into_iter()
        .map(|(id, ticket_id, filename, file_type, uploaded_by, uploaded_by_name, uploaded_at, url)| {
            Attachment { id, ticket_id, filename, file_type, uploaded_by, uploaded_by_name, uploaded_at, url }
        })
        .collect();

    type PrRow = (String, String, String, String, String, String, String, String, String, String, String, String, Option<String>, chrono::DateTime<Utc>);
    let pr_rows: Vec<PrRow> = sqlx::query_as(
        r#"SELECT id, ticket_id, action, from_status, to_status,
                  from_handler_id, from_handler_name, to_handler_id, to_handler_name,
                  operator_id, operator_name, operator_role, remark, created_at
           FROM processing_records WHERE ticket_id = ? ORDER BY created_at DESC"#,
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await?;
    let processing_records: Vec<ProcessingRecord> = pr_rows
        .into_iter()
        .map(|(id, ticket_id, action, from_status, to_status, fh_id, fh_name, th_id, th_name, operator_id, operator_name, operator_role, remark, created_at)| {
            ProcessingRecord {
                id, ticket_id, action, from_status, to_status,
                from_handler_id: fh_id, from_handler_name: fh_name,
                to_handler_id: th_id, to_handler_name: th_name,
                operator_id, operator_name, operator_role, remark, created_at,
            }
        })
        .collect();

    type ArRow = (String, String, String, String, String, String, chrono::DateTime<Utc>);
    let ar_rows: Vec<ArRow> = sqlx::query_as(
        r#"SELECT id, ticket_id, content, operator_id, operator_name, operator_role, created_at
           FROM audit_remarks WHERE ticket_id = ? ORDER BY created_at DESC"#,
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await?;
    let audit_remarks: Vec<AuditRemark> = ar_rows
        .into_iter()
        .map(|(id, ticket_id, content, operator_id, operator_name, operator_role, created_at)| {
            AuditRemark { id, ticket_id, content, operator_id, operator_name, operator_role, created_at }
        })
        .collect();

    type ErRow = (String, String, String, String, String, String, chrono::DateTime<Utc>, i64);
    let er_rows: Vec<ErRow> = sqlx::query_as(
        r#"SELECT id, ticket_id, reason_type, description, reported_by, reported_by_name, created_at, resolved
           FROM exception_reasons WHERE ticket_id = ? ORDER BY created_at DESC"#,
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await?;
    let exception_reasons: Vec<ExceptionReason> = er_rows
        .into_iter()
        .map(|(id, ticket_id, reason_type, description, reported_by, reported_by_name, created_at, resolved)| {
            ExceptionReason { id, ticket_id, reason_type, description, reported_by, reported_by_name, created_at, resolved: resolved != 0 }
        })
        .collect();

    Ok(TicketDetail {
        ticket,
        attachments,
        processing_records,
        audit_remarks,
        exception_reasons,
        processing_result,
        return_reason,
    })
}

pub async fn create_ticket(
    pool: &Pool<Sqlite>,
    user: &User,
    req: &CreateTicketRequest,
) -> Result<Ticket, AppError> {
    let role = Role::from_str(&user.role).unwrap_or(Role::Agent);
    if !matches!(role, Role::Registrar | Role::Agent) {
        return Err(AppError::Forbidden("当前角色无权创建工单".to_string()));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let deadline_days = req.deadline_days.unwrap_or(3);
    let deadline = now + Duration::days(deadline_days);
    let priority = Priority::from_str(&req.priority).unwrap_or(Priority::Medium);

    let resp_user = if req.responsible_id == user.id {
        user.clone()
    } else {
        let row: Option<(String, String, String, String)> = sqlx::query_as(
            "SELECT id, username, name, role FROM users WHERE id = ?",
        )
        .bind(&req.responsible_id)
        .fetch_optional(pool)
        .await?;
        row.map(|(i, u, n, r)| map_user_row(i, u, n, r))
            .unwrap_or_else(|| user.clone())
    };

    let status = TicketStatus::PendingReceipt;
    sqlx::query(
        r#"INSERT INTO tickets (id, title, description, customer_name, customer_phone, status, priority,
            responsible_id, responsible_name, current_handler_id, current_handler_name, deadline, version, exception_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '[]')"#,
    )
    .bind(&id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.customer_name)
    .bind(&req.customer_phone)
    .bind(status.as_str())
    .bind(priority.as_str())
    .bind(&resp_user.id)
    .bind(&resp_user.name)
    .bind(&resp_user.id)
    .bind(&resp_user.name)
    .bind(deadline)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"INSERT INTO processing_records (id, ticket_id, action, from_status, to_status,
            from_handler_id, from_handler_name, to_handler_id, to_handler_name,
            operator_id, operator_name, operator_role, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&id)
    .bind("创建")
    .bind("")
    .bind(status.as_str())
    .bind("")
    .bind("")
    .bind(&resp_user.id)
    .bind(&resp_user.name)
    .bind(&user.id)
    .bind(&user.name)
    .bind(&user.role)
    .bind("工单创建")
    .execute(pool)
    .await?;

    let detail = get_ticket_detail(pool, &id).await?;
    Ok(detail.ticket)
}

pub fn validate_transition(
    user_role: Role,
    current_status: TicketStatus,
    target_status: TicketStatus,
    current_handler_id: &str,
    user_id: &str,
) -> (bool, Option<String>) {
    if current_handler_id != user_id {
        return (false, Some("当前处理人为其他账号，您无权处理".to_string()));
    }

    let ok = match (user_role, current_status, target_status) {
        (Role::Registrar | Role::Agent, TicketStatus::PendingReceipt, TicketStatus::CallRegistered) => true,
        (Role::Registrar | Role::Agent, TicketStatus::ExceptionReturned, TicketStatus::CallRegistered) => true,
        (Role::Supervisor | Role::QaSupervisor, TicketStatus::CallRegistered, TicketStatus::Dispatched) => true,
        (Role::Supervisor | Role::QaSupervisor, TicketStatus::CallRegistered, TicketStatus::ExceptionReturned) => true,
        (Role::Supervisor | Role::QaSupervisor, TicketStatus::Dispatched, TicketStatus::ExceptionReturned) => true,
        (Role::Supervisor | Role::QaSupervisor, TicketStatus::Dispatched, TicketStatus::ReceiptCompleted) => true,
        (Role::Agent | Role::Registrar, TicketStatus::Dispatched, TicketStatus::CallbackClosed) => true,
        (Role::Reviewer, TicketStatus::CallbackClosed, TicketStatus::Archived) => true,
        (Role::Reviewer, TicketStatus::ReceiptCompleted, TicketStatus::Archived) => true,
        (Role::Reviewer, TicketStatus::CallbackClosed, TicketStatus::ExceptionReturned) => true,
        (Role::Reviewer, TicketStatus::ReceiptCompleted, TicketStatus::ExceptionReturned) => true,
        _ => false,
    };

    if ok {
        (true, None)
    } else {
        (false, Some(format!(
            "当前角色 {} 无法从 {} 流转到 {}",
            user_role.display_name(),
            current_status.display_name(),
            target_status.display_name()
        )))
    }
}

pub async fn process_ticket(
    pool: &Pool<Sqlite>,
    user: &User,
    ticket_id: &str,
    req: &ProcessTicketRequest,
) -> Result<TicketDetail, AppError> {
    let detail = get_ticket_detail(pool, ticket_id).await?;
    let ticket = &detail.ticket;

    let current_status = TicketStatus::from_str(&ticket.status)
        .ok_or_else(|| AppError::BadRequest("无效的工单状态".to_string()))?;
    let target_status = TicketStatus::from_str(&req.target_status)
        .ok_or_else(|| AppError::BadRequest("无效的目标状态".to_string()))?;
    let user_role = Role::from_str(&user.role)
        .ok_or_else(|| AppError::BadRequest("无效的用户角色".to_string()))?;

    if req.version != ticket.version {
        return Err(AppError::VersionConflict(format!(
            "版本冲突：当前版本 v{}，您提交的版本 v{}",
            ticket.version, req.version
        )));
    }

    let (can_process, reason) = validate_transition(
        user_role,
        current_status,
        target_status,
        &ticket.current_handler_id,
        &user.id,
    );
    if !can_process {
        return Err(AppError::StatusConflict(reason.unwrap_or_else(|| "状态流转不合法".to_string())));
    }

    let need_evidence = matches!(
        (current_status, target_status),
        (TicketStatus::ExceptionReturned, TicketStatus::CallRegistered)
            | (TicketStatus::CallRegistered, TicketStatus::Dispatched)
            | (TicketStatus::Dispatched, TicketStatus::CallbackClosed)
    );
    if need_evidence {
        let has_ev = match &req.evidence {
            Some(e) => !e.is_empty(),
            None => !detail.attachments.is_empty(),
        };
        if !has_ev {
            return Err(AppError::MissingEvidence("此操作需要至少一个附件或处理证据".to_string()));
        }
    }

    let priority = Priority::from_str(&ticket.priority).unwrap_or(Priority::Medium);
    let (next_handler_id, next_handler_name, _hint) = compute_next_handler(
        pool,
        current_status,
        target_status,
        priority,
        &ticket.current_handler_id,
        &ticket.current_handler_name,
        &user.id,
        &user.name,
    ).await?;

    let mut tx = pool.begin().await?;

    let new_version = ticket.version + 1;
    let mut return_reason = detail.return_reason.clone();
    let mut processing_result = detail.processing_result.clone();
    let mut new_exception_tags = ticket.exception_tags.clone();

    if target_status == TicketStatus::ExceptionReturned {
        return_reason = req.return_reason.clone();
        if user_role == Role::QaSupervisor {
            if !new_exception_tags.contains(&"质检退回".to_string()) {
                new_exception_tags.push("质检退回".to_string());
            }
        } else {
            if !new_exception_tags.contains(&"退回补正".to_string()) {
                new_exception_tags.push("退回补正".to_string());
            }
        }
        if let Some(rr) = &req.return_reason {
            let reason_type = if user_role == Role::QaSupervisor { "质检退回" } else { "退回补正" };
            sqlx::query(
                r#"INSERT INTO exception_reasons (id, ticket_id, reason_type, description, reported_by, reported_by_name, resolved)
                   VALUES (?, ?, ?, ?, ?, ?, 0)"#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(ticket_id)
            .bind(reason_type)
            .bind(rr)
            .bind(&user.id)
            .bind(&user.name)
            .execute(&mut *tx)
            .await?;
        }
    } else if current_status == TicketStatus::ExceptionReturned {
        return_reason = None;
    }

    if matches!(target_status, TicketStatus::CallbackClosed | TicketStatus::ReceiptCompleted) {
        processing_result = req.processing_result.clone();
    }

    let tags_json = serde_json::to_string(&new_exception_tags).unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        r#"UPDATE tickets SET status = ?, version = ?, current_handler_id = ?, current_handler_name = ?,
            exception_tags = ?, processing_result = ?, return_reason = ? WHERE id = ?"#,
    )
    .bind(target_status.as_str())
    .bind(new_version)
    .bind(&next_handler_id)
    .bind(&next_handler_name)
    .bind(&tags_json)
    .bind(&processing_result)
    .bind(&return_reason)
    .bind(ticket_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"INSERT INTO processing_records (id, ticket_id, action, from_status, to_status,
            from_handler_id, from_handler_name, to_handler_id, to_handler_name,
            operator_id, operator_name, operator_role, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(ticket_id)
    .bind(&req.action)
    .bind(current_status.as_str())
    .bind(target_status.as_str())
    .bind(&ticket.current_handler_id)
    .bind(&ticket.current_handler_name)
    .bind(&next_handler_id)
    .bind(&next_handler_name)
    .bind(&user.id)
    .bind(&user.name)
    .bind(&user.role)
    .bind(&req.remark)
    .execute(&mut *tx)
    .await?;

    if let Some(remark) = &req.remark {
        if !remark.is_empty() {
            sqlx::query(
                r#"INSERT INTO audit_remarks (id, ticket_id, content, operator_id, operator_name, operator_role)
                   VALUES (?, ?, ?, ?, ?, ?)"#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(ticket_id)
            .bind(remark)
            .bind(&user.id)
            .bind(&user.name)
            .bind(&user.role)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    get_ticket_detail(pool, ticket_id).await
}

pub async fn batch_process_tickets(
    pool: &Pool<Sqlite>,
    user: &User,
    req: &BatchProcessRequest,
) -> Result<BatchProcessResponse, AppError> {
    let mut results = Vec::new();
    let mut success_count = 0i64;
    let mut failed_count = 0i64;

    for ticket_id in &req.ticket_ids {
        let version = req
            .version_map
            .as_ref()
            .and_then(|m| m.get(ticket_id))
            .copied()
            .unwrap_or(1);

        let evidence = req.evidence.as_ref().and_then(|m| m.get(ticket_id).cloned());

        let process_req = ProcessTicketRequest {
            action: req.action.clone(),
            target_status: req.target_status.clone(),
            remark: req.remark.clone(),
            processing_result: None,
            return_reason: None,
            version,
            evidence_required: None,
            evidence,
        };

        match process_ticket(pool, user, ticket_id, &process_req).await {
            Ok(detail) => {
                success_count += 1;
                results.push(BatchProcessResultItem {
                    ticket_id: ticket_id.clone(),
                    success: true,
                    message: "处理成功".to_string(),
                    failed_reason: None,
                    new_status: Some(detail.ticket.status_display),
                    new_status_key: Some(detail.ticket.status),
                    new_handler_id: Some(detail.ticket.current_handler_id),
                    new_handler_name: Some(detail.ticket.current_handler_name),
                });
            }
            Err(e) => {
                failed_count += 1;
                let msg = e.to_string();
                let failed_reason = match e {
                    AppError::VersionConflict(_) => Some("版本冲突，工单已被其他人更新，请刷新后重试".to_string()),
                    AppError::StatusConflict(_) => Some("状态或处理人冲突，当前身份无权处理此工单".to_string()),
                    AppError::MissingEvidence(_) => Some("缺少证据材料，请先上传附件".to_string()),
                    AppError::Forbidden(_) => Some("越权操作，此角色无法执行该动作".to_string()),
                    _ => Some(msg.clone()),
                };
                results.push(BatchProcessResultItem {
                    ticket_id: ticket_id.clone(),
                    success: false,
                    message: msg,
                    failed_reason,
                    new_status: None,
                    new_status_key: None,
                    new_handler_id: None,
                    new_handler_name: None,
                });
            }
        }
    }

    Ok(BatchProcessResponse {
        total: req.ticket_ids.len() as i64,
        success_count,
        failed_count,
        results,
    })
}

pub async fn add_attachment(
    pool: &Pool<Sqlite>,
    user: &User,
    ticket_id: &str,
    req: &AddAttachmentRequest,
) -> Result<Attachment, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"INSERT INTO attachments (id, ticket_id, filename, file_type, uploaded_by, uploaded_by_name, uploaded_at, url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(ticket_id)
    .bind(&req.filename)
    .bind(&req.file_type)
    .bind(&user.id)
    .bind(&user.name)
    .bind(now)
    .bind(&req.url)
    .execute(pool)
    .await?;

    Ok(Attachment {
        id,
        ticket_id: ticket_id.to_string(),
        filename: req.filename.clone(),
        file_type: req.file_type.clone(),
        uploaded_by: user.id.clone(),
        uploaded_by_name: user.name.clone(),
        uploaded_at: now,
        url: req.url.clone(),
    })
}

pub async fn add_audit_remark(
    pool: &Pool<Sqlite>,
    user: &User,
    ticket_id: &str,
    req: &AddAuditRemarkRequest,
) -> Result<AuditRemark, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"INSERT INTO audit_remarks (id, ticket_id, content, operator_id, operator_name, operator_role, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(ticket_id)
    .bind(&req.content)
    .bind(&user.id)
    .bind(&user.name)
    .bind(&user.role)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(AuditRemark {
        id,
        ticket_id: ticket_id.to_string(),
        content: req.content.clone(),
        operator_id: user.id.clone(),
        operator_name: user.name.clone(),
        operator_role: user.role.clone(),
        created_at: now,
    })
}

pub async fn add_exception_reason(
    pool: &Pool<Sqlite>,
    user: &User,
    ticket_id: &str,
    req: &AddExceptionReasonRequest,
) -> Result<ExceptionReason, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"INSERT INTO exception_reasons (id, ticket_id, reason_type, description, reported_by, reported_by_name, created_at, resolved)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)"#,
    )
    .bind(&id)
    .bind(ticket_id)
    .bind(&req.reason_type)
    .bind(&req.description)
    .bind(&user.id)
    .bind(&user.name)
    .bind(now)
    .execute(pool)
    .await?;

    Ok(ExceptionReason {
        id,
        ticket_id: ticket_id.to_string(),
        reason_type: req.reason_type.clone(),
        description: req.description.clone(),
        reported_by: user.id.clone(),
        reported_by_name: user.name.clone(),
        created_at: now,
        resolved: false,
    })
}

pub async fn get_statistics(pool: &Pool<Sqlite>, user: &User) -> Result<TicketStatistics, AppError> {
    let role = Role::from_str(&user.role).unwrap_or(Role::Agent);

    let base_conds: Vec<String>;
    let base_binds: Vec<String>;
    match role {
        Role::Agent | Role::Registrar => {
            base_conds = vec!["(current_handler_id = ? OR responsible_id = ?)".to_string()];
            base_binds = vec![user.id.clone(), user.id.clone()];
        }
        Role::Supervisor | Role::QaSupervisor => {
            base_conds = vec!["status IN (?, ?, ?)".to_string()];
            base_binds = vec![
                TicketStatus::CallRegistered.as_str().to_string(),
                TicketStatus::Dispatched.as_str().to_string(),
                TicketStatus::ExceptionReturned.as_str().to_string(),
            ];
        }
        _ => {
            base_conds = Vec::new();
            base_binds = Vec::new();
        }
    }

    let base_where = if base_conds.is_empty() { String::new() } else { format!("WHERE {}", base_conds.join(" AND ")) };
    let and_where = if base_conds.is_empty() { String::new() } else { format!("AND {}", base_conds.join(" AND ")) };

    let total: i64 = {
        let mut q = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM tickets {}", base_where));
        for b in &base_binds { q = q.bind(b); }
        q.fetch_one(pool).await?
    };

    let pending_statuses = [TicketStatus::PendingReceipt.as_str(), TicketStatus::ExceptionReturned.as_str()];
    let pending: i64 = {
        let mut q = sqlx::query_scalar::<_, i64>(&format!(
            "SELECT COUNT(*) FROM tickets WHERE status IN (?, ?) {}", and_where
        )).bind(pending_statuses[0]).bind(pending_statuses[1]);
        for b in &base_binds { q = q.bind(b); }
        q.fetch_one(pool).await?
    };

    let processing_statuses = [TicketStatus::CallRegistered.as_str(), TicketStatus::Dispatched.as_str()];
    let processing: i64 = {
        let mut q = sqlx::query_scalar::<_, i64>(&format!(
            "SELECT COUNT(*) FROM tickets WHERE status IN (?, ?) {}", and_where
        )).bind(processing_statuses[0]).bind(processing_statuses[1]);
        for b in &base_binds { q = q.bind(b); }
        q.fetch_one(pool).await?
    };

    let completed_statuses = [TicketStatus::ReceiptCompleted.as_str(), TicketStatus::CallbackClosed.as_str(), TicketStatus::Archived.as_str()];
    let completed: i64 = {
        let mut q = sqlx::query_scalar::<_, i64>(&format!(
            "SELECT COUNT(*) FROM tickets WHERE status IN (?, ?, ?) {}", and_where
        )).bind(completed_statuses[0]).bind(completed_statuses[1]).bind(completed_statuses[2]);
        for b in &base_binds { q = q.bind(b); }
        q.fetch_one(pool).await?
    };

    let overdue: i64 = {
        let mut q = sqlx::query_scalar::<_, i64>(&format!(
            "SELECT COUNT(*) FROM tickets WHERE deadline < ? {}", and_where
        )).bind(Utc::now());
        for b in &base_binds { q = q.bind(b); }
        q.fetch_one(pool).await?
    };

    let exception: i64 = {
        let mut q = sqlx::query_scalar::<_, i64>(&format!(
            "SELECT COUNT(*) FROM tickets WHERE (exception_tags != '[]' OR status = ?) {}", and_where
        )).bind(TicketStatus::ExceptionReturned.as_str());
        for b in &base_binds { q = q.bind(b); }
        q.fetch_one(pool).await?
    };

    Ok(TicketStatistics {
        total,
        pending,
        processing,
        completed,
        overdue,
        exception,
    })
}
