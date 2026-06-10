use sqlx::{SqlitePool, sqlite::SqlitePoolOptions, migrate::MigrateDatabase, Sqlite};
use std::env;
use anyhow::Result;
use crate::models::{UserRole, OrderStatus};
use uuid::Uuid;
use bcrypt::{hash, DEFAULT_COST};

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
            current_handler TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            is_overdue INTEGER NOT NULL DEFAULT 0,
            deadline TEXT,
            exception_reason TEXT,
            correction_note TEXT,
            route_quote_evidence INTEGER DEFAULT 0,
            registration_confirm_evidence INTEGER DEFAULT 0,
            tour_audit_evidence INTEGER DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES tour_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
        "#
    ).execute(pool).await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_orders_status ON tour_orders(status)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_orders_handler ON tour_orders(current_handler)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_orders_overdue ON tour_orders(is_overdue)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_records_order ON processing_records(order_id)").execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id)").execute(pool).await?;

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

    let users = vec![
        (Uuid::new_v4(), "registrar", "旅游登记员", UserRole::Registrar),
        (Uuid::new_v4(), "auditor", "旅游审核主管", UserRole::Auditor),
        (Uuid::new_v4(), "reviewer", "旅行社复核负责人", UserRole::Reviewer),
    ];

    let registrar_id = users[0].0;
    let auditor_id = users[1].0;

    for (id, username, display_name, role) in &users {
        sqlx::query(
            "INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(id.to_string())
        .bind(username)
        .bind(&password_hash)
        .bind(role.as_str())
        .bind(display_name)
        .execute(pool)
        .await?;
    }

    let sample_orders = vec![
        (
            Uuid::new_v4(),
            "TO-20260610-001",
            "北京五日游",
            "张三",
            "13800138001",
            4,
            chrono::Utc::now() + chrono::Duration::days(10),
            chrono::Utc::now() + chrono::Duration::days(15),
            12800.0,
            OrderStatus::Draft,
            None,
            1,
            false,
            Some(chrono::Utc::now() + chrono::Duration::days(3)),
            Some(true),
            Some(false),
            Some(false),
        ),
        (
            Uuid::new_v4(),
            "TO-20260610-002",
            "上海-苏州-杭州七日游",
            "李四",
            "13800138002",
            2,
            chrono::Utc::now() + chrono::Duration::days(20),
            chrono::Utc::now() + chrono::Duration::days(27),
            9600.0,
            OrderStatus::PendingAudit,
            Some(auditor_id),
            2,
            false,
            Some(chrono::Utc::now() + chrono::Duration::days(1)),
            Some(true),
            Some(true),
            Some(false),
        ),
        (
            Uuid::new_v4(),
            "TO-20260610-003",
            "云南昆明-大理-丽江六日游",
            "王五",
            "13800138003",
            6,
            chrono::Utc::now() + chrono::Duration::days(5),
            chrono::Utc::now() + chrono::Duration::days(11),
            18600.0,
            OrderStatus::PendingCorrection,
            Some(registrar_id),
            3,
            true,
            Some(chrono::Utc::now() - chrono::Duration::days(1)),
            Some(true),
            Some(false),
            Some(false),
        ),
        (
            Uuid::new_v4(),
            "TO-20260610-004",
            "海南三亚五日游",
            "赵六",
            "13800138004",
            3,
            chrono::Utc::now() + chrono::Duration::days(30),
            chrono::Utc::now() + chrono::Duration::days(35),
            15600.0,
            OrderStatus::PendingReview,
            Some(Uuid::new_v4()),
            4,
            false,
            Some(chrono::Utc::now() + chrono::Duration::days(2)),
            Some(true),
            Some(true),
            Some(true),
        ),
    ];

    for (
        id, order_no, route_name, customer_name, customer_phone,
        traveler_count, departure_date, return_date, quoted_price,
        status, current_handler, version, is_overdue, deadline,
        route_quote, registration, tour_audit
    ) in &sample_orders
    {
        sqlx::query(
            r#"
            INSERT INTO tour_orders (
                id, order_no, route_name, customer_name, customer_phone,
                traveler_count, departure_date, return_date, quoted_price,
                status, current_handler, version, is_overdue, deadline,
                route_quote_evidence, registration_confirm_evidence, tour_audit_evidence,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(id.to_string())
        .bind(order_no)
        .bind(route_name)
        .bind(customer_name)
        .bind(customer_phone)
        .bind(*traveler_count)
        .bind(departure_date.to_rfc3339())
        .bind(return_date.to_rfc3339())
        .bind(*quoted_price)
        .bind(status.as_str())
        .bind(current_handler.map(|u| u.to_string()))
        .bind(*version)
        .bind(if *is_overdue { 1 } else { 0 })
        .bind(deadline.map(|d| d.to_rfc3339()))
        .bind(route_quote.map(|v| if v { 1 } else { 0 }))
        .bind(registration.map(|v| if v { 1 } else { 0 }))
        .bind(tour_audit.map(|v| if v { 1 } else { 0 }))
        .bind(registrar_id.to_string())
        .execute(pool)
        .await?;
    }

    Ok(())
}
