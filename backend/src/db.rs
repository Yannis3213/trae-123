use sqlx::{SqlitePool, sqlite::SqlitePoolOptions, migrate::MigrateDatabase, Sqlite, Row};
use std::env;
use anyhow::Result;
use crate::models::{UserRole, OrderStatus};
use uuid::Uuid;
use bcrypt::{hash, DEFAULT_COST};
use chrono::Utc;

pub async fn init_db(database_url: &str) -> Result<SqlitePool> {
    if !Sqlite::database_exists(database_url).await.unwrap_or(false) {
        Sqlite::create_database(database_url).await?;
    }

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    run_migrations(&pool).await?;
    seed_demo_data(&pool).await?;
    refresh_overdue_flags(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tour_orders (
            id TEXT PRIMARY KEY,
            order_no TEXT UNIQUE NOT NULL,
            route_name TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            traveler_count INTEGER NOT NULL,
            departure_date TEXT NOT NULL,
            return_date TEXT NOT NULL,
            quoted_price REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            current_handler_id TEXT,
            current_handler_name TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            is_overdue INTEGER NOT NULL DEFAULT 0,
            deadline TEXT,
            exception_reason TEXT,
            correction_note TEXT,
            route_quote_evidence INTEGER NOT NULL DEFAULT 0,
            registration_confirm_evidence INTEGER NOT NULL DEFAULT 0,
            tour_audit_evidence INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (current_handler_id) REFERENCES users(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            evidence_type TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_by_name TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES tour_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS processing_records (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            action TEXT NOT NULL,
            handler_id TEXT NOT NULL,
            handler_name TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            note TEXT,
            exception_reason TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES tour_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (handler_id) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS audit_notes (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_by_name TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES tour_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_orders_status ON tour_orders(status)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_orders_handler ON tour_orders(current_handler_id)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_orders_overdue ON tour_orders(is_overdue)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_orders_created ON tour_orders(created_by)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_records_order ON processing_records(order_id)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_notes(order_id)").execute(pool).await?;

    Ok(())
}

pub async fn refresh_overdue_flags(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        r#"
        UPDATE tour_orders
        SET is_overdue = CASE
            WHEN deadline IS NOT NULL AND datetime(deadline) < datetime('now') AND status NOT IN ('archived', 'rejected') THEN 1
            ELSE 0
        END
        WHERE status NOT IN ('archived', 'rejected')
        "#
    ).execute(pool).await?;
    Ok(())
}

async fn seed_demo_data(pool: &SqlitePool) -> Result<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    let password = env::var("DEMO_PASSWORD").unwrap_or_else(|_| "123456".to_string());
    let password_hash = hash(&password, DEFAULT_COST)?;

    let registrar_id = Uuid::new_v4();
    let auditor_id = Uuid::new_v4();
    let reviewer_id = Uuid::new_v4();

    let users = vec![
        (registrar_id, "registrar", "旅游登记员", UserRole::Registrar),
        (auditor_id, "auditor", "旅游审核主管", UserRole::Auditor),
        (reviewer_id, "reviewer", "旅行社复核负责人", UserRole::Reviewer),
    ];

    for (id, username, display_name, role) in &users {
        sqlx::query(
            "INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(id.to_string())
        .bind(*username)
        .bind(&password_hash)
        .bind(role.as_str())
        .bind(*display_name)
        .execute(pool)
        .await?;
    }

    let now = Utc::now();
    let fmt = |dt: chrono::DateTime<Utc>| dt.to_rfc3339();

    let sample_orders: Vec<(
        Uuid, &str, &str, &str, &str, i32,
        chrono::DateTime<Utc>, chrono::DateTime<Utc>, f64,
        OrderStatus, Option<Uuid>, Option<&str>, i32, bool,
        Option<chrono::DateTime<Utc>>, bool, bool, bool,
        Uuid,
        Option<&str>, Option<&str>,
    )> = vec![
        (
            Uuid::new_v4(),
            "TO-20260611-001",
            "北京经典五日游（故宫+长城+颐和园）",
            "张三",
            "13800138001",
            4,
            now + chrono::Duration::days(10),
            now + chrono::Duration::days(15),
            12800.0,
            OrderStatus::Draft,
            Some(registrar_id),
            Some("旅游登记员"),
            1,
            false,
            Some(now + chrono::Duration::days(3)),
            true, false, false,
            registrar_id,
            None, None,
        ),
        (
            Uuid::new_v4(),
            "TO-20260611-002",
            "上海-苏州-杭州文化七日游",
            "李四",
            "13800138002",
            2,
            now + chrono::Duration::days(20),
            now + chrono::Duration::days(27),
            9600.0,
            OrderStatus::PendingAudit,
            None, None,
            2,
            false,
            Some(now + chrono::Duration::days(1)),
            true, true, false,
            registrar_id,
            None, None,
        ),
        (
            Uuid::new_v4(),
            "TO-20260611-003",
            "云南昆明-大理-丽江深度六日游",
            "王五",
            "13800138003",
            6,
            now + chrono::Duration::days(5),
            now + chrono::Duration::days(11),
            18600.0,
            OrderStatus::PendingCorrection,
            Some(registrar_id),
            Some("旅游登记员"),
            3,
            true,
            Some(now - chrono::Duration::days(1)),
            true, false, false,
            registrar_id,
            Some("出团日期临近，需重新确认行程细节和客户需求"),
            Some("审核退回：行程细节不完整，缺少身份证登记信息"),
        ),
        (
            Uuid::new_v4(),
            "TO-20260611-004",
            "海南三亚亚龙湾五日休闲游",
            "赵六",
            "13800138004",
            3,
            now + chrono::Duration::days(30),
            now + chrono::Duration::days(35),
            15600.0,
            OrderStatus::PendingReview,
            None, None,
            4,
            false,
            Some(now + chrono::Duration::days(2)),
            true, true, true,
            registrar_id,
            None, None,
        ),
        (
            Uuid::new_v4(),
            "TO-20260611-005",
            "西藏拉萨-林芝-纳木错全景九日游",
            "孙七",
            "13800138005",
            5,
            now + chrono::Duration::days(25),
            now + chrono::Duration::days(34),
            32800.0,
            OrderStatus::PendingCorrection,
            Some(registrar_id),
            Some("旅游登记员"),
            5,
            false,
            Some(now + chrono::Duration::days(4)),
            true, true, false,
            registrar_id,
            Some("复核退回：缺少高反健康告知书和保险单；部分行程酒店未确认"),
            Some("复核负责人要求 48 小时内补正高反健康告知书、旅游意外险保单，并出具拉萨酒店确认函"),
        ),
        (
            Uuid::new_v4(),
            "TO-20260611-006",
            "泰国曼谷-芭提雅七日跟团游",
            "周八",
            "13800138006",
            6,
            now + chrono::Duration::days(45),
            now + chrono::Duration::days(52),
            46800.0,
            OrderStatus::Archived,
            None, None,
            6,
            false,
            Some(now - chrono::Duration::hours(2)),
            true, true, true,
            registrar_id,
            None,
            Some("已归档：线路报价、报名确认、出团审核三类证据齐全，签证机票酒店均已落实"),
        ),
    ];

    for (
        id, order_no, route_name, customer_name, customer_phone,
        traveler_count, departure_date, return_date, quoted_price,
        status, handler_id, handler_name, version, is_overdue, deadline,
        route_quote, registration, tour_audit, created_by,
        exception_reason, correction_note,
    ) in sample_orders
    {
        sqlx::query(
            r#"
            INSERT INTO tour_orders (
                id, order_no, route_name, customer_name, customer_phone,
                traveler_count, departure_date, return_date, quoted_price,
                status, current_handler_id, current_handler_name, version, is_overdue, deadline,
                route_quote_evidence, registration_confirm_evidence, tour_audit_evidence,
                exception_reason, correction_note,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(id.to_string())
        .bind(order_no)
        .bind(route_name)
        .bind(customer_name)
        .bind(customer_phone)
        .bind(traveler_count)
        .bind(fmt(departure_date))
        .bind(fmt(return_date))
        .bind(quoted_price)
        .bind(status.as_str())
        .bind(handler_id.map(|u| u.to_string()))
        .bind(handler_name)
        .bind(version)
        .bind(if is_overdue { 1 } else { 0 })
        .bind(deadline.map(fmt))
        .bind(if route_quote { 1 } else { 0 })
        .bind(if registration { 1 } else { 0 })
        .bind(if tour_audit { 1 } else { 0 })
        .bind(exception_reason)
        .bind(correction_note)
        .bind(created_by.to_string())
        .bind(fmt(now))
        .bind(fmt(now))
        .execute(pool)
        .await?;

        add_seed_records(pool, &id, &status, &created_by, &users, version, &auditor_id, &reviewer_id).await?;
        add_seed_audit_notes(pool, &id, &status, &version, &auditor_id, &reviewer_id, &users).await?;
    }

    Ok(())
}

async fn add_seed_records(
    pool: &SqlitePool,
    order_id: &Uuid,
    _status: &OrderStatus,
    created_by: &Uuid,
    users: &[(Uuid, &'static str, &'static str, UserRole)],
    version: i32,
    auditor_id: &Uuid,
    reviewer_id: &Uuid,
) -> Result<()> {
    let find_user = |uid: &Uuid| -> (String, String, String) {
        users.iter()
            .find(|(id, _, _, _)| id == uid)
            .map(|(_, _, name, role)| (uid.to_string(), name.to_string(), role.as_str().to_string()))
            .unwrap_or_else(|| (uid.to_string(), "系统".to_string(), "registrar".to_string()))
    };

    let now = Utc::now().to_rfc3339();
    let (reg_id, reg_name, reg_role) = find_user(created_by);
    let (aud_id, aud_name, aud_role) = find_user(auditor_id);
    let (rev_id, rev_name, rev_role) = find_user(reviewer_id);

    let push = |from: Option<&OrderStatus>, to: &OrderStatus, action: &str, hi: &str, hn: &str, hr: &str| -> String {
        format!(
            "INSERT INTO processing_records \
            (id, order_id, from_status, to_status, action, handler_id, handler_name, handler_role, created_at) \
            VALUES ('{}', '{}', {}, '{}', '{}', '{}', '{}', '{}', '{}')",
            Uuid::new_v4().to_string(),
            order_id.to_string(),
            from.map(|s| format!("'{}'", s.as_str())).unwrap_or_else(|| "NULL".to_string()),
            to.as_str(),
            action,
            hi, hn, hr,
            &now,
        )
    };

    let push_with_meta = |from: Option<&OrderStatus>, to: &OrderStatus, action: &str, hi: &str, hn: &str, hr: &str, note: Option<&str>, exc: Option<&str>| -> String {
        let note_sql = note.map(|s| format!("'{}'", s.replace('\'', "''"))).unwrap_or_else(|| "NULL".to_string());
        let exc_sql = exc.map(|s| format!("'{}'", s.replace('\'', "''"))).unwrap_or_else(|| "NULL".to_string());
        format!(
            "INSERT INTO processing_records \
            (id, order_id, from_status, to_status, action, handler_id, handler_name, handler_role, created_at, note, exception_reason) \
            VALUES ('{}', '{}', {}, '{}', '{}', '{}', '{}', '{}', '{}', {}, {})",
            Uuid::new_v4().to_string(),
            order_id.to_string(),
            from.map(|s| format!("'{}'", s.as_str())).unwrap_or_else(|| "NULL".to_string()),
            to.as_str(),
            action,
            hi, hn, hr,
            &now, note_sql, exc_sql,
        )
    };

    match version {
        1 => {
            sqlx::query(&push(None, &OrderStatus::Draft, "创建草稿", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
        }
        2 => {
            sqlx::query(&push(None, &OrderStatus::Draft, "创建草稿", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push(Some(&OrderStatus::Draft), &OrderStatus::PendingAudit, "提交审核", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
        }
        3 => {
            sqlx::query(&push(None, &OrderStatus::Draft, "创建草稿", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push(Some(&OrderStatus::Draft), &OrderStatus::PendingAudit, "提交审核", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push_with_meta(
                Some(&OrderStatus::PendingAudit),
                &OrderStatus::PendingCorrection,
                "退回补正（逾期）",
                &aud_id, &aud_name, &aud_role,
                Some("请登记员在24小时内补正行程细节和客户身份证信息"),
                Some("出团日期临近，需重新确认行程细节和客户需求"),
            )).execute(pool).await?;
        }
        4 => {
            sqlx::query(&push(None, &OrderStatus::Draft, "创建草稿", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push(Some(&OrderStatus::Draft), &OrderStatus::PendingAudit, "提交审核", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push_with_meta(
                Some(&OrderStatus::PendingAudit),
                &OrderStatus::PendingReview,
                "审核通过，待复核",
                &aud_id, &aud_name, &aud_role,
                Some("线路报价和报名确认证据齐全，转复核负责人归档前终校"),
                None,
            )).execute(pool).await?;
        }
        5 => {
            // 西藏九日游：草稿→提交审核→审核通过（待复核）→复核退回（待补正）
            sqlx::query(&push(None, &OrderStatus::Draft, "创建草稿", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push(Some(&OrderStatus::Draft), &OrderStatus::PendingAudit, "提交审核", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push_with_meta(
                Some(&OrderStatus::PendingAudit),
                &OrderStatus::PendingReview,
                "审核通过，待复核",
                &aud_id, &aud_name, &aud_role,
                Some("基础材料齐全，转复核前终校；注意高反项目需补充"),
                None,
            )).execute(pool).await?;
            sqlx::query(&push_with_meta(
                Some(&OrderStatus::PendingReview),
                &OrderStatus::PendingCorrection,
                "复核退回补正",
                &rev_id, &rev_name, &rev_role,
                Some("要求 48 小时内补正高反健康告知书、旅游意外险保单，并出具拉萨酒店确认函"),
                Some("缺少高反健康告知书和保险单；部分行程酒店未确认"),
            )).execute(pool).await?;
        }
        6 => {
            // 泰国跟团游：草稿→提交审核→审核通过（待复核）→复核通过（已归档）
            sqlx::query(&push(None, &OrderStatus::Draft, "创建草稿", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push(Some(&OrderStatus::Draft), &OrderStatus::PendingAudit, "提交审核", &reg_id, &reg_name, &reg_role)).execute(pool).await?;
            sqlx::query(&push_with_meta(
                Some(&OrderStatus::PendingAudit),
                &OrderStatus::PendingReview,
                "审核通过，待复核",
                &aud_id, &aud_name, &aud_role,
                Some("线路报价+报名确认+出团审核三类证据齐全，可归档"),
                None,
            )).execute(pool).await?;
            sqlx::query(&push_with_meta(
                Some(&OrderStatus::PendingReview),
                &OrderStatus::Archived,
                "复核通过，订单归档",
                &rev_id, &rev_name, &rev_role,
                Some("三类证据终校通过；签证机票酒店均已落实，正式归档"),
                None,
            )).execute(pool).await?;
        }
        _ => {}
    }

    Ok(())
}

async fn add_seed_audit_notes(
    pool: &SqlitePool,
    order_id: &Uuid,
    _status: &OrderStatus,
    version: &i32,
    auditor_id: &Uuid,
    reviewer_id: &Uuid,
    users: &[(Uuid, &'static str, &'static str, UserRole)],
) -> Result<()> {
    let find_user = |uid: &Uuid| -> (String, String, String) {
        users.iter()
            .find(|(id, _, _, _)| id == uid)
            .map(|(_, _, name, role)| (uid.to_string(), name.to_string(), role.as_str().to_string()))
            .unwrap_or_else(|| (uid.to_string(), "系统".to_string(), "registrar".to_string()))
    };
    let now = Utc::now().to_rfc3339();

    match version {
        3 => {
            // 003 逾期样例：审核主管备注
            let (uid, name, _) = find_user(auditor_id);
            let aid1 = Uuid::new_v4().to_string();
            sqlx::query(&format!(
                "INSERT INTO audit_notes (id, order_id, content, created_by, created_by_name, created_at) VALUES \
                 ('{}', '{}', '{}', '{}', '{}', '{}')",
                aid1, order_id.to_string(),
                "该订单已逾期1天，请登记员优先处理补正，否则将影响出团排期。".replace('\'', "''"),
                uid, name.replace('\'', "''"),
                &now,
            )).execute(pool).await?;
        }
        4 => {
            let (uid, name, _) = find_user(reviewer_id);
            let aid1 = Uuid::new_v4().to_string();
            sqlx::query(&format!(
                "INSERT INTO audit_notes (id, order_id, content, created_by, created_by_name, created_at) VALUES \
                 ('{}', '{}', '{}', '{}', '{}', '{}')",
                aid1, order_id.to_string(),
                "三类证据齐全，预计 24 小时内完成归档复核。".replace('\'', "''"),
                uid, name.replace('\'', "''"),
                &now,
            )).execute(pool).await?;
        }
        5 => {
            // 005 复核退回：审核主管 + 复核负责人双备注
            let (aid_uid, aid_name, _) = find_user(auditor_id);
            let (rev_uid, rev_name, _) = find_user(reviewer_id);
            let aid1 = Uuid::new_v4().to_string();
            let aid2 = Uuid::new_v4().to_string();
            sqlx::query(&format!(
                "INSERT INTO audit_notes (id, order_id, content, created_by, created_by_name, created_at) VALUES \
                 ('{}', '{}', '{}', '{}', '{}', '{}')",
                aid1, order_id.to_string(),
                "审核通过时已提醒高反和高原保险注意事项，请复核时重点检查。".replace('\'', "''"),
                aid_uid, aid_name.replace('\'', "''"),
                &now,
            )).execute(pool).await?;
            sqlx::query(&format!(
                "INSERT INTO audit_notes (id, order_id, content, created_by, created_by_name, created_at) VALUES \
                 ('{}', '{}', '{}', '{}', '{}', '{}')",
                aid2, order_id.to_string(),
                "复核时发现缺少高反健康告知书+旅游意外险+拉萨酒店确认函，已退回补正。".replace('\'', "''"),
                rev_uid, rev_name.replace('\'', "''"),
                &now,
            )).execute(pool).await?;
        }
        6 => {
            // 006 已归档：审核主管 + 复核负责人双备注
            let (aid_uid, aid_name, _) = find_user(auditor_id);
            let (rev_uid, rev_name, _) = find_user(reviewer_id);
            let aid1 = Uuid::new_v4().to_string();
            let aid2 = Uuid::new_v4().to_string();
            sqlx::query(&format!(
                "INSERT INTO audit_notes (id, order_id, content, created_by, created_by_name, created_at) VALUES \
                 ('{}', '{}', '{}', '{}', '{}', '{}')",
                aid1, order_id.to_string(),
                "签证、机票、酒店、出团通知、三类证据全部齐全，出境团标准件。".replace('\'', "''"),
                aid_uid, aid_name.replace('\'', "''"),
                &now,
            )).execute(pool).await?;
            sqlx::query(&format!(
                "INSERT INTO audit_notes (id, order_id, content, created_by, created_by_name, created_at) VALUES \
                 ('{}', '{}', '{}', '{}', '{}', '{}')",
                aid2, order_id.to_string(),
                "归档复核通过：线路报价单/报名确认单/出团审核单三单齐全，客户签字回传完整。".replace('\'', "''"),
                rev_uid, rev_name.replace('\'', "''"),
                &now,
            )).execute(pool).await?;
        }
        _ => {}
    }
    Ok(())
}

pub async fn get_user_name(pool: &SqlitePool, user_id: &Uuid) -> Option<String> {
    sqlx::query_scalar::<_, String>("SELECT display_name FROM users WHERE id = ?")
        .bind(user_id.to_string())
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}
