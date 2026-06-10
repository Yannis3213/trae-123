use axum::{
    extract::Extension,
    Json,
};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::models::{DashboardStats, OrderStatus};
use crate::auth::AuthUser;
use crate::services::get_visible_statuses;

pub async fn get_stats(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
) -> Result<Json<DashboardStats>, AppError> {
    let visible_statuses = get_visible_statuses(&auth_user);
    let status_strs: Vec<String> = visible_statuses.iter().map(|s| s.as_str().to_string()).collect();
    let placeholders: Vec<String> = (0..status_strs.len()).map(|_| "?".to_string()).collect();
    let in_clause = placeholders.join(", ");

    let mut sql = format!(
        "SELECT status, COUNT(*) as cnt FROM tour_orders WHERE status IN ({})",
        in_clause
    );

    if auth_user.is_registrar() {
        sql.push_str(" AND created_by = ?");
    }
    sql.push_str(" GROUP BY status");

    let mut query_builder = sqlx::query_as::<_, StatusCount>(&sql);
    for s in &status_strs {
        query_builder = query_builder.bind(s);
    }
    if auth_user.is_registrar() {
        query_builder = query_builder.bind(auth_user.id.to_string());
    }

    let rows: Vec<StatusCount> = query_builder.fetch_all(&pool).await.map_err(AppError::DatabaseError)?;

    let get_count = |target: &OrderStatus| -> i64 {
        rows.iter()
            .find(|r| OrderStatus::from_str(&r.status).as_ref() == Some(target))
            .map(|r| r.cnt)
            .unwrap_or(0)
    };

    let mut overdue_sql = format!(
        "SELECT COUNT(*) FROM tour_orders WHERE is_overdue = 1 AND status IN ({})",
        in_clause
    );
    let mut warning_sql = format!(
        "SELECT COUNT(*) FROM tour_orders WHERE is_overdue = 0 AND deadline IS NOT NULL AND datetime(deadline) <= datetime('now', '+1 day') AND status IN ({})",
        in_clause
    );
    let mut normal_sql = format!(
        "SELECT COUNT(*) FROM tour_orders WHERE (is_overdue = 0 OR is_overdue IS NULL) AND (deadline IS NULL OR datetime(deadline) > datetime('now', '+1 day')) AND status IN ({})",
        in_clause
    );

    if auth_user.is_registrar() {
        overdue_sql.push_str(" AND created_by = ?");
        warning_sql.push_str(" AND created_by = ?");
        normal_sql.push_str(" AND created_by = ?");
    }

    async fn fetch_count(
        pool: &SqlitePool,
        sql_str: &str,
        status_strs: &[String],
        user_id: &Option<String>,
    ) -> i64 {
        let mut q = sqlx::query_scalar::<_, i64>(sql_str);
        for s in status_strs {
            q = q.bind(s);
        }
        if let Some(uid) = user_id {
            q = q.bind(uid);
        }
        q.fetch_one(pool).await.unwrap_or(0)
    }

    let user_id_for_query = if auth_user.is_registrar() {
        Some(auth_user.id.to_string())
    } else {
        None
    };

    let overdue = fetch_count(&pool, &overdue_sql, &status_strs, &user_id_for_query).await;
    let warning = fetch_count(&pool, &warning_sql, &status_strs, &user_id_for_query).await;
    let normal = fetch_count(&pool, &normal_sql, &status_strs, &user_id_for_query).await;

    Ok(Json(DashboardStats {
        draft_count: get_count(&OrderStatus::Draft),
        pending_audit_count: get_count(&OrderStatus::PendingAudit),
        pending_correction_count: get_count(&OrderStatus::PendingCorrection),
        pending_review_count: get_count(&OrderStatus::PendingReview),
        archived_count: get_count(&OrderStatus::Archived),
        overdue_count: overdue,
        warning_count: warning,
        normal_count: normal,
    }))
}

#[derive(sqlx::FromRow)]
struct StatusCount {
    status: String,
    cnt: i64,
}
