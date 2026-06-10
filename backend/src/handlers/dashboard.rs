use axum::{
    extract::Extension,
    Json,
};
use sqlx::{SqlitePool, Row, sqlite::SqliteRow};
use crate::auth::AuthUser;
use crate::error::AppError;
use crate::models::{DashboardStats, OrderStatus, TourOrder, UserRole};
use crate::services::allowed_visible_statuses;
use crate::db::refresh_overdue_flags;

fn parse_dt(s: &str) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::parse_from_rfc3339(s)
        .unwrap_or_else(|_| chrono::Utc::now())
        .with_timezone(&chrono::Utc)
}

fn get_order(row: &SqliteRow) -> TourOrder {
    TourOrder {
        id: uuid::Uuid::parse_str(&row.get::<String, _>("id")).unwrap(),
        order_no: row.get("order_no"),
        route_name: row.get("route_name"),
        customer_name: row.get("customer_name"),
        customer_phone: row.get("customer_phone"),
        traveler_count: row.get("traveler_count"),
        departure_date: parse_dt(&row.get::<String, _>("departure_date")),
        return_date: parse_dt(&row.get::<String, _>("return_date")),
        quoted_price: row.get("quoted_price"),
        status: OrderStatus::from_str(&row.get::<String, _>("status")).unwrap_or(OrderStatus::Draft),
        current_handler_id: row.get::<Option<String>, _>("current_handler_id")
            .and_then(|s| uuid::Uuid::parse_str(&s).ok()),
        current_handler_name: row.get("current_handler_name"),
        version: row.get("version"),
        is_overdue: row.get::<i32, _>("is_overdue") != 0,
        deadline: row.get::<Option<String>, _>("deadline").as_deref().map(parse_dt),
        exception_reason: row.get("exception_reason"),
        correction_note: row.get("correction_note"),
        route_quote_evidence: row.get::<i32, _>("route_quote_evidence") != 0,
        registration_confirm_evidence: row.get::<i32, _>("registration_confirm_evidence") != 0,
        tour_audit_evidence: row.get::<i32, _>("tour_audit_evidence") != 0,
        created_by: uuid::Uuid::parse_str(&row.get::<String, _>("created_by")).unwrap(),
        created_at: parse_dt(&row.get::<String, _>("created_at")),
        updated_at: parse_dt(&row.get::<String, _>("updated_at")),
    }
}

async fn fetch_count(
    pool: &SqlitePool,
    statuses: &[&str],
    is_registrar: bool,
    user_id: &str,
) -> Result<i64, AppError> {
    let placeholders: Vec<String> = statuses.iter().map(|_| "?".to_string()).collect();
    let mut sql = format!(
        "SELECT COUNT(*) FROM tour_orders WHERE status IN ({})",
        placeholders.join(", ")
    );
    if is_registrar {
        sql.push_str(" AND created_by = ?");
    }

    let mut q = sqlx::query_scalar::<_, i64>(&sql);
    for s in statuses {
        q = q.bind(*s);
    }
    if is_registrar {
        q = q.bind(user_id.to_string());
    }

    q.fetch_one(pool).await.map_err(AppError::DatabaseError)
}

async fn fetch_queue(
    pool: &SqlitePool,
    auth: &AuthUser,
    is_overdue: i32,
    limit: i64,
) -> Result<Vec<TourOrder>, AppError> {
    let visible = allowed_visible_statuses(&auth.role);
    let statuses: Vec<&str> = visible.iter().map(|s| s.as_str()).collect();
    let placeholders: Vec<String> = statuses.iter().map(|_| "?".to_string()).collect();

    let mut sql = format!(
        r#"SELECT * FROM tour_orders
           WHERE is_overdue = ?
             AND status IN ({})"#,
        placeholders.join(", ")
    );
    if matches!(auth.role, UserRole::Registrar) {
        sql.push_str(" AND created_by = ?");
    }
    sql.push_str(" ORDER BY deadline ASC NULLS LAST LIMIT ?");

    let mut q = sqlx::query(&sql).bind(is_overdue);
    for s in statuses {
        q = q.bind(s);
    }
    if matches!(auth.role, UserRole::Registrar) {
        q = q.bind(auth.id.to_string());
    }
    q = q.bind(limit);

    let rows = q.fetch_all(pool).await.map_err(AppError::DatabaseError)?;
    Ok(rows.iter().map(get_order).collect())
}

pub async fn get_stats(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
) -> Result<Json<DashboardStats>, AppError> {
    let _ = refresh_overdue_flags(&pool).await;

    let is_registrar = matches!(auth.role, UserRole::Registrar);
    let user_id = auth.id.to_string();

    let visible = allowed_visible_statuses(&auth.role);

    let my_pending_statuses: Vec<&str> = visible
        .iter()
        .filter(|s| **s != OrderStatus::Archived && **s != OrderStatus::Rejected)
        .map(|s| s.as_str())
        .collect();

    let mine = fetch_count(&pool, &my_pending_statuses, is_registrar, &user_id).await?;

    let (to_audit, to_review, correction, archived): (i64, i64, i64, i64);

    match auth.role {
        UserRole::Registrar => {
            to_audit = fetch_count(&pool, &["pending_audit"], true, &user_id).await?;
            to_review = 0;
            correction = fetch_count(&pool, &["pending_correction"], true, &user_id).await?;
            archived = 0;
        }
        UserRole::Auditor => {
            to_audit = fetch_count(&pool, &["pending_audit"], false, &user_id).await?;
            to_review = 0;
            correction = fetch_count(&pool, &["pending_correction"], false, &user_id).await?;
            archived = 0;
        }
        UserRole::Reviewer => {
            to_audit = 0;
            to_review = fetch_count(&pool, &["pending_review"], false, &user_id).await?;
            correction = 0;
            archived = fetch_count(&pool, &["archived"], false, &user_id).await?;
        }
    }

    let overdue = {
        let statuses_str: Vec<&str> = visible.iter().map(|s| s.as_str()).collect();
        let mut sql = format!(
            "SELECT COUNT(*) FROM tour_orders WHERE is_overdue = 1 AND status IN ({})",
            statuses_str.iter().map(|_| "?").collect::<Vec<_>>().join(", ")
        );
        if is_registrar {
            sql.push_str(" AND created_by = ?");
        }
        let mut q = sqlx::query_scalar::<_, i64>(&sql);
        for s in statuses_str { q = q.bind(s); }
        if is_registrar { q = q.bind(user_id.clone()); }
        q.fetch_one(&pool).await.map_err(AppError::DatabaseError)?
    };

    let normal_queue = fetch_queue(&pool, &auth, 0, 5).await?;
    let overdue_queue = fetch_queue(&pool, &auth, 1, 5).await?;

    Ok(Json(DashboardStats {
        total_mine: mine,
        to_audit,
        to_review,
        correction,
        archived,
        overdue,
        normal_queue,
        overdue_queue,
    }))
}
