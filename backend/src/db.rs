use sqlx::{SqlitePool, sqlite::SqlitePoolOptions, Row};
use chrono::{Utc, Duration, NaiveDateTime};
use uuid::Uuid;

use crate::models::*;

pub async fn init_db() -> anyhow::Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect("sqlite:./beauty_appointments.db?mode=rwc")
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS beauty_appointments (
            id TEXT PRIMARY KEY,
            order_no TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            service_item TEXT NOT NULL,
            beautician TEXT NOT NULL,
            consultant TEXT NOT NULL,
            store_manager TEXT NOT NULL,
            status TEXT NOT NULL,
            current_handler TEXT NOT NULL,
            current_handler_role TEXT NOT NULL,
            appointment_time TEXT NOT NULL,
            deadline TEXT NOT NULL,
            exception_type TEXT,
            exception_reason TEXT,
            correction_note TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS appointment_attachments (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            evidence_type TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_url TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES beauty_appointments(id)
        )
        "#
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS audit_trails (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            operator TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            remark TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES beauty_appointments(id)
        )
        "#
    )
    .execute(&pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS processing_records (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            action TEXT NOT NULL,
            handler TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            detail TEXT,
            exception_reason TEXT,
            correction_note TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES beauty_appointments(id)
        )
        "#
    )
    .execute(&pool)
    .await?;

    Ok(pool)
}

pub async fn seed_data(pool: &SqlitePool) -> anyhow::Result<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM beauty_appointments")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    let now = Utc::now();

    let appointments = vec![
        Appointment {
            id: Uuid::new_v4().to_string(),
            order_no: "MR20260601001".to_string(),
            customer_name: "张美丽".to_string(),
            customer_phone: "13800138001".to_string(),
            service_item: "面部深层护理".to_string(),
            beautician: "护理师-李娜".to_string(),
            consultant: "美容顾问-陈静".to_string(),
            store_manager: "店长-王芳".to_string(),
            status: "draft".to_string(),
            current_handler: "护理师-李娜".to_string(),
            current_handler_role: "beautician".to_string(),
            appointment_time: (now + Duration::days(2)).format("%Y-%m-%d %H:%M:%S").to_string(),
            deadline: (now + Duration::days(5)).format("%Y-%m-%d %H:%M:%S").to_string(),
            exception_type: None,
            exception_reason: None,
            correction_note: None,
            version: 1,
            created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        },
        Appointment {
            id: Uuid::new_v4().to_string(),
            order_no: "MR20260601002".to_string(),
            customer_name: "刘优雅".to_string(),
            customer_phone: "13800138002".to_string(),
            service_item: "肩颈舒缓SPA".to_string(),
            beautician: "护理师-赵敏".to_string(),
            consultant: "美容顾问-林美".to_string(),
            store_manager: "店长-王芳".to_string(),
            status: "pending_review".to_string(),
            current_handler: "美容顾问-陈静".to_string(),
            current_handler_role: "consultant".to_string(),
            appointment_time: (now + Duration::days(1)).format("%Y-%m-%d %H:%M:%S").to_string(),
            deadline: (now + Duration::hours(20)).format("%Y-%m-%d %H:%M:%S").to_string(),
            exception_type: Some("missing_materials".to_string()),
            exception_reason: Some("缺少顾客签字的服务确认单，需补签后提交复核".to_string()),
            correction_note: None,
            version: 1,
            created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        },
        Appointment {
            id: Uuid::new_v4().to_string(),
            order_no: "MR20260601003".to_string(),
            customer_name: "王小姐".to_string(),
            customer_phone: "13800138003".to_string(),
            service_item: "全身淋巴排毒".to_string(),
            beautician: "护理师-李娜".to_string(),
            consultant: "美容顾问-陈静".to_string(),
            store_manager: "店长-王芳".to_string(),
            status: "pending_review".to_string(),
            current_handler: "店长-王芳".to_string(),
            current_handler_role: "store_manager".to_string(),
            appointment_time: (now - Duration::days(1)).format("%Y-%m-%d %H:%M:%S").to_string(),
            deadline: (now - Duration::hours(2)).format("%Y-%m-%d %H:%M:%S").to_string(),
            exception_type: Some("overdue".to_string()),
            exception_reason: Some("已超过处理期限2小时，护理师未按时提交项目确认照片".to_string()),
            correction_note: None,
            version: 2,
            created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        },
        Appointment {
            id: Uuid::new_v4().to_string(),
            order_no: "MR20260601004".to_string(),
            customer_name: "赵太太".to_string(),
            customer_phone: "13800138004".to_string(),
            service_item: "眼部抗衰护理".to_string(),
            beautician: "护理师-赵敏".to_string(),
            consultant: "美容顾问-林美".to_string(),
            store_manager: "店长-王芳".to_string(),
            status: "pending_review".to_string(),
            current_handler: "护理师-赵敏".to_string(),
            current_handler_role: "beautician".to_string(),
            appointment_time: (now + Duration::days(3)).format("%Y-%m-%d %H:%M:%S").to_string(),
            deadline: (now + Duration::days(1)).format("%Y-%m-%d %H:%M:%S").to_string(),
            exception_type: Some("returned".to_string()),
            exception_reason: Some("店长退回：回访照片不清晰，需重新拍摄；服务确认单缺少项目明细".to_string()),
            correction_note: Some("护理师已重新拍摄高清照片，补充完整服务确认单明细").to_string(),
            version: 3,
            created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        },
        Appointment {
            id: Uuid::new_v4().to_string(),
            order_no: "MR20260601005".to_string(),
            customer_name: "孙女士".to_string(),
            customer_phone: "13800138005".to_string(),
            service_item: "面部补水嫩肤".to_string(),
            beautician: "护理师-李娜".to_string(),
            consultant: "美容顾问-陈静".to_string(),
            store_manager: "店长-王芳".to_string(),
            status: "archived".to_string(),
            current_handler: "已归档".to_string(),
            current_handler_role: "archived".to_string(),
            appointment_time: (now - Duration::days(7)).format("%Y-%m-%d %H:%M:%S").to_string(),
            deadline: (now - Duration::days(5)).format("%Y-%m-%d %H:%M:%S").to_string(),
            exception_type: None,
            exception_reason: None,
            correction_note: None,
            version: 4,
            created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        },
    ];

    for apt in &appointments {
        sqlx::query(
            r#"
            INSERT INTO beauty_appointments (
                id, order_no, customer_name, customer_phone, service_item,
                beautician, consultant, store_manager, status, current_handler,
                current_handler_role, appointment_time, deadline, exception_type,
                exception_reason, correction_note, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&apt.id)
        .bind(&apt.order_no)
        .bind(&apt.customer_name)
        .bind(&apt.customer_phone)
        .bind(&apt.service_item)
        .bind(&apt.beautician)
        .bind(&apt.consultant)
        .bind(&apt.store_manager)
        .bind(&apt.status)
        .bind(&apt.current_handler)
        .bind(&apt.current_handler_role)
        .bind(&apt.appointment_time)
        .bind(&apt.deadline)
        .bind(&apt.exception_type)
        .bind(&apt.exception_reason)
        .bind(&apt.correction_note)
        .bind(apt.version)
        .bind(&apt.created_at)
        .bind(&apt.updated_at)
        .execute(pool)
        .await?;

        seed_attachments(pool, apt).await?;
        seed_audit_trails(pool, apt).await?;
        seed_processing_records(pool, apt).await?;
    }

    Ok(())
}

async fn seed_attachments(pool: &SqlitePool, apt: &Appointment) -> anyhow::Result<()> {
    let now = Utc::now();
    let attachments = match apt.order_no.as_str() {
        "MR20260601001" => vec![
            ("customer_appointment", "预约登记表.jpg", "/static/evidence/1-1.jpg", "护理师-李娜"),
        ],
        "MR20260601002" => vec![
            ("customer_appointment", "预约登记表.jpg", "/static/evidence/2-1.jpg", "护理师-赵敏"),
        ],
        "MR20260601003" => vec![
            ("customer_appointment", "预约登记表.jpg", "/static/evidence/3-1.jpg", "护理师-李娜"),
            ("project_confirmation", "项目确认单(缺签字).jpg", "/static/evidence/3-2.jpg", "护理师-李娜"),
        ],
        "MR20260601004" => vec![
            ("customer_appointment", "预约登记表.jpg", "/static/evidence/4-1.jpg", "护理师-赵敏"),
            ("project_confirmation", "项目确认单.jpg", "/static/evidence/4-2.jpg", "护理师-赵敏"),
            ("service_followup", "首次回访照片(模糊).jpg", "/static/evidence/4-3.jpg", "美容顾问-林美"),
        ],
        "MR20260601005" => vec![
            ("customer_appointment", "预约登记表.jpg", "/static/evidence/5-1.jpg", "护理师-李娜"),
            ("project_confirmation", "项目确认单.jpg", "/static/evidence/5-2.jpg", "护理师-李娜"),
            ("service_followup", "服务回访记录.jpg", "/static/evidence/5-3.jpg", "美容顾问-陈静"),
            ("service_followup", "顾客满意度反馈.jpg", "/static/evidence/5-4.jpg", "美容顾问-陈静"),
        ],
        _ => vec![],
    };

    for (etype, fname, furl, uploader) in attachments {
        sqlx::query(
            r#"
            INSERT INTO appointment_attachments (id, appointment_id, evidence_type, file_name, file_url, uploaded_by, uploaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&apt.id)
        .bind(etype)
        .bind(fname)
        .bind(furl)
        .bind(uploader)
        .bind(now.format("%Y-%m-%d %H:%M:%S").to_string())
        .execute(pool)
        .await?;
    }
    Ok(())
}

async fn seed_audit_trails(pool: &SqlitePool, apt: &Appointment) -> anyhow::Result<()> {
    let now = Utc::now();
    let trails = match apt.order_no.as_str() {
        "MR20260601001" => vec![
            ("create", None, Some("draft"), "护理师-李娜", "beautician", "新建预约单"),
        ],
        "MR20260601002" => vec![
            ("create", None, Some("draft"), "护理师-赵敏", "beautician", "新建预约单"),
            ("submit_review", Some("draft"), Some("pending_review"), "护理师-赵敏", "beautician", "提交复核，标记缺材料"),
        ],
        "MR20260601003" => vec![
            ("create", None, Some("draft"), "护理师-李娜", "beautician", "新建预约单"),
            ("submit_review", Some("draft"), Some("pending_review"), "护理师-李娜", "beautician", "提交复核"),
            ("mark_overdue", Some("pending_review"), Some("pending_review"), "系统", "system", "系统自动标记逾期"),
        ],
        "MR20260601004" => vec![
            ("create", None, Some("draft"), "护理师-赵敏", "beautician", "新建预约单"),
            ("submit_review", Some("draft"), Some("pending_review"), "护理师-赵敏", "beautician", "提交复核"),
            ("return_to_correct", Some("pending_review"), Some("pending_review"), "店长-王芳", "store_manager", "退回补正：回访照片不清晰"),
            ("correction_submit", Some("pending_review"), Some("pending_review"), "护理师-赵敏", "beautician", "补正后重新提交"),
        ],
        "MR20260601005" => vec![
            ("create", None, Some("draft"), "护理师-李娜", "beautician", "新建预约单"),
            ("submit_review", Some("draft"), Some("pending_review"), "护理师-李娜", "beautician", "提交复核"),
            ("review_pass", Some("pending_review"), Some("pending_review"), "美容顾问-陈静", "consultant", "复核通过"),
            ("archive", Some("pending_review"), Some("archived"), "店长-王芳", "store_manager", "归档完成"),
        ],
        _ => vec![],
    };

    for (action, from_s, to_s, operator, role, remark) in trails {
        sqlx::query(
            r#"
            INSERT INTO audit_trails (id, appointment_id, action, from_status, to_status, operator, operator_role, remark, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&apt.id)
        .bind(action)
        .bind(from_s)
        .bind(to_s)
        .bind(operator)
        .bind(role)
        .bind(remark)
        .bind(now.format("%Y-%m-%d %H:%M:%S").to_string())
        .execute(pool)
        .await?;
    }
    Ok(())
}

async fn seed_processing_records(pool: &SqlitePool, apt: &Appointment) -> anyhow::Result<()> {
    let now = Utc::now();
    let records = match apt.order_no.as_str() {
        "MR20260601004" => vec![
            ("correction", "护理师-赵敏", "beautician", "补正内容：重新拍摄高清回访照片2张，补充服务确认单的项目明细栏，已附上顾客签字确认", None, Some("护理师已重新拍摄高清照片，补充完整服务确认单明细")),
        ],
        _ => vec![],
    };

    for (action, handler, role, detail, exc, corr) in records {
        sqlx::query(
            r#"
            INSERT INTO processing_records (id, appointment_id, action, handler, handler_role, detail, exception_reason, correction_note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&apt.id)
        .bind(action)
        .bind(handler)
        .bind(role)
        .bind(detail)
        .bind(exc)
        .bind(corr)
        .bind(now.format("%Y-%m-%d %H:%M:%S").to_string())
        .execute(pool)
        .await?;
    }
    Ok(())
}

pub fn calculate_deadline_status(deadline: &str) -> DeadlineStatus {
    let dl = NaiveDateTime::parse_from_str(deadline, "%Y-%m-%d %H:%M:%S");
    let now = Utc::now().naive_utc();
    match dl {
        Ok(dl_naive) => {
            if dl_naive < now {
                DeadlineStatus::Overdue
            } else if (dl_naive - now) <= Duration::hours(24) {
                DeadlineStatus::Approaching
            } else {
                DeadlineStatus::Normal
            }
        }
        Err(_) => DeadlineStatus::Normal,
    }
}
