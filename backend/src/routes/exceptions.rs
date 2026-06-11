use crate::auth::{can_access_case, AuthGuard};
use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{ApiResponse, ExceptionReason};
use crate::utils::get_case;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    rocket::routes![list_exceptions]
}

#[get("/cases/<case_id>/exceptions")]
fn list_exceptions(
    db: &Database,
    auth: AuthGuard,
    case_id: i64,
) -> Result<(Status, Json<ApiResponse<Vec<ExceptionReason>>>)> {
    let case = get_case(db, case_id)?;

    if !can_access_case(&auth.user, case.created_by, case.current_handler_id, &case.status) {
        return Err(AppError::PermissionError(
            "用户无权查看此案件的异常原因".to_string(),
        ));
    }

    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT er.id, er.case_id, er.exception_type, er.reason, er.module, 
                er.operator_id, er.created_at, u.real_name as operator_name
         FROM exception_reasons er
         LEFT JOIN users u ON er.operator_id = u.id
         WHERE er.case_id = ?1
         ORDER BY er.created_at DESC",
    )?;

    let exceptions = stmt.query_map([case_id], |row| {
        Ok(ExceptionReason {
            id: row.get(0)?,
            case_id: row.get(1)?,
            exception_type: row.get(2)?,
            reason: row.get(3)?,
            module: row.get(4)?,
            operator_id: row.get(5)?,
            operator_name: row.get(7)?,
            created_at: row.get(6)?,
        })
    })?;

    let mut list: Vec<ExceptionReason> = Vec::new();
    for exc in exceptions {
        list.push(exc?);
    }

    Ok((
        Status::Ok,
        Json(ApiResponse::success(list, "查询成功")),
    ))
}
