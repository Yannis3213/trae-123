use axum::{
    extract::{Extension, Path, Query},
    Json,
    http::StatusCode,
};
use sqlx::{SqlitePool, Row, sqlite::SqliteRow};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::*;
use crate::auth::AuthUser;
use crate::auth::parse_db_datetime;
use crate::services::{
    allowed_visible_statuses, available_actions,
    check_state_change, can_view_order, EvidenceState,
    find_transition, next_handler_for,
};
use crate::db::{refresh_overdue_flags, get_user_name};

fn parse_dt(s: &str) -> DateTime<Utc> {
    parse_db_datetime(s)
}

fn parse_dt_opt(s: &Option<String>) -> Option<DateTime<Utc>> {
    s.as_ref().map(|s| parse_dt(s))
}

fn get_order(row: &SqliteRow) -> TourOrder {
    TourOrder {
        id: Uuid::parse_str(&row.get::<String, _>("id")).unwrap(),
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
            .and_then(|s| Uuid::parse_str(&s).ok()),
        current_handler_name: row.get("current_handler_name"),
        version: row.get("version"),
        is_overdue: row.get::<i32, _>("is_overdue") != 0,
        deadline: row.get::<Option<String>, _>("deadline").as_deref().map(parse_dt),
        exception_reason: row.get("exception_reason"),
        correction_note: row.get("correction_note"),
        route_quote_evidence: row.get::<i32, _>("route_quote_evidence") != 0,
        registration_confirm_evidence: row.get::<i32, _>("registration_confirm_evidence") != 0,
        tour_audit_evidence: row.get::<i32, _>("tour_audit_evidence") != 0,
        created_by: Uuid::parse_str(&row.get::<String, _>("created_by")).unwrap(),
        created_at: parse_dt(&row.get::<String, _>("created_at")),
        updated_at: parse_dt(&row.get::<String, _>("updated_at")),
    }
}

fn get_record(row: &SqliteRow) -> ProcessingRecord {
    ProcessingRecord {
        id: Uuid::parse_str(&row.get::<String, _>("id")).unwrap(),
        order_id: Uuid::parse_str(&row.get::<String, _>("order_id")).unwrap(),
        from_status: row.get("from_status"),
        to_status: row.get("to_status"),
        action: row.get("action"),
        handler_id: Uuid::parse_str(&row.get::<String, _>("handler_id")).unwrap(),
        handler_name: row.get("handler_name"),
        handler_role: row.get("handler_role"),
        note: row.get("note"),
        exception_reason: row.get("exception_reason"),
        created_at: parse_dt(&row.get::<String, _>("created_at")),
    }
}

fn get_attachment(row: &SqliteRow) -> Attachment {
    Attachment {
        id: Uuid::parse_str(&row.get::<String, _>("id")).unwrap(),
        order_id: Uuid::parse_str(&row.get::<String, _>("order_id")).unwrap(),
        file_name: row.get("file_name"),
        file_type: row.get("file_type"),
        file_size: row.get("file_size"),
        evidence_type: row.get("evidence_type"),
        uploaded_by: Uuid::parse_str(&row.get::<String, _>("uploaded_by")).unwrap(),
        uploaded_by_name: row.get::<Option<String>, _>("uploaded_by_name").unwrap_or_else(|| "系统".to_string()),
        created_at: parse_dt(&row.get::<String, _>("created_at")),
    }
}

fn get_audit(row: &SqliteRow) -> AuditNote {
    AuditNote {
        id: Uuid::parse_str(&row.get::<String, _>("id")).unwrap(),
        order_id: Uuid::parse_str(&row.get::<String, _>("order_id")).unwrap(),
        content: row.get("content"),
        created_by: Uuid::parse_str(&row.get::<String, _>("created_by")).unwrap(),
        created_by_name: row.get::<Option<String>, _>("created_by_name").unwrap_or_else(|| "系统".to_string()),
        created_at: parse_dt(&row.get::<String, _>("created_at")),
    }
}

fn build_where_clause(
    auth: &AuthUser,
    query: &OrderListQuery,
    params: &mut Vec<String>,
) -> String {
    let mut clauses: Vec<String> = Vec::new();

    let visible = allowed_visible_statuses(&auth.role);
    let statuses: Vec<String> = visible.iter().map(|s| s.as_str().to_string()).collect();

    if let Some(filter_status) = &query.status {
        if let Some(s) = OrderStatus::from_str(filter_status) {
            if visible.contains(&s) {
                clauses.push("o.status = ?".to_string());
                params.push(s.as_str().to_string());
            }
        }
    } else {
        let placeholders: Vec<String> = (0..statuses.len()).map(|_| "?".to_string()).collect();
        clauses.push(format!("o.status IN ({})", placeholders.join(", ")));
        params.extend(statuses);
    }

    if matches!(auth.role, UserRole::Registrar) {
        clauses.push("o.created_by = ?".to_string());
        params.push(auth.id.to_string());
    }

    if let Some(overdue_str) = &query.overdue {
        if overdue_str == "1" {
            clauses.push("o.is_overdue = 1".to_string());
        } else if overdue_str == "0" {
            clauses.push("o.is_overdue = 0".to_string());
        }
    }

    if let Some(search) = &query.search {
        if !search.is_empty() {
            let like = format!("%{}%", search);
            clauses.push("(o.order_no LIKE ? OR o.route_name LIKE ? OR o.customer_name LIKE ?)".to_string());
            params.push(like.clone());
            params.push(like.clone());
            params.push(like);
        }
    }

    if clauses.is_empty() {
        "1=1".to_string()
    } else {
        clauses.join(" AND ")
    }
}

pub async fn list_orders(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Query(query): Query<OrderListQuery>,
) -> Result<Json<PaginatedResponse<TourOrder>>, AppError> {
    let _ = refresh_overdue_flags(&pool).await;

    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * page_size;

    let mut params: Vec<String> = Vec::new();
    let where_clause = build_where_clause(&auth, &query, &mut params);

    let sql = format!(
        "SELECT o.* FROM tour_orders o WHERE {} ORDER BY o.is_overdue DESC, o.updated_at DESC LIMIT ? OFFSET ?",
        where_clause
    );

    let mut qb = sqlx::query(&sql);
    for p in &params {
        qb = qb.bind(p);
    }
    qb = qb.bind(page_size).bind(offset);

    let rows = qb.fetch_all(&pool).await.map_err(AppError::DatabaseError)?;
    let items: Vec<TourOrder> = rows.iter().map(get_order).collect();

    let count_sql = format!(
        "SELECT COUNT(*) FROM tour_orders o WHERE {}",
        where_clause
    );

    let mut cq = sqlx::query_scalar::<_, i64>(&count_sql);
    for p in &params {
        cq = cq.bind(p);
    }
    let total = cq.fetch_one(&pool).await.map_err(AppError::DatabaseError)?;

    Ok(Json(PaginatedResponse {
        items,
        total,
        page,
        page_size,
    }))
}

pub async fn get_order(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<TourOrder>, AppError> {
    let _ = refresh_overdue_flags(&pool).await;

    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = get_order(&row);

    if !can_view_order(&auth.role, &order.status, &order.created_by, &order.current_handler_id, &auth.id) {
        return Err(AppError::AuthorizationError("无权查看此订单".to_string()));
    }

    Ok(Json(order))
}

pub async fn create_order(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Json(req): Json<CreateOrderRequest>,
) -> Result<(StatusCode, Json<TourOrder>), AppError> {
    if !matches!(auth.role, UserRole::Registrar) {
        return Err(AppError::AuthorizationError("只有旅游登记员可以创建订单".to_string()));
    }

    if req.traveler_count < 1 {
        return Err(AppError::ValidationError("出游人数必须大于0".to_string()));
    }

    let as_draft = req.as_draft.unwrap_or(true);
    let (status, route_q, reg_c, tour_a) = if as_draft {
        (
            OrderStatus::Draft,
            req.route_quote_evidence.unwrap_or(false),
            req.registration_confirm_evidence.unwrap_or(false),
            req.tour_audit_evidence.unwrap_or(false),
        )
    } else {
        let rq = req.route_quote_evidence.unwrap_or(false);
        if !rq {
            return Err(AppError::MissingEvidenceError("直接提交审核必须提供「线路报价证据」".to_string()));
        }
        (
            OrderStatus::PendingAudit,
            true,
            req.registration_confirm_evidence.unwrap_or(false),
            req.tour_audit_evidence.unwrap_or(false),
        )
    };

    let order_no = req.order_no.unwrap_or_else(|| {
        format!("TO-{}{:08}", Utc::now().format("%Y%m%d"), (chrono::Utc::now().timestamp_nanos() % 100000000) as u32)
    });

    let departure = parse_dt(&req.departure_date);
    let return_dt = parse_dt(&req.return_date);
    let deadline = parse_dt_opt(&req.deadline);

    let id = Uuid::new_v4();
    let now = Utc::now();
    let version = 1;

    let (handler_id, handler_name, _) = next_handler_for(&status, &auth.id);

    let mut tx = pool.begin().await.map_err(AppError::DatabaseError)?;

    sqlx::query(
        r#"
        INSERT INTO tour_orders (
            id, order_no, route_name, customer_name, customer_phone,
            traveler_count, departure_date, return_date, quoted_price,
            status, current_handler_id, current_handler_name, version,
            is_overdue, deadline,
            route_quote_evidence, registration_confirm_evidence, tour_audit_evidence,
            created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(id.to_string())
    .bind(&order_no)
    .bind(&req.route_name)
    .bind(&req.customer_name)
    .bind(&req.customer_phone)
    .bind(req.traveler_count)
    .bind(departure.to_rfc3339())
    .bind(return_dt.to_rfc3339())
    .bind(req.quoted_price)
    .bind(status.as_str())
    .bind(handler_id.map(|u| u.to_string()))
    .bind(handler_name.clone())
    .bind(version)
    .bind(0)
    .bind(deadline.map(|d| d.to_rfc3339()))
    .bind(if route_q { 1 } else { 0 })
    .bind(if reg_c { 1 } else { 0 })
    .bind(if tour_a { 1 } else { 0 })
    .bind(auth.id.to_string())
    .bind(now.to_rfc3339())
    .bind(now.to_rfc3339())
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    let action = if as_draft { "创建订单草稿" } else { "创建并提交审核" };
    insert_record(
        &mut tx,
        &id,
        None,
        &status,
        action,
        &auth,
        if as_draft { None } else { Some("已核验线路报价证据") },
        None,
    ).await?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(id.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(get_order(&row))))
}

pub async fn update_order(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<UpdateOrderRequest>,
) -> Result<Json<TourOrder>, AppError> {
    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;
    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = get_order(&row);

    if matches!(auth.role, UserRole::Registrar) && order.created_by != auth.id {
        return Err(AppError::AuthorizationError("无权修改此订单".to_string()));
    }

    if order.version != req.version {
        return Err(AppError::VersionConflictError(format!(
            "版本冲突：当前版本 v{}，您提交的是 v{}", order.version, req.version
        )));
    }

    let can_edit_full = matches!(order.status, OrderStatus::Draft | OrderStatus::PendingCorrection)
        && matches!(auth.role, UserRole::Registrar);
    let can_edit_evidence = matches!(order.status, OrderStatus::Draft | OrderStatus::PendingCorrection)
        || matches!(auth.role, UserRole::Auditor | UserRole::Reviewer);

    if !can_edit_full && !can_edit_evidence {
        return Err(AppError::StateConflictError(format!(
            "当前状态「{}」不允许修改", order.status.label()
        )));
    }

    let now = Utc::now();
    let new_version = order.version + 1;

    let departure = req.departure_date.as_deref().map(parse_dt);
    let return_dt = req.return_date.as_deref().map(parse_dt);
    let deadline = parse_dt_opt(&req.deadline);

    let mut fields_changed = Vec::new();

    let sql = r#"
        UPDATE tour_orders SET
            route_name = COALESCE(?, route_name),
            customer_name = COALESCE(?, customer_name),
            customer_phone = COALESCE(?, customer_phone),
            traveler_count = COALESCE(?, traveler_count),
            departure_date = COALESCE(?, departure_date),
            return_date = COALESCE(?, return_date),
            quoted_price = COALESCE(?, quoted_price),
            deadline = COALESCE(?, deadline),
            route_quote_evidence = COALESCE(?, route_quote_evidence),
            registration_confirm_evidence = COALESCE(?, registration_confirm_evidence),
            tour_audit_evidence = COALESCE(?, tour_audit_evidence),
            version = ?,
            updated_at = ?
        WHERE id = ?
    "#;

    let (rn, cn, cp) = if can_edit_full {
        (req.route_name.clone(), req.customer_name.clone(), req.customer_phone.clone())
    } else {
        (None, None, None)
    };
    let (tc, dep, ret, qp, dl) = if can_edit_full {
        (req.traveler_count, departure, return_dt, req.quoted_price, deadline)
    } else {
        (None, None, None, None, None)
    };

    if req.route_quote_evidence.is_some() && req.route_quote_evidence != Some(order.route_quote_evidence) {
        fields_changed.push(format!(
            "线路报价证据: {} → {}",
            if order.route_quote_evidence { "✓" } else { "✗" },
            if req.route_quote_evidence.unwrap() { "✓" } else { "✗" }
        ));
    }
    if req.registration_confirm_evidence.is_some() && req.registration_confirm_evidence != Some(order.registration_confirm_evidence) {
        fields_changed.push(format!(
            "报名确认证据: {} → {}",
            if order.registration_confirm_evidence { "✓" } else { "✗" },
            if req.registration_confirm_evidence.unwrap() { "✓" } else { "✗" }
        ));
    }
    if req.tour_audit_evidence.is_some() && req.tour_audit_evidence != Some(order.tour_audit_evidence) {
        fields_changed.push(format!(
            "出团审核证据: {} → {}",
            if order.tour_audit_evidence { "✓" } else { "✗" },
            if req.tour_audit_evidence.unwrap() { "✓" } else { "✗" }
        ));
    }
    if can_edit_full {
        if req.route_name.is_some() { fields_changed.push("线路名称".to_string()); }
        if req.quoted_price.is_some() { fields_changed.push("报价金额".to_string()); }
        if req.departure_date.is_some() { fields_changed.push("出发日期".to_string()); }
    }

    sqlx::query(sql)
        .bind(rn)
        .bind(cn)
        .bind(cp)
        .bind(tc)
        .bind(dep.map(|d| d.to_rfc3339()))
        .bind(ret.map(|d| d.to_rfc3339()))
        .bind(qp)
        .bind(dl.map(|d| d.to_rfc3339()))
        .bind(req.route_quote_evidence.map(|v| if v { 1 } else { 0 }))
        .bind(req.registration_confirm_evidence.map(|v| if v { 1 } else { 0 }))
        .bind(req.tour_audit_evidence.map(|v| if v { 1 } else { 0 }))
        .bind(new_version)
        .bind(now.to_rfc3339())
        .bind(oid.to_string())
        .execute(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let note = if fields_changed.is_empty() {
        None
    } else {
        Some(format!("修改内容: {}", fields_changed.join("；")))
    };

    insert_plain_record(
        &pool,
        &oid,
        &order.status,
        &order.status,
        "更新订单信息",
        &auth,
        note.as_deref(),
        None,
    ).await?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(Json(get_order(&row)))
}

pub async fn change_status(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<ChangeStatusRequest>,
) -> Result<Json<TourOrder>, AppError> {
    let _ = refresh_overdue_flags(&pool).await;

    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;
    let target = OrderStatus::from_str(&req.target_status)
        .ok_or_else(|| AppError::ValidationError(format!("无效的目标状态: {}", req.target_status)))?;

    let mut tx = pool.begin().await.map_err(AppError::DatabaseError)?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;
    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = get_order(&row);

    if matches!(auth.role, UserRole::Registrar) && order.created_by != auth.id {
        return Err(AppError::AuthorizationError("无权操作此订单".to_string()));
    }

    if order.version != req.version {
        return Err(AppError::VersionConflictError(format!(
            "版本冲突：当前 v{}，您提交的是 v{}。请刷新后重试。", order.version, req.version
        )));
    }

    if order.is_overdue && matches!(target, OrderStatus::PendingAudit | OrderStatus::PendingReview) {
        return Err(AppError::StateConflictError(
            "该订单已逾期，逾期订单禁止直接推进审核/复核流程。请先更新截止时间或处理逾期标记。".to_string()
        ));
    }

    let evidence = EvidenceState {
        route_quote: req.route_quote_evidence.unwrap_or(order.route_quote_evidence),
        registration: req.registration_confirm_evidence.unwrap_or(order.registration_confirm_evidence),
        tour_audit: req.tour_audit_evidence.unwrap_or(order.tour_audit_evidence),
    };

    let check = check_state_change(&order.status, &target, &auth.role, &evidence)?;
    if !check.missing_evidence.is_empty() {
        let names: Vec<String> = check.missing_evidence.iter().map(|e| e.label().to_string()).collect();
        return Err(AppError::MissingEvidenceError(format!(
            "缺少必要证据：{}", names.join("、")
        )));
    }

    let now = Utc::now();
    let new_version = order.version + 1;

    let (handler_id, handler_name, _) = next_handler_for(&target, &order.created_by);

    let (correction_note, exception_reason) = if matches!(target, OrderStatus::PendingCorrection) {
        (req.note.clone(), req.exception_reason.clone())
    } else {
        (order.correction_note.clone(), order.exception_reason.clone())
    };

    sqlx::query(
        r#"
        UPDATE tour_orders SET
            status = ?,
            current_handler_id = ?,
            current_handler_name = ?,
            version = ?,
            updated_at = ?,
            route_quote_evidence = ?,
            registration_confirm_evidence = ?,
            tour_audit_evidence = ?,
            correction_note = ?,
            exception_reason = ?
        WHERE id = ? AND version = ?
        "#
    )
    .bind(target.as_str())
    .bind(handler_id.map(|u| u.to_string()))
    .bind(handler_name.clone())
    .bind(new_version)
    .bind(now.to_rfc3339())
    .bind(if evidence.route_quote { 1 } else { 0 })
    .bind(if evidence.registration { 1 } else { 0 })
    .bind(if evidence.tour_audit { 1 } else { 0 })
    .bind(correction_note)
    .bind(exception_reason)
    .bind(oid.to_string())
    .bind(req.version)
    .execute(&mut *tx)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::VersionConflictError("版本冲突：订单已被其他操作更新".to_string()),
        other => AppError::DatabaseError(other),
    })?;

    insert_record_tx(
        &mut tx,
        &oid,
        Some(&order.status),
        &target,
        &check.transition.action_name,
        &auth,
        req.note.as_deref(),
        req.exception_reason.as_deref(),
    ).await?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(Json(get_order(&row)))
}

pub async fn batch_process(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Json(req): Json<BatchProcessRequest>,
) -> Result<Json<Vec<BatchProcessResult>>, AppError> {
    let target = OrderStatus::from_str(&req.target_status)
        .ok_or_else(|| AppError::ValidationError(format!("无效的目标状态: {}", req.target_status)))?;

    let mut results = Vec::new();

    for order_id_str in &req.order_ids {
        let order_id = match Uuid::parse_str(order_id_str) {
            Ok(u) => u,
            Err(_) => {
                results.push(BatchProcessResult {
                    order_id: order_id_str.clone(),
                    order_no: "—".to_string(),
                    success: false,
                    code: "INVALID_ID".to_string(),
                    message: "无效的订单ID".to_string(),
                });
                continue;
            }
        };

        let res = process_one(&auth, &pool, &order_id, order_id_str, &target, &req).await;
        results.push(res);
    }

    Ok(Json(results))
}

async fn process_one(
    auth: &AuthUser,
    pool: &SqlitePool,
    order_id: &Uuid,
    order_id_str: &str,
    target: &OrderStatus,
    req: &BatchProcessRequest,
) -> BatchProcessResult {
    let version = req.version_map
        .as_ref()
        .and_then(|m| m.get(order_id_str))
        .copied();

    let version = match version {
        Some(v) => v,
        None => return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no: "—".to_string(),
            success: false,
            code: "MISSING_VERSION".to_string(),
            message: "缺少版本号（请通过 version_map 传入）".to_string(),
        },
    };

    let row = match sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_id.to_string())
        .fetch_optional(pool)
        .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no: "—".to_string(),
            success: false,
            code: "NOT_FOUND".to_string(),
            message: "订单不存在".to_string(),
        },
        Err(e) => return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no: "—".to_string(),
            success: false,
            code: "DB_ERROR".to_string(),
            message: format!("读取失败: {}", e),
        },
    };

    let order = get_order(&row);
    let order_no = order.order_no.clone();

    if matches!(auth.role, UserRole::Registrar) && order.created_by != auth.id {
        return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "AUTH_ERR".to_string(),
            message: "仅创建人（登记员）可操作此订单".to_string(),
        };
    }

    if order.version != version {
        return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "VERSION_CONFLICT".to_string(),
            message: format!("版本冲突: 当前 v{}, 提交 v{}", order.version, version),
        };
    }

    if order.is_overdue && matches!(target, OrderStatus::PendingAudit | OrderStatus::PendingReview) {
        return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "OVERDUE".to_string(),
            message: "订单已逾期，禁止批量推进".to_string(),
        };
    }

    let transition = match find_transition(&order.status, target) {
        Some(t) => t,
        None => return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "STATE_CONFLICT".to_string(),
            message: format!("流转不合法: {} → {}", order.status.label(), target.label()),
        },
    };

    if !transition.allowed_roles.contains(&auth.role) {
        return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "ROLE_FORBIDDEN".to_string(),
            message: format!("角色「{}」无权执行此操作", auth.role.label()),
        };
    }

    let evidence = EvidenceState {
        route_quote: order.route_quote_evidence,
        registration: order.registration_confirm_evidence,
        tour_audit: order.tour_audit_evidence,
    };
    let missing: Vec<String> = transition.required_evidence
        .iter()
        .filter(|e| !evidence.has(**e))
        .map(|e| e.label().to_string())
        .collect();
    if !missing.is_empty() {
        return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "MISSING_EVIDENCE".to_string(),
            message: format!("缺少证据: {}", missing.join("、")),
        };
    }

    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(e) => return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "DB_ERROR".to_string(),
            message: format!("启动事务失败: {}", e),
        },
    };

    let new_version = order.version + 1;
    let now = Utc::now();
    let (handler_id, handler_name, _) = next_handler_for(target, &order.created_by);

    let result = sqlx::query(
        r#"
        UPDATE tour_orders SET
            status = ?,
            current_handler_id = ?,
            current_handler_name = ?,
            version = ?,
            updated_at = ?
        WHERE id = ? AND version = ?
        "#
    )
    .bind(target.as_str())
    .bind(handler_id.map(|u| u.to_string()))
    .bind(handler_name.clone())
    .bind(new_version)
    .bind(now.to_rfc3339())
    .bind(order_id.to_string())
    .bind(version)
    .execute(&mut *tx)
    .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            return BatchProcessResult {
                order_id: order_id_str.to_string(),
                order_no,
                success: false,
                code: "VERSION_CONFLICT".to_string(),
                message: "并发更新冲突".to_string(),
            };
        }
        Err(e) => return BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "DB_ERROR".to_string(),
            message: format!("更新失败: {}", e),
        },
        _ => {}
    }

    let _ = insert_record_tx(
        &mut tx,
        order_id,
        Some(&order.status),
        target,
        &transition.action_name,
        auth,
        req.note.as_deref(),
        None,
    ).await;

    match tx.commit().await {
        Ok(_) => BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: true,
            code: "OK".to_string(),
            message: format!("成功: {}（v{} → v{}）", transition.action_name, version, new_version),
        },
        Err(e) => BatchProcessResult {
            order_id: order_id_str.to_string(),
            order_no,
            success: false,
            code: "DB_ERROR".to_string(),
            message: format!("提交事务失败: {}", e),
        },
    }
}

pub async fn upload_attachment(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<UploadAttachmentRequest>,
) -> Result<(StatusCode, Json<Attachment>), AppError> {
    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;
    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = get_order(&row);

    let can_upload = match order.status {
        OrderStatus::Draft | OrderStatus::PendingCorrection =>
            matches!(auth.role, UserRole::Registrar) && order.created_by == auth.id,
        OrderStatus::PendingAudit => matches!(auth.role, UserRole::Auditor | UserRole::Registrar),
        OrderStatus::PendingReview => matches!(auth.role, UserRole::Reviewer | UserRole::Auditor),
        _ => false,
    };
    if !can_upload {
        return Err(AppError::AuthorizationError(
            format!("当前状态「{}」及角色不允许上传附件", order.status.label())
        ));
    }

    let et = EvidenceType::from_str(&req.evidence_type)
        .ok_or_else(|| AppError::ValidationError("evidence_type 只能是 route_quote / registration_confirm / tour_audit".to_string()))?;

    let aid = Uuid::new_v4();
    let now = Utc::now();
    let uploader_name = auth.display_name.clone();

    let mut tx = pool.begin().await.map_err(AppError::DatabaseError)?;

    sqlx::query(
        r#"
        INSERT INTO attachments (
            id, order_id, file_name, file_type, file_size, evidence_type,
            uploaded_by, uploaded_by_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(aid.to_string())
    .bind(oid.to_string())
    .bind(&req.file_name)
    .bind(&req.file_type)
    .bind(req.file_size)
    .bind(et.as_str())
    .bind(auth.id.to_string())
    .bind(&uploader_name)
    .bind(now.to_rfc3339())
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    let field_sql = format!("UPDATE tour_orders SET {} = 1, updated_at = ? WHERE id = ?", et.field_name());
    sqlx::query(&field_sql)
        .bind(now.to_rfc3339())
        .bind(oid.to_string())
        .execute(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

    insert_record_tx(
        &mut tx,
        &oid,
        Some(&order.status),
        &order.status,
        &format!("上传证据「{}」: {}", et.label(), req.file_name),
        &auth,
        None,
        None,
    ).await?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    let row = sqlx::query("SELECT * FROM attachments WHERE id = ?")
        .bind(aid.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(get_attachment(&row))))
}

pub async fn list_attachments(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Attachment>>, AppError> {
    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;
    check_order_permission(&auth, &pool, &oid).await?;

    let rows = sqlx::query(
        "SELECT * FROM attachments WHERE order_id = ? ORDER BY created_at DESC"
    )
    .bind(oid.to_string())
    .fetch_all(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(rows.iter().map(get_attachment).collect()))
}

pub async fn list_records(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<ProcessingRecord>>, AppError> {
    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;
    check_order_permission(&auth, &pool, &oid).await?;

    let rows = sqlx::query(
        "SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at DESC"
    )
    .bind(oid.to_string())
    .fetch_all(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(rows.iter().map(get_record).collect()))
}

pub async fn add_record(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<AddRecordRequest>,
) -> Result<(StatusCode, Json<ProcessingRecord>), AppError> {
    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;
    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = get_order(&row);

    if matches!(auth.role, UserRole::Registrar) && order.created_by != auth.id {
        return Err(AppError::AuthorizationError("无权操作此订单".to_string()));
    }

    insert_plain_record(
        &pool,
        &oid,
        &order.status,
        &order.status,
        &req.action,
        &auth,
        req.note.as_deref(),
        None,
    ).await?;

    let rows = sqlx::query(
        "SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(oid.to_string())
    .fetch_all(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let r = rows.first().ok_or_else(|| AppError::InternalError("记录写入失败".to_string()))?;
    Ok((StatusCode::CREATED, Json(get_record(r))))
}

pub async fn add_audit_note(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<AddAuditNoteRequest>,
) -> Result<(StatusCode, Json<AuditNote>), AppError> {
    if !matches!(auth.role, UserRole::Auditor | UserRole::Reviewer) {
        return Err(AppError::AuthorizationError("只有审核/复核角色可以添加审计备注".to_string()));
    }

    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;
    check_order_exists(&pool, &oid).await?;

    let aid = Uuid::new_v4();
    let now = Utc::now();
    let name = auth.display_name.clone();

    sqlx::query(
        "INSERT INTO audit_notes (id, order_id, content, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(aid.to_string())
    .bind(oid.to_string())
    .bind(&req.content)
    .bind(auth.id.to_string())
    .bind(&name)
    .bind(now.to_rfc3339())
    .execute(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let row = sqlx::query("SELECT * FROM audit_notes WHERE id = ?")
        .bind(aid.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(get_audit(&row))))
}

pub async fn list_audit_notes(
    auth: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<AuditNote>>, AppError> {
    let oid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;
    check_order_permission(&auth, &pool, &oid).await?;

    let rows = sqlx::query(
        "SELECT * FROM audit_notes WHERE order_id = ? ORDER BY created_at DESC"
    )
    .bind(oid.to_string())
    .fetch_all(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(Json(rows.iter().map(get_audit).collect()))
}

async fn check_order_exists(pool: &SqlitePool, oid: &Uuid) -> Result<(), AppError> {
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_one(pool)
        .await
        .map_err(AppError::DatabaseError)?;
    if n == 0 {
        Err(AppError::NotFound("订单不存在".to_string()))
    } else {
        Ok(())
    }
}

async fn check_order_permission(auth: &AuthUser, pool: &SqlitePool, oid: &Uuid) -> Result<(), AppError> {
    let row = sqlx::query("SELECT status, created_by, current_handler_id FROM tour_orders WHERE id = ?")
        .bind(oid.to_string())
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;
    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;

    let status = OrderStatus::from_str(&row.get::<String, _>("status")).unwrap_or(OrderStatus::Draft);
    let created_by = Uuid::parse_str(&row.get::<String, _>("created_by")).unwrap_or(Uuid::nil());
    let handler: Option<Uuid> = row.get::<Option<String>, _>("current_handler_id")
        .and_then(|s| Uuid::parse_str(&s).ok());

    if !can_view_order(&auth.role, &status, &created_by, &handler, &auth.id) {
        return Err(AppError::AuthorizationError("无权访问此订单".to_string()));
    }

    Ok(())
}

async fn insert_plain_record(
    pool: &SqlitePool,
    oid: &Uuid,
    from: &OrderStatus,
    to: &OrderStatus,
    action: &str,
    auth: &AuthUser,
    note: Option<&str>,
    exception: Option<&str>,
) -> Result<(), AppError> {
    let id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO processing_records (
            id, order_id, from_status, to_status, action,
            handler_id, handler_name, handler_role, note, exception_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(id.to_string())
    .bind(oid.to_string())
    .bind(Some(from.as_str()))
    .bind(to.as_str())
    .bind(action)
    .bind(auth.id.to_string())
    .bind(&auth.display_name)
    .bind(auth.role.as_str())
    .bind(note)
    .bind(exception)
    .bind(now.to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(())
}

async fn insert_record_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    oid: &Uuid,
    from: Option<&OrderStatus>,
    to: &OrderStatus,
    action: &str,
    auth: &AuthUser,
    note: Option<&str>,
    exception: Option<&str>,
) -> Result<(), AppError> {
    let id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO processing_records (
            id, order_id, from_status, to_status, action,
            handler_id, handler_name, handler_role, note, exception_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(id.to_string())
    .bind(oid.to_string())
    .bind(from.map(|s| s.as_str()))
    .bind(to.as_str())
    .bind(action)
    .bind(auth.id.to_string())
    .bind(&auth.display_name)
    .bind(auth.role.as_str())
    .bind(note)
    .bind(exception)
    .bind(now.to_rfc3339())
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(())
}

async fn insert_record(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    oid: &Uuid,
    from: Option<&OrderStatus>,
    to: &OrderStatus,
    action: &str,
    auth: &AuthUser,
    note: Option<&str>,
    exception: Option<&str>,
) -> Result<(), AppError> {
    insert_record_tx(tx, oid, from, to, action, auth, note, exception).await
}
