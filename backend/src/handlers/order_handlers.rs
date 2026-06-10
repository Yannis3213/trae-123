use axum::{
    extract::{Extension, Path, Query},
    Json,
    http::StatusCode,
};
use sqlx::{SqlitePool, sqlite::SqliteRow, Row};
use uuid::Uuid;
use chrono::{Utc, DateTime};
use serde::Serialize;
use std::collections::HashMap;

use crate::error::AppError;
use crate::models::{
    TourOrder, OrderStatus, CreateOrderRequest, UpdateOrderRequest,
    ChangeStatusRequest, BatchProcessRequest, BatchProcessResult,
    Attachment, ProcessingRecord, AddRecordRequest, AuditNote,
    AddAuditNoteRequest, OrderListQuery, PaginatedResponse, UserRole,
};
use crate::auth::AuthUser;
use crate::services::{check_state_transition, get_visible_statuses, get_next_handler};

fn parse_dt(s: &str) -> DateTime<Utc> {
    chrono::DateTime::parse_from_rfc3339(s).unwrap_or_else(|_| Utc::now()).with_timezone(&Utc)
}

fn row_to_order(row: SqliteRow) -> TourOrder {
    let id: String = row.get("id");
    let status_str: String = row.get("status");
    let handler: Option<String> = row.get("current_handler");
    let created_by: String = row.get("created_by");
    let deadline: Option<String> = row.get("deadline");

    TourOrder {
        id: Uuid::parse_str(&id).unwrap(),
        order_no: row.get("order_no"),
        route_name: row.get("route_name"),
        customer_name: row.get("customer_name"),
        customer_phone: row.get("customer_phone"),
        traveler_count: row.get("traveler_count"),
        departure_date: parse_dt(&row.get::<String, _>("departure_date")),
        return_date: parse_dt(&row.get::<String, _>("return_date")),
        quoted_price: row.get("quoted_price"),
        status: OrderStatus::from_str(&status_str).unwrap_or(OrderStatus::Draft),
        current_handler: handler.and_then(|h| Uuid::parse_str(&h).ok()),
        version: row.get("version"),
        is_overdue: row.get::<i32, _>("is_overdue") != 0,
        deadline: deadline.map(|d| parse_dt(&d)),
        exception_reason: row.get("exception_reason"),
        correction_note: row.get("correction_note"),
        route_quote_evidence: row.get::<Option<i32>, _>("route_quote_evidence").map(|v| v != 0),
        registration_confirm_evidence: row.get::<Option<i32>, _>("registration_confirm_evidence").map(|v| v != 0),
        tour_audit_evidence: row.get::<Option<i32>, _>("tour_audit_evidence").map(|v| v != 0),
        created_by: Uuid::parse_str(&created_by).unwrap(),
        created_at: parse_dt(&row.get::<String, _>("created_at")),
        updated_at: parse_dt(&row.get::<String, _>("updated_at")),
    }
}

fn row_to_attachment(row: SqliteRow) -> Attachment {
    Attachment {
        id: Uuid::parse_str(&row.get::<String, _>("id")).unwrap(),
        order_id: Uuid::parse_str(&row.get::<String, _>("order_id")).unwrap(),
        file_name: row.get("file_name"),
        file_type: row.get("file_type"),
        file_size: row.get("file_size"),
        evidence_type: row.get("evidence_type"),
        uploaded_by: Uuid::parse_str(&row.get::<String, _>("uploaded_by")).unwrap(),
        created_at: parse_dt(&row.get::<String, _>("created_at")),
    }
}

fn row_to_record(row: SqliteRow) -> ProcessingRecord {
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

fn row_to_audit(row: SqliteRow) -> AuditNote {
    AuditNote {
        id: Uuid::parse_str(&row.get::<String, _>("id")).unwrap(),
        order_id: Uuid::parse_str(&row.get::<String, _>("order_id")).unwrap(),
        content: row.get("content"),
        created_by: Uuid::parse_str(&row.get::<String, _>("created_by")).unwrap(),
        created_at: parse_dt(&row.get::<String, _>("created_at")),
    }
}

pub async fn list_orders(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Query(query): Query<OrderListQuery>,
) -> Result<Json<PaginatedResponse<TourOrder>>, AppError> {
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).min(100).max(1);
    let offset = (page - 1) * page_size;

    let visible_statuses = get_visible_statuses(&auth_user);
    let status_strs: Vec<&str> = visible_statuses.iter().map(|s| s.as_str()).collect();

    let mut sql = String::from(
        "SELECT o.* FROM tour_orders o WHERE 1=1"
    );
    let mut params: Vec<String> = Vec::new();
    let mut count_sql = String::from("SELECT COUNT(*) FROM tour_orders o WHERE 1=1");

    if let Some(status) = &query.status {
        if let Some(s) = OrderStatus::from_str(status) {
            if visible_statuses.contains(&s) {
                sql.push_str(" AND o.status = ?");
                count_sql.push_str(" AND o.status = ?");
                params.push(s.as_str().to_string());
            }
        }
    } else {
        let placeholders: Vec<String> = (0..status_strs.len()).map(|_| "?".to_string()).collect();
        sql.push_str(&format!(" AND o.status IN ({})", placeholders.join(", ")));
        count_sql.push_str(&format!(" AND o.status IN ({})", placeholders.join(", ")));
        params.extend(status_strs.iter().map(|s| s.to_string()));
    }

    if auth_user.is_registrar() {
        sql.push_str(" AND o.created_by = ?");
        count_sql.push_str(" AND o.created_by = ?");
        params.push(auth_user.id.to_string());
    }

    if let Some(overdue) = query.overdue {
        sql.push_str(" AND o.is_overdue = ?");
        count_sql.push_str(" AND o.is_overdue = ?");
        params.push(if overdue { "1" } else { "0" }.to_string());
    }

    if let Some(search) = &query.search {
        let search_term = format!("%{}%", search);
        sql.push_str(" AND (o.order_no LIKE ? OR o.route_name LIKE ? OR o.customer_name LIKE ?)");
        count_sql.push_str(" AND (o.order_no LIKE ? OR o.route_name LIKE ? OR o.customer_name LIKE ?)");
        params.push(search_term.clone());
        params.push(search_term.clone());
        params.push(search_term);
    }

    sql.push_str(" ORDER BY o.is_overdue DESC, o.updated_at DESC LIMIT ? OFFSET ?");

    let mut query_builder = sqlx::query(&sql);
    for p in &params {
        query_builder = query_builder.bind(p);
    }
    query_builder = query_builder.bind(page_size).bind(offset);

    let rows: Vec<SqliteRow> = query_builder.fetch_all(&pool).await.map_err(AppError::DatabaseError)?;
    let orders: Vec<TourOrder> = rows.into_iter().map(row_to_order).collect();

    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
    for p in &params {
        count_query = count_query.bind(p);
    }
    let total = count_query.fetch_one(&pool).await.map_err(AppError::DatabaseError)?;

    Ok(Json(PaginatedResponse {
        items: orders,
        total,
        page,
        page_size,
    }))
}

pub async fn get_order(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<TourOrder>, AppError> {
    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = row_to_order(row);

    let visible_statuses = get_visible_statuses(&auth_user);
    if !visible_statuses.contains(&order.status) {
        return Err(AppError::AuthorizationError("无权查看此订单".to_string()));
    }

    if auth_user.is_registrar() && order.created_by != auth_user.id {
        return Err(AppError::AuthorizationError("无权查看此订单".to_string()));
    }

    Ok(Json(order))
}

pub async fn create_order(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Json(req): Json<CreateOrderRequest>,
) -> Result<(StatusCode, Json<TourOrder>), AppError> {
    if !auth_user.is_registrar() {
        return Err(AppError::AuthorizationError("只有旅游登记员可以创建订单".to_string()));
    }

    let order_no = match req.order_no {
        Some(no) => no,
        None => format!("TO-{}{:08}", Utc::now().format("%Y%m%d"), rand_suffix()),
    };

    let status = if req.as_draft.unwrap_or(true) {
        OrderStatus::Draft
    } else {
        OrderStatus::PendingAudit
    };

    let id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO tour_orders (
            id, order_no, route_name, customer_name, customer_phone,
            traveler_count, departure_date, return_date, quoted_price,
            status, current_handler, version, is_overdue, deadline,
            route_quote_evidence, registration_confirm_evidence, tour_audit_evidence,
            created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(id.to_string())
    .bind(&order_no)
    .bind(&req.route_name)
    .bind(&req.customer_name)
    .bind(&req.customer_phone)
    .bind(req.traveler_count)
    .bind(req.departure_date.to_rfc3339())
    .bind(req.return_date.to_rfc3339())
    .bind(req.quoted_price)
    .bind(status.as_str())
    .bind(auth_user.id.to_string())
    .bind(1)
    .bind(0)
    .bind(req.deadline.map(|d| d.to_rfc3339()))
    .bind::<Option<i32>>(None)
    .bind::<Option<i32>>(None)
    .bind::<Option<i32>>(None)
    .bind(auth_user.id.to_string())
    .bind(now.to_rfc3339())
    .bind(now.to_rfc3339())
    .execute(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    add_processing_record(
        &pool,
        &id,
        None,
        &status,
        if matches!(status, OrderStatus::Draft) { "创建草稿" } else { "创建并提交" },
        &auth_user,
        None,
        None,
    ).await?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(id.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(row_to_order(row))))
}

pub async fn update_order(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<UpdateOrderRequest>,
) -> Result<Json<TourOrder>, AppError> {
    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = row_to_order(row);

    if auth_user.is_registrar() && order.created_by != auth_user.id {
        return Err(AppError::AuthorizationError("无权修改此订单".to_string()));
    }

    if order.version != req.version {
        return Err(AppError::VersionConflictError(format!(
            "版本冲突：当前版本 {}，提交版本 {}", order.version, req.version
        )));
    }

    let can_edit = matches!(order.status, OrderStatus::Draft | OrderStatus::PendingCorrection)
        && auth_user.is_registrar();
    if !can_edit {
        return Err(AppError::StateConflictError(format!(
            "当前状态 {:?} 不允许修改", order.status
        )));
    }

    let now = Utc::now();
    let new_version = order.version + 1;

    sqlx::query(
        r#"
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
        "#
    )
    .bind(req.route_name)
    .bind(req.customer_name)
    .bind(req.customer_phone)
    .bind(req.traveler_count)
    .bind(req.departure_date.map(|d| d.to_rfc3339()))
    .bind(req.return_date.map(|d| d.to_rfc3339()))
    .bind(req.quoted_price)
    .bind(req.deadline.map(|d| d.to_rfc3339()))
    .bind(req.route_quote_evidence.map(|v| if v { 1 } else { 0 }))
    .bind(req.registration_confirm_evidence.map(|v| if v { 1 } else { 0 }))
    .bind(req.tour_audit_evidence.map(|v| if v { 1 } else { 0 }))
    .bind(new_version)
    .bind(now.to_rfc3339())
    .bind(order_uuid.to_string())
    .execute(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    add_processing_record(
        &pool,
        &order_uuid,
        Some(&order.status),
        &order.status,
        "修改订单信息",
        &auth_user,
        None,
        None,
    ).await?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(Json(row_to_order(row)))
}

pub async fn change_status(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<ChangeStatusRequest>,
) -> Result<Json<TourOrder>, AppError> {
    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;
    let target = OrderStatus::from_str(&req.target_status)
        .ok_or_else(|| AppError::ValidationError(format!("无效的目标状态: {}", req.target_status)))?;

    let mut tx = pool.begin().await.map_err(AppError::DatabaseError)?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = row_to_order(row);

    if order.version != req.version {
        return Err(AppError::VersionConflictError(format!(
            "版本冲突：当前版本 {}，提交版本 {}", order.version, req.version
        )));
    }

    if auth_user.is_registrar() && order.created_by != auth_user.id {
        return Err(AppError::AuthorizationError("无权操作此订单".to_string()));
    }

    if order.is_overdue && matches!(target, OrderStatus::PendingAudit | OrderStatus::PendingReview) {
        return Err(AppError::StateConflictError("该订单已逾期，请先处理逾期标记".to_string()));
    }

    let route_quote = req.route_quote_evidence.or(order.route_quote_evidence).unwrap_or(false);
    let registration = req.registration_confirm_evidence.or(order.registration_confirm_evidence).unwrap_or(false);
    let tour_audit = req.tour_audit_evidence.or(order.tour_audit_evidence).unwrap_or(false);

    let transition = check_state_transition(
        &order.status,
        &target,
        &auth_user,
        route_quote,
        registration,
        tour_audit,
    )?;

    let now = Utc::now();
    let new_version = order.version + 1;
    let next_handler = get_next_handler(&target, &order.created_by, &order.current_handler);

    let correction_note = if matches!(target, OrderStatus::PendingCorrection) {
        req.note.clone()
    } else {
        order.correction_note.clone()
    };

    let exception_reason = if matches!(target, OrderStatus::PendingCorrection) {
        req.exception_reason.clone()
    } else {
        order.exception_reason.clone()
    };

    sqlx::query(
        r#"
        UPDATE tour_orders SET
            status = ?,
            current_handler = ?,
            version = ?,
            updated_at = ?,
            route_quote_evidence = ?,
            registration_confirm_evidence = ?,
            tour_audit_evidence = ?,
            correction_note = ?,
            exception_reason = ?
        WHERE id = ?
        "#
    )
    .bind(target.as_str())
    .bind(next_handler.map(|h| h.to_string()))
    .bind(new_version)
    .bind(now.to_rfc3339())
    .bind(if route_quote { Some(1) } else { Some(0) })
    .bind(if registration { Some(1) } else { Some(0) })
    .bind(if tour_audit { Some(1) } else { Some(0) })
    .bind(correction_note)
    .bind(exception_reason)
    .bind(order_uuid.to_string())
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    add_processing_record_tx(
        &mut tx,
        &order_uuid,
        Some(&order.status),
        &target,
        &transition.action_name,
        &auth_user,
        req.note.as_deref(),
        req.exception_reason.as_deref(),
    ).await?;

    tx.commit().await.map_err(AppError::DatabaseError)?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(Json(row_to_order(row)))
}

pub async fn batch_process(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Json(req): Json<BatchProcessRequest>,
) -> Result<Json<Vec<BatchProcessResult>>, AppError> {
    let target = OrderStatus::from_str(&req.target_status)
        .ok_or_else(|| AppError::ValidationError(format!("无效的目标状态: {}", req.target_status)))?;

    let mut results = Vec::new();

    for order_id in &req.order_ids {
        let result = process_single_batch(
            &auth_user,
            &pool,
            order_id,
            &target,
            &req,
        ).await;

        results.push(result);
    }

    Ok(Json(results))
}

async fn process_single_batch(
    auth_user: &AuthUser,
    pool: &SqlitePool,
    order_id: &Uuid,
    target: &OrderStatus,
    req: &BatchProcessRequest,
) -> BatchProcessResult {
    let version = req.version_map
        .as_ref()
        .and_then(|m| m.get(&order_id.to_string()))
        .copied();

    let version = match version {
        Some(v) => v,
        None => return BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: "缺少版本号".to_string(),
        },
    };

    let mut tx = match pool.begin().await {
        Ok(tx) => tx,
        Err(e) => return BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: format!("数据库错误: {}", e),
        },
    };

    let row = match sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_id.to_string())
        .fetch_optional(&mut *tx)
        .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return BatchProcessResult {
                order_id: order_id.clone(),
                success: false,
                message: "订单不存在".to_string(),
            };
        }
        Err(e) => return BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: format!("数据库错误: {}", e),
        },
    };

    let order = row_to_order(row);

    if order.version != version {
        return BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: format!("版本冲突: 当前 {}，提交 {}", order.version, version),
        };
    }

    if auth_user.is_registrar() && order.created_by != auth_user.id {
        return BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: "无权操作此订单".to_string(),
        };
    }

    if order.is_overdue && matches!(target, OrderStatus::PendingAudit | OrderStatus::PendingReview) {
        return BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: "订单已逾期，无法批量推进".to_string(),
        };
    }

    let route_quote = order.route_quote_evidence.unwrap_or(false);
    let registration = order.registration_confirm_evidence.unwrap_or(false);
    let tour_audit = order.tour_audit_evidence.unwrap_or(false);

    let transition = check_state_transition(
        &order.status,
        target,
        auth_user,
        route_quote,
        registration,
        tour_audit,
    );

    let transition = match transition {
        Ok(t) => t,
        Err(e) => return BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: e.to_string(),
        },
    };

    let now = Utc::now();
    let new_version = order.version + 1;
    let next_handler = get_next_handler(target, &order.created_by, &order.current_handler);

    let update_result = sqlx::query(
        "UPDATE tour_orders SET status = ?, current_handler = ?, version = ?, updated_at = ? WHERE id = ?"
    )
    .bind(target.as_str())
    .bind(next_handler.map(|h| h.to_string()))
    .bind(new_version)
    .bind(now.to_rfc3339())
    .bind(order_id.to_string())
    .execute(&mut *tx)
    .await;

    if let Err(e) = update_result {
        return BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: format!("状态更新失败: {}", e),
        };
    }

    let _ = add_processing_record_tx(
        &mut tx,
        order_id,
        Some(&order.status),
        target,
        &transition.action_name,
        auth_user,
        req.note.as_deref(),
        None,
    ).await;

    match tx.commit().await {
        Ok(_) => BatchProcessResult {
            order_id: order_id.clone(),
            success: true,
            message: format!("成功{}", transition.action_name),
        },
        Err(e) => BatchProcessResult {
            order_id: order_id.clone(),
            success: false,
            message: format!("提交失败: {}", e),
        },
    }
}

pub async fn upload_attachment(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<AttachmentUploadRequest>,
) -> Result<(StatusCode, Json<Attachment>), AppError> {
    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = row_to_order(row);

    let can_upload = match order.status {
        OrderStatus::Draft | OrderStatus::PendingCorrection => auth_user.is_registrar() && order.created_by == auth_user.id,
        OrderStatus::PendingAudit => auth_user.is_auditor(),
        OrderStatus::PendingReview => auth_user.is_reviewer(),
        _ => false,
    };

    if !can_upload {
        return Err(AppError::AuthorizationError("当前状态或角色不允许上传附件".to_string()));
    }

    let att_id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        r#"
        INSERT INTO attachments (id, order_id, file_name, file_type, file_size, evidence_type, uploaded_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(att_id.to_string())
    .bind(order_uuid.to_string())
    .bind(&req.file_name)
    .bind(&req.file_type)
    .bind(req.file_size)
    .bind(&req.evidence_type)
    .bind(auth_user.id.to_string())
    .bind(now.to_rfc3339())
    .execute(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    if req.evidence_type == "route_quote" {
        sqlx::query("UPDATE tour_orders SET route_quote_evidence = 1 WHERE id = ?")
            .bind(order_uuid.to_string())
            .execute(&pool)
            .await
            .map_err(AppError::DatabaseError)?;
    } else if req.evidence_type == "registration_confirm" {
        sqlx::query("UPDATE tour_orders SET registration_confirm_evidence = 1 WHERE id = ?")
            .bind(order_uuid.to_string())
            .execute(&pool)
            .await
            .map_err(AppError::DatabaseError)?;
    } else if req.evidence_type == "tour_audit" {
        sqlx::query("UPDATE tour_orders SET tour_audit_evidence = 1 WHERE id = ?")
            .bind(order_uuid.to_string())
            .execute(&pool)
            .await
            .map_err(AppError::DatabaseError)?;
    }

    let row = sqlx::query("SELECT * FROM attachments WHERE id = ?")
        .bind(att_id.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(row_to_attachment(row))))
}

pub async fn list_attachments(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Attachment>>, AppError> {
    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let order_row = sqlx::query("SELECT status, created_by FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let order_row = order_row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let status_str: String = order_row.get("status");
    let created_by_str: String = order_row.get("created_by");
    let status = OrderStatus::from_str(&status_str).unwrap_or(OrderStatus::Draft);
    let created_by = Uuid::parse_str(&created_by_str).unwrap();

    let visible_statuses = get_visible_statuses(&auth_user);
    if !visible_statuses.contains(&status) {
        return Err(AppError::AuthorizationError("无权查看此订单附件".to_string()));
    }
    if auth_user.is_registrar() && created_by != auth_user.id {
        return Err(AppError::AuthorizationError("无权查看此订单附件".to_string()));
    }

    let rows = sqlx::query("SELECT * FROM attachments WHERE order_id = ? ORDER BY created_at DESC")
        .bind(order_uuid.to_string())
        .fetch_all(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(Json(rows.into_iter().map(row_to_attachment).collect()))
}

pub async fn list_records(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<ProcessingRecord>>, AppError> {
    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let order_row = sqlx::query("SELECT status, created_by FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let order_row = order_row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let status_str: String = order_row.get("status");
    let created_by_str: String = order_row.get("created_by");
    let status = OrderStatus::from_str(&status_str).unwrap_or(OrderStatus::Draft);
    let created_by = Uuid::parse_str(&created_by_str).unwrap();

    let visible_statuses = get_visible_statuses(&auth_user);
    if !visible_statuses.contains(&status) {
        return Err(AppError::AuthorizationError("无权查看此订单处理记录".to_string()));
    }
    if auth_user.is_registrar() && created_by != auth_user.id {
        return Err(AppError::AuthorizationError("无权查看此订单处理记录".to_string()));
    }

    let rows = sqlx::query("SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at DESC")
        .bind(order_uuid.to_string())
        .fetch_all(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(Json(rows.into_iter().map(row_to_record).collect()))
}

pub async fn add_record(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<AddRecordRequest>,
) -> Result<(StatusCode, Json<ProcessingRecord>), AppError> {
    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = row_to_order(row);

    let visible_statuses = get_visible_statuses(&auth_user);
    if !visible_statuses.contains(&order.status) {
        return Err(AppError::AuthorizationError("无权操作此订单".to_string()));
    }
    if auth_user.is_registrar() && order.created_by != auth_user.id {
        return Err(AppError::AuthorizationError("无权操作此订单".to_string()));
    }

    add_processing_record(
        &pool,
        &order_uuid,
        Some(&order.status),
        &order.status,
        &req.action,
        &auth_user,
        req.note.as_deref(),
        None,
    ).await?;

    let rows = sqlx::query(
        "SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(order_uuid.to_string())
    .fetch_one(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(row_to_record(rows))))
}

pub async fn add_audit_note(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
    Json(req): Json<AddAuditNoteRequest>,
) -> Result<(StatusCode, Json<AuditNote>), AppError> {
    if !auth_user.is_auditor() && !auth_user.is_reviewer() {
        return Err(AppError::AuthorizationError("只有审核/复核人员可以添加审计备注".to_string()));
    }

    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let row = sqlx::query("SELECT * FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let row = row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let order = row_to_order(row);

    let note_id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO audit_notes (id, order_id, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(note_id.to_string())
    .bind(order_uuid.to_string())
    .bind(&req.content)
    .bind(auth_user.id.to_string())
    .bind(now.to_rfc3339())
    .execute(&pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let row = sqlx::query("SELECT * FROM audit_notes WHERE id = ?")
        .bind(note_id.to_string())
        .fetch_one(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok((StatusCode::CREATED, Json(row_to_audit(row))))
}

pub async fn list_audit_notes(
    auth_user: AuthUser,
    Extension(pool): Extension<SqlitePool>,
    Path(id): Path<String>,
) -> Result<Json<Vec<AuditNote>>, AppError> {
    let order_uuid = Uuid::parse_str(&id).map_err(|_| AppError::NotFound("无效的订单ID".to_string()))?;

    let order_row = sqlx::query("SELECT status, created_by FROM tour_orders WHERE id = ?")
        .bind(order_uuid.to_string())
        .fetch_optional(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let order_row = order_row.ok_or_else(|| AppError::NotFound("订单不存在".to_string()))?;
    let status_str: String = order_row.get("status");
    let created_by_str: String = order_row.get("created_by");
    let status = OrderStatus::from_str(&status_str).unwrap_or(OrderStatus::Draft);
    let created_by = Uuid::parse_str(&created_by_str).unwrap();

    let visible_statuses = get_visible_statuses(&auth_user);
    if !visible_statuses.contains(&status) {
        return Err(AppError::AuthorizationError("无权查看此订单审计备注".to_string()));
    }
    if auth_user.is_registrar() && created_by != auth_user.id {
        return Err(AppError::AuthorizationError("无权查看此订单审计备注".to_string()));
    }

    let rows = sqlx::query("SELECT * FROM audit_notes WHERE order_id = ? ORDER BY created_at DESC")
        .bind(order_uuid.to_string())
        .fetch_all(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(Json(rows.into_iter().map(row_to_audit).collect()))
}

async fn add_processing_record(
    pool: &SqlitePool,
    order_id: &Uuid,
    from_status: Option<&OrderStatus>,
    to_status: &OrderStatus,
    action: &str,
    user: &AuthUser,
    note: Option<&str>,
    exception_reason: Option<&str>,
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
    .bind(order_id.to_string())
    .bind(from_status.map(|s| s.as_str()))
    .bind(to_status.as_str())
    .bind(action)
    .bind(user.id.to_string())
    .bind(&user.display_name)
    .bind(user.role.as_str())
    .bind(note)
    .bind(exception_reason)
    .bind(now.to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(())
}

async fn add_processing_record_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    order_id: &Uuid,
    from_status: Option<&OrderStatus>,
    to_status: &OrderStatus,
    action: &str,
    user: &AuthUser,
    note: Option<&str>,
    exception_reason: Option<&str>,
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
    .bind(order_id.to_string())
    .bind(from_status.map(|s| s.as_str()))
    .bind(to_status.as_str())
    .bind(action)
    .bind(user.id.to_string())
    .bind(&user.display_name)
    .bind(user.role.as_str())
    .bind(note)
    .bind(exception_reason)
    .bind(now.to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(())
}

fn rand_suffix() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    (SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos() % 100000000) as u32
}

#[derive(serde::Deserialize)]
pub struct AttachmentUploadRequest {
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub evidence_type: String,
}
