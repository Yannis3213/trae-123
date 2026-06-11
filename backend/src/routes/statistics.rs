use crate::auth::{check_permission, AuthGuard};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{ApiResponse, StatisticsData, UserRole};
use chrono::{Duration, Utc};
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    rocket::routes![get_statistics]
}

#[get("/statistics")]
fn get_statistics(
    db: &Database,
    auth: AuthGuard,
) -> Result<(Status, Json<ApiResponse<StatisticsData>>)> {
    check_permission(
        &auth.user,
        &[
            UserRole::Registrar,
            UserRole::Supervisor,
            UserRole::Reviewer,
            UserRole::Director,
            UserRole::Assistant,
            UserRole::Lawyer,
        ],
        "查看统计数据",
    )?;

    let conn = db.conn.lock();

    let mut where_clause = String::new();
    let mut params: Vec<String> = Vec::new();

    match auth.user.role {
        UserRole::Registrar => {
            where_clause = "WHERE created_by = ?".to_string();
            params.push(auth.user.id.to_string());
        }
        UserRole::Assistant | UserRole::Lawyer => {
            where_clause = "WHERE current_handler_id = ?".to_string();
            params.push(auth.user.id.to_string());
        }
        _ => {}
    }

    let total: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM legal_cases {}", where_clause),
        rusqlite::params_from_iter(&params),
        |row| row.get(0),
    )?;

    let count_by_status = |status: &str| -> Result<i64> {
        let sql = if where_clause.is_empty() {
            "SELECT COUNT(*) FROM legal_cases WHERE status = ?".to_string()
        } else {
            format!(
                "SELECT COUNT(*) FROM legal_cases {} AND status = ?",
                where_clause
            )
        };
        let mut params_with_status = params.clone();
        params_with_status.push(status.to_string());
        let count: i64 = conn.query_row(&sql, rusqlite::params_from_iter(&params_with_status), |row| row.get(0))?;
        Ok(count)
    };

    let draft = count_by_status("draft")?;
    let pending_submit = count_by_status("pending_submit")?;
    let submitted = count_by_status("submitted")? + count_by_status("resubmitted")?;
    let returned = count_by_status("returned")?;
    let reviewing = count_by_status("reviewing")?;
    let completed = count_by_status("completed")? + count_by_status("archived")?;

    let now = Utc::now();
    let one_day_later = now + Duration::days(1);

    let (normal, approaching, overdue) = count_by_warning(&conn, &where_clause, &params, now, one_day_later)?;

    let stats = StatisticsData {
        total,
        draft,
        pending_submit,
        submitted,
        returned,
        reviewing,
        completed,
        normal,
        approaching,
        overdue,
    };

    Ok((
        Status::Ok,
        Json(ApiResponse::success(stats, "查询成功")),
    ))
}

fn count_by_warning(
    conn: &rusqlite::Connection,
    where_clause: &str,
    params: &[String],
    now: chrono::DateTime<Utc>,
    one_day_later: chrono::DateTime<Utc>,
) -> Result<(i64, i64, i64)> {
    let deadline_condition = |op: &str, include_null: bool| -> String {
        let base = if include_null {
            format!("(deadline IS NULL OR deadline {} ?)", op)
        } else {
            format!("deadline {} ?", op)
        };
        if where_clause.is_empty() {
            format!("SELECT COUNT(*) FROM legal_cases WHERE {}", base)
        } else {
            format!(
                "SELECT COUNT(*) FROM legal_cases {} AND {}",
                where_clause, base
            )
        }
    };

    let mut params_overdue = params.to_vec();
    params_overdue.push(now.to_rfc3339());
    let overdue: i64 = conn.query_row(
        &deadline_condition("<", false),
        rusqlite::params_from_iter(&params_overdue),
        |row| row.get(0),
    )?;

    let mut params_approaching = params.to_vec();
    params_approaching.push(now.to_rfc3339());
    params_approaching.push(one_day_later.to_rfc3339());
    let approaching_sql = if where_clause.is_empty() {
        "SELECT COUNT(*) FROM legal_cases WHERE deadline >= ? AND deadline < ?".to_string()
    } else {
        format!(
            "SELECT COUNT(*) FROM legal_cases {} AND deadline >= ? AND deadline < ?",
            where_clause
        )
    };
    let approaching: i64 = conn.query_row(
        &approaching_sql,
        rusqlite::params_from_iter(&params_approaching),
        |row| row.get(0),
    )?;

    let mut params_normal = params.to_vec();
    params_normal.push(one_day_later.to_rfc3339());
    let normal: i64 = conn.query_row(
        &deadline_condition(">=", true),
        rusqlite::params_from_iter(&params_normal),
        |row| row.get(0),
    )?;

    Ok((normal, approaching, overdue))
}
