use actix_web::{web, HttpResponse};
use crate::AppState;
use crate::models::*;
use crate::auth::can_access_record;
use crate::error::AppError;
use uuid::Uuid;

pub async fn list_roles() -> HttpResponse {
    let roles: Vec<RoleInfo> = Role::all().into_iter().map(|r| {
        let desc = match r {
            Role::RegistrationClerk => "负责借阅记录的发起与补正",
            Role::CirculationLibrarian => "负责初始队列，待分派状态处理",
            Role::CatalogingLibrarian => "负责中段处理，已转办状态推进",
            Role::AuditSupervisor => "负责办理，已回访状态审核",
            Role::LibraryDirector => "负责最终意见，复核归档",
        };
        RoleInfo { role: r, name: r.as_str().to_string(), description: desc.to_string() }
    }).collect();
    HttpResponse::Ok().json(ApiResponse::ok(roles))
}

pub async fn list_borrow_records(
    data: web::Data<AppState>,
    qs: web::Query<std::collections::HashMap<String, String>>,
) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();

    let parse_role = |s: Option<&String>| s.and_then(|v| Role::from_str(v));
    let parse_status = |s: Option<&String>| s.and_then(|v| BorrowStatus::from_str(v));
    let parse_overdue = |s: Option<&String>| -> Option<OverdueLevel> {
        s.and_then(|v| match v.as_str() {
            "normal" => Some(OverdueLevel::Normal),
            "approaching" => Some(OverdueLevel::Approaching),
            "overdue" => Some(OverdueLevel::Overdue),
            _ => None,
        })
    };
    let parse_usize = |s: Option<&String>| s.and_then(|v| v.parse::<usize>().ok());

    let params = ListQueryParams {
        role: parse_role(qs.get("role")),
        handler: qs.get("handler").cloned(),
        status: parse_status(qs.get("status")),
        overdue_level: parse_overdue(qs.get("overdue_level")),
        reader_keyword: qs.get("reader_keyword").cloned(),
        page: parse_usize(qs.get("page")),
        page_size: parse_usize(qs.get("page_size")),
    };

    let records = crate::db::list_borrow_records(&db, &params)?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(records)))
}

pub async fn get_borrow_record(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();
    let id = Uuid::parse_str(&path.into_inner())
        .map_err(|_| AppError::Validation("无效的记录ID".to_string()))?;

    let record = crate::db::get_borrow_record(&db, &id)?
        .ok_or_else(|| AppError::NotFound("借阅记录不存在".to_string()))?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok(record)))
}

pub async fn create_borrow_record(
    data: web::Data<AppState>,
    body: web::Json<CreateBorrowRecordRequest>,
) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();

    if body.operator_role != Role::RegistrationClerk {
        return Err(AppError::Permission("仅借阅登记员可创建借阅记录".to_string()));
    }

    if body.borrow_date > body.due_date {
        return Err(AppError::Validation("借阅日期不能晚于到期日期".to_string()));
    }

    if body.book_title.trim().is_empty() {
        return Err(AppError::Validation("图书名称不能为空".to_string()));
    }

    let record = crate::db::create_borrow_record(&db, &body)?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(record)))
}

pub async fn process_borrow_record(
    data: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<ProcessBorrowRecordRequest>,
) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();
    let id = Uuid::parse_str(&path.into_inner())
        .map_err(|_| AppError::Validation("无效的记录ID".to_string()))?;

    let record = crate::db::get_borrow_record(&db, &id)?
        .ok_or_else(|| AppError::NotFound("借阅记录不存在".to_string()))?;

    if !can_access_record(&record, body.operator_role) {
        return Err(AppError::Permission(format!(
            "角色 {} 无权操作此记录（当前状态：{}）",
            body.operator_role.as_str(),
            record.status.as_str()
        )));
    }

    let result = crate::db::validate_and_process(&db, &id, &body)
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("版本冲突") { AppError::VersionConflict(msg) }
            else if msg.contains("缺少必要证据") { AppError::MissingMaterial(msg) }
            else if msg.contains("借阅登记员") || msg.contains("流通馆员") ||
                    msg.contains("采编馆员") || msg.contains("审核主管") || msg.contains("馆长") {
                AppError::Permission(msg)
            }
            else { AppError::Validation(msg) }
        })?;

    Ok(HttpResponse::Ok().json(ApiResponse::ok(result)))
}

pub async fn batch_process_records(
    data: web::Data<AppState>,
    body: web::Json<BatchProcessRequest>,
) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();
    let mut results: Vec<BatchProcessResultItem> = Vec::new();
    let mut success_count = 0usize;
    let mut failure_count = 0usize;

    for record_id in &body.record_ids {
        let version = body.versions.get(record_id).copied().unwrap_or(0);
        let mut fail = |msg: &str| {
            failure_count += 1;
            results.push(BatchProcessResultItem {
                record_id: *record_id,
                success: false,
                message: msg.to_string(),
                from_status: None,
                to_status: None,
            });
        };

        let record = match crate::db::get_borrow_record(&db, record_id) {
            Ok(Some(r)) => r,
            Ok(None) => { fail("记录不存在"); continue; }
            Err(e) => { fail(&format!("数据库错误: {}", e)); continue; }
        };

        let from_status = record.status;

        if !can_access_record(&record, body.operator_role) {
            fail(&format!("越权: 角色{}无权处理状态{}的记录",
                body.operator_role.as_str(), record.status.as_str()));
            let _ = crate::db::add_audit_note(
                &db, record_id, record.status,
                &format!("批量处理被拦截: 越权操作，目标状态 {}", body.target_status.as_str()),
                &body.operator, body.operator_role,
                Some("越权推进"),
                Some(&format!("role={}, status={}", body.operator_role.as_str(), record.status.as_str())),
            );
            continue;
        }

        if record.version != version {
            fail(&format!("版本冲突: 期望版本{}，提交版本{}", record.version, version));
            let _ = crate::db::add_audit_note(
                &db, record_id, record.status,
                &format!("批量处理被拦截: 版本冲突，期望{}实际{}", record.version, version),
                &body.operator, body.operator_role,
                Some("版本冲突"),
                Some(&format!("expected={}, actual={}", record.version, version)),
            );
            continue;
        }

        let required = crate::db::required_evidence_for(&record.status, &body.target_status);
        let missing: Vec<String> = required.iter()
            .filter(|e| !body.evidence.contains(e))
            .cloned()
            .collect();
        if !missing.is_empty() && body.target_status != BorrowStatus::ReturnedForCorrection {
            fail(&format!("资料缺失: {}", missing.join(", ")));
            let _ = crate::db::add_audit_note(
                &db, record_id, record.status,
                &format!("批量处理被拦截: 缺少必要证据 {:?}", missing),
                &body.operator, body.operator_role,
                Some("资料缺失"),
                Some(&missing.join(", ")),
            );
            continue;
        }

        if record.node_timeout && body.operator_role != Role::LibraryDirector {
            fail("节点超时: 仅馆长可处理超时记录");
            let _ = crate::db::add_audit_note(
                &db, record_id, record.status,
                "批量处理被拦截: 节点超时，非馆长角色推进",
                &body.operator, body.operator_role,
                Some("超期未处理"),
                Some(&format!("timeout_responsible={:?}", record.timeout_responsible)),
            );
            continue;
        }

        let proc_req = ProcessBorrowRecordRequest {
            action: body.action.clone(),
            target_status: body.target_status,
            operator: body.operator.clone(),
            operator_role: body.operator_role,
            remark: body.remark.clone(),
            evidence: body.evidence.clone(),
            version,
            assign_to: None,
            assign_to_role: None,
            correction_items: None,
        };

        match crate::db::validate_and_process(&db, record_id, &proc_req) {
            Ok(r) => {
                success_count += 1;
                results.push(BatchProcessResultItem {
                    record_id: *record_id,
                    success: true,
                    message: format!("{}→{} 操作成功", from_status.as_str(), r.status.as_str()),
                    from_status: Some(from_status),
                    to_status: Some(r.status),
                });
            }
            Err(e) => {
                fail(&e.to_string());
            }
        }
    }

    let response = BatchProcessResponse {
        total: body.record_ids.len(),
        success_count,
        failure_count,
        results,
    };

    Ok(HttpResponse::Ok().json(ApiResponse::ok(response)))
}

pub async fn get_audit_notes(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();
    let id = Uuid::parse_str(&path.into_inner())
        .map_err(|_| AppError::Validation("无效的记录ID".to_string()))?;

    let notes = crate::db::get_audit_notes(&db, &id)?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(notes)))
}

pub async fn get_process_history(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();
    let id = Uuid::parse_str(&path.into_inner())
        .map_err(|_| AppError::Validation("无效的记录ID".to_string()))?;

    let history = crate::db::get_process_history(&db, &id)?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(history)))
}

pub async fn list_readers(data: web::Data<AppState>) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();
    let readers = crate::db::list_readers(&db)?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(readers)))
}

pub async fn get_reader(
    data: web::Data<AppState>,
    path: web::Path<String>,
) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();
    let id = Uuid::parse_str(&path.into_inner())
        .map_err(|_| AppError::Validation("无效的读者ID".to_string()))?;

    let reader = crate::db::get_reader(&db, &id)?
        .ok_or_else(|| AppError::NotFound("读者不存在".to_string()))?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(reader)))
}

pub async fn get_statistics(data: web::Data<AppState>) -> Result<HttpResponse, AppError> {
    let db = data.db.lock().unwrap();
    let stats = crate::db::get_statistics(&db)?;
    Ok(HttpResponse::Ok().json(ApiResponse::ok(stats)))
}
