use axum::{extract::State, Json};
use crate::db::DbPool;
use crate::error::AppError;
use crate::models::{compute_deadline_warning, DashboardStats};

pub async fn get_statistics(
    State(pool): State<DbPool>,
) -> Result<Json<DashboardStats>, AppError> {
    let conn = pool.lock().await;

    let count_by_status = |status: &str| -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM creative_requests WHERE status = ?1",
            rusqlite::params![status],
            |row| row.get(0),
        )
        .unwrap_or(0)
    };

    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM creative_requests", [], |row| row.get(0))
        .unwrap_or(0);

    let mut overdue: i64 = 0;
    let mut approaching: i64 = 0;

    {
        let mut stmt = conn.prepare(
            "SELECT deadline FROM creative_requests WHERE status NOT IN ('archived', 'draft')"
        ).map_err(|e| AppError::Internal(e.to_string()))?;
        let iter = stmt.query_map([], |row| {
            let deadline: String = row.get(0)?;
            Ok(deadline)
        }).map_err(|e| AppError::Internal(e.to_string()))?;

        for deadline_result in iter {
            if let Ok(deadline) = deadline_result {
                match compute_deadline_warning(&deadline) {
                    crate::models::DeadlineWarning::Overdue => overdue += 1,
                    crate::models::DeadlineWarning::Approaching => approaching += 1,
                    _ => {}
                }
            }
        }
    }

    Ok(Json(DashboardStats {
        total,
        draft: count_by_status("draft"),
        pending_submit: count_by_status("pending_submit"),
        submitted: count_by_status("submitted"),
        under_review: count_by_status("under_review"),
        returned: count_by_status("returned"),
        resubmitted: count_by_status("resubmitted"),
        reviewed: count_by_status("reviewed"),
        archived: count_by_status("archived"),
        overdue,
        approaching,
    }))
}
