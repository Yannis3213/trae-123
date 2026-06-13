use poem::http::HeaderMap;
use sqlx::SqlitePool;
use chrono::{Utc, Duration};
use crate::models::*;
use crate::auth::{extract_claims, encode_token, AuthClaims};
use std::collections::HashMap;
use std::str::FromStr;

pub async fn login(pool: &SqlitePool, req: &LoginRequest) -> Result<LoginResponse, AppError> {
    let row: Option<User> = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = ?")
        .bind(&req.username)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Internal(format!("DB error: {}", e)))?;

    let user = row.ok_or_else(|| AppError::Unauthorized("用户名或密码错误".into()))?;
    if user.password != req.password {
        return Err(AppError::Unauthorized("用户名或密码错误".into()));
    }

    let claims = AuthClaims {
        user_id: user.id.clone(),
        username: user.username.clone(),
        role: user.role.clone(),
        display_name: user.display_name.clone(),
        exp: (Utc::now() + Duration::hours(24)).timestamp(),
    };

    let token = encode_token(&claims);

    Ok(LoginResponse {
        token,
        user: UserInfo {
            id: user.id,
            username: user.username,
            role: user.role,
            display_name: user.display_name,
        },
    })
}

pub async fn list_users(pool: &SqlitePool, headers: &HeaderMap) -> Result<Vec<UserInfo>, AppError> {
    let _claims = extract_claims(headers)?;
    let rows: Vec<User> = sqlx::query_as::<_, User>("SELECT * FROM users ORDER BY role, username")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("DB error: {}", e)))?;
    Ok(rows.into_iter().map(|u| UserInfo {
        id: u.id,
        username: u.username,
        role: u.role,
        display_name: u.display_name,
    }).collect())
}

pub async fn me(headers: &HeaderMap) -> Result<UserInfo, AppError> {
    let claims = extract_claims(headers)?;
    Ok(UserInfo {
        id: claims.user_id,
        username: claims.username,
        role: claims.role,
        display_name: claims.display_name,
    })
}

fn compute_warning(interview_dl: &Option<chrono::DateTime<Utc>>, submission_dl: &Option<chrono::DateTime<Utc>>, status: &str) -> (String, bool, Option<String>) {
    let now = Utc::now();
    if status == TopicStatus::Closed.slug() || status == TopicStatus::Archived.slug() {
        return ("normal".to_string(), false, None);
    }
    let relevant = submission_dl.as_ref().or(interview_dl.as_ref());
    if let Some(dl) = relevant {
        let diff = *dl - now;
        if diff.num_hours() < 0 {
            let reason = if submission_dl.is_some() { "稿件提交截止时间已过" } else { "采访安排截止时间已过" };
            ("overdue".to_string(), true, Some(reason.to_string()))
        } else if diff.num_hours() <= 48 {
            ("warning".to_string(), false, None)
        } else {
            ("normal".to_string(), false, None)
        }
    } else {
        ("normal".to_string(), false, None)
    }
}

pub async fn list_topics(
    pool: &SqlitePool,
    headers: &HeaderMap,
    query: &TopicListQuery,
) -> Result<serde_json::Value, AppError> {
    let claims = extract_claims(headers)?;
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    let offset = (page - 1) * page_size;

    let mut where_clauses = Vec::new();
    let mut params: Vec<&str> = Vec::new();

    if let Some(status) = &query.status {
        where_clauses.push("status = ?");
    }
    if let Some(category) = &query.category {
        where_clauses.push("category = ?");
    }
    if let Some(priority) = &query.priority {
        where_clauses.push("priority = ?");
    }
    if let Some(keyword) = &query.keyword {
        where_clauses.push("(title LIKE ? OR description LIKE ?)");
    }

    let role = claims.role_enum();
    let mut can_see_all = false;
    let mut handler_only = false;
    match role.as_ref() {
        Some(UserRole::Registrar) => {
            where_clauses.push("(applicant_id = ? OR current_handler_id = ? OR status IN ('pending_dispatch','returned'))");
        }
        Some(UserRole::Auditor) => {
            where_clauses.push("(current_handler_id = ? OR status = 'pending_dispatch' OR applicant_id = ?)");
        }
        Some(UserRole::Reviewer) => {
            can_see_all = true;
        }
        _ => {
            handler_only = true;
            where_clauses.push("(applicant_id = ? OR current_handler_id = ?)");
        }
    }

    let sql_where = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM topics {}", sql_where);
    let list_sql = format!("SELECT * FROM topics {} ORDER BY updated_at DESC LIMIT ? OFFSET ?", sql_where);

    let total: i64 = {
        let mut q = sqlx::query_scalar(&count_sql);
        let mut idx = 0;
        if let Some(status) = &query.status { q = q.bind(status); idx += 1; }
        if let Some(category) = &query.category { q = q.bind(category); idx += 1; }
        if let Some(priority) = &query.priority { q = q.bind(priority); idx += 1; }
        if let Some(keyword) = &query.keyword { q = q.bind(format!("%{}%", keyword)); q = q.bind(format!("%{}%", keyword)); idx += 2; }
        if !can_see_all {
            if handler_only {
                q = q.bind(&claims.user_id);
                q = q.bind(&claims.user_id);
            } else if role.as_ref() == Some(&UserRole::Registrar) {
                q = q.bind(&claims.user_id);
                q = q.bind(&claims.user_id);
            } else {
                q = q.bind(&claims.user_id);
                q = q.bind(&claims.user_id);
            }
        }
        q.fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?
    };

    let mut rows: Vec<Topic> = {
        let mut q = sqlx::query_as::<_, Topic>(&list_sql);
        if let Some(status) = &query.status { q = q.bind(status); }
        if let Some(category) = &query.category { q = q.bind(category); }
        if let Some(priority) = &query.priority { q = q.bind(priority); }
        if let Some(keyword) = &query.keyword { q = q.bind(format!("%{}%", keyword)); q = q.bind(format!("%{}%", keyword)); }
        if !can_see_all {
            if handler_only {
                q = q.bind(&claims.user_id);
                q = q.bind(&claims.user_id);
            } else if role.as_ref() == Some(&UserRole::Registrar) {
                q = q.bind(&claims.user_id);
                q = q.bind(&claims.user_id);
            } else {
                q = q.bind(&claims.user_id);
                q = q.bind(&claims.user_id);
            }
        }
        q = q.bind(page_size as i64).bind(offset as i64);
        q.fetch_all(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?
    };

    if let Some(warning) = &query.warning {
        rows.retain(|t| {
            let (wl, _, _) = compute_warning(&t.interview_deadline, &t.submission_deadline, &t.status);
            wl == *warning
        });
    }

    let items: Vec<serde_json::Value> = rows.into_iter().map(|t| {
        let (wl, is_overdue, _) = compute_warning(&t.interview_deadline, &t.submission_deadline, &t.status);
        let mut v = serde_json::to_value(&t).unwrap();
        v["warning_level"] = serde_json::Value::String(wl);
        v["is_overdue"] = serde_json::Value::Bool(is_overdue);
        v
    }).collect();

    let final_total = if query.warning.is_some() { items.len() as i64 } else { total };

    Ok(serde_json::json!({
        "total": final_total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }))
}

pub async fn get_topic_detail(
    pool: &SqlitePool,
    headers: &HeaderMap,
    id: String,
) -> Result<TopicDetailResponse, AppError> {
    let claims = extract_claims(headers)?;

    let topic: Option<Topic> = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool)
        .await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    let topic = topic.ok_or_else(|| AppError::NotFound(format!("选题单 {} 不存在", id)))?;

    let role = claims.role_enum();
    let allowed = match role.as_ref() {
        Some(UserRole::Registrar) => {
            topic.applicant_id == Some(claims.user_id.clone())
                || topic.current_handler_id == Some(claims.user_id.clone())
                || topic.status == TopicStatus::PendingDispatch.slug()
                || topic.status == TopicStatus::Returned.slug()
        }
        Some(UserRole::Auditor) => {
            topic.current_handler_id == Some(claims.user_id.clone())
                || topic.status == TopicStatus::PendingDispatch.slug()
                || topic.applicant_id == Some(claims.user_id.clone())
        }
        Some(UserRole::Reviewer) => true,
        _ => {
            topic.applicant_id == Some(claims.user_id.clone()) || topic.current_handler_id == Some(claims.user_id.clone())
        }
    };
    if !allowed {
        return Err(AppError::Forbidden(format!("无权查看选题单 {}", id)));
    }

    let attachments: Vec<Attachment> = sqlx::query_as::<_, Attachment>(
        "SELECT * FROM attachments WHERE topic_id = ? ORDER BY uploaded_at"
    )
    .bind(&id)
    .fetch_all(pool)
    .await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    let records: Vec<ProcessRecord> = sqlx::query_as::<_, ProcessRecord>(
        "SELECT * FROM process_records WHERE topic_id = ? ORDER BY created_at"
    )
    .bind(&id)
    .fetch_all(pool)
    .await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    let audits: Vec<AuditLog> = sqlx::query_as::<_, AuditLog>(
        "SELECT * FROM audit_logs WHERE topic_id = ? ORDER BY created_at"
    )
    .bind(&id)
    .fetch_all(pool)
    .await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    let (warning_level, is_overdue, overdue_reason) = compute_warning(
        &topic.interview_deadline, &topic.submission_deadline, &topic.status
    );

    write_audit(pool, Some(id.clone()), &claims, "VIEW_TOPIC", &format!("查看选题单详情: {}", topic.title), None).await;

    Ok(TopicDetailResponse {
        topic,
        attachments,
        records,
        audits,
        warning_level,
        is_overdue,
        overdue_reason,
    })
}

async fn write_audit(
    pool: &SqlitePool,
    topic_id: Option<String>,
    claims: &AuthClaims,
    action: &str,
    detail: &str,
    ip: Option<&str>,
) {
    let id = uuid::Uuid::new_v4().to_string();
    let _ = sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(topic_id.as_ref())
    .bind(&claims.user_id)
    .bind(&claims.display_name)
    .bind(&claims.role)
    .bind(action)
    .bind(detail)
    .bind(ip)
    .bind(Utc::now().to_rfc3339())
    .execute(pool)
    .await;
}

pub async fn create_topic(
    pool: &SqlitePool,
    headers: &HeaderMap,
    req: &CreateTopicRequest,
) -> Result<Topic, AppError> {
    let claims = extract_claims(headers)?;
    claims.require_role(&[UserRole::Registrar])?;

    if req.title.trim().is_empty() {
        return Err(AppError::ValidationFailed("选题标题不能为空".into()));
    }
    if req.description.trim().is_empty() {
        return Err(AppError::ValidationFailed("选题描述不能为空".into()));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();
    let status = TopicStatus::PendingDispatch.slug().to_string();

    sqlx::query(
        "INSERT INTO topics (id, title, description, source, priority, category, status, applicant_id, applicant_name, current_handler_id, current_handler_name, interview_deadline, submission_deadline, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 1)"
    )
    .bind(&id).bind(&req.title).bind(&req.description).bind(&req.source).bind(&req.priority).bind(&req.category).bind(&status)
    .bind(&claims.user_id).bind(&claims.display_name)
    .bind(req.interview_deadline.map(|d| d.to_rfc3339())).bind(req.submission_deadline.map(|d| d.to_rfc3339()))
    .bind(now.to_rfc3339()).bind(now.to_rfc3339())
    .execute(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    let rec_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '创建', NULL, ?, ?, ?, ?, '选题申报成功', NULL, ?, 1)"
    )
    .bind(&rec_id).bind(&id).bind(&status).bind(&claims.user_id).bind(&claims.display_name).bind(&claims.role).bind(now.to_rfc3339())
    .execute(pool).await.ok();

    write_audit(pool, Some(id.clone()), &claims, "CREATE_TOPIC", &format!("创建选题单: {}", req.title), None).await;

    let topic: Topic = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&id)
        .fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    Ok(topic)
}

pub async fn update_topic(
    pool: &SqlitePool,
    headers: &HeaderMap,
    id: String,
    req: &UpdateTopicRequest,
) -> Result<Topic, AppError> {
    let claims = extract_claims(headers)?;

    let topic: Option<Topic> = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
    let topic = topic.ok_or_else(|| AppError::NotFound(format!("选题单 {} 不存在", id)))?;

    if topic.version != req.version {
        return Err(AppError::VersionConflict(format!(
            "版本冲突，当前版本={}，你提交的版本={}，请刷新后重试",
            topic.version, req.version
        )));
    }

    let role = claims.role_enum();
    match role.as_ref() {
        Some(UserRole::Registrar) => {
            if !(topic.applicant_id == Some(claims.user_id.clone())
                || topic.current_handler_id == Some(claims.user_id.clone())
                || topic.status == TopicStatus::Returned.slug())
            {
                return Err(AppError::Forbidden("登记员只能修改自己创建或当前处理中的退回补正题单".into()));
            }
            if topic.status == TopicStatus::Processing.slug() && topic.current_handler_id != Some(claims.user_id.clone()) {
                return Err(AppError::Forbidden("处理中题单仅当前处理人可修改".into()));
            }
        }
        Some(UserRole::Auditor) => {
            if !(topic.current_handler_id == Some(claims.user_id.clone())) {
                return Err(AppError::Forbidden("审核主管仅可修改本人正在处理的题单".into()));
            }
        }
        _ => {
            if topic.status != TopicStatus::Returned.slug() {
                return Err(AppError::Forbidden("当前角色无权修改题单".into()));
            }
        }
    }

    let now = Utc::now();
    let title = req.title.clone().unwrap_or(topic.title.clone());
    let description = req.description.clone().unwrap_or(topic.description.clone());
    let source = req.source.clone().unwrap_or(topic.source.clone());
    let priority = req.priority.clone().unwrap_or(topic.priority.clone());
    let category = req.category.clone().unwrap_or(topic.category.clone());
    let interview_dl = req.interview_deadline.unwrap_or(topic.interview_deadline);
    let submission_dl = req.submission_deadline.unwrap_or(topic.submission_deadline);

    sqlx::query(
        "UPDATE topics SET title = ?, description = ?, source = ?, priority = ?, category = ?, interview_deadline = ?, submission_deadline = ?, updated_at = ? WHERE id = ? AND version = ?"
    )
    .bind(&title).bind(&description).bind(&source).bind(&priority).bind(&category)
    .bind(interview_dl.map(|d| d.to_rfc3339())).bind(submission_dl.map(|d| d.to_rfc3339()))
    .bind(now.to_rfc3339()).bind(&id).bind(req.version)
    .execute(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    write_audit(pool, Some(id.clone()), &claims, "UPDATE_TOPIC", &format!("更新选题单信息: {}", title), None).await;

    let result: Topic = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&id)
        .fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
    Ok(result)
}

pub struct ProcessActionResult {
    pub topic: Topic,
    pub action_performed: String,
}

pub async fn process_topic(
    pool: &SqlitePool,
    headers: &HeaderMap,
    id: String,
    req: &ProcessTopicRequest,
) -> Result<ProcessActionResult, AppError> {
    let claims = extract_claims(headers)?;

    let topic: Option<Topic> = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
    let topic = topic.ok_or_else(|| AppError::NotFound(format!("选题单 {} 不存在", id)))?;

    if topic.version != req.version {
        return Err(AppError::VersionConflict(format!(
            "版本冲突: 当前版本={}，提交版本={}，请刷新后重试",
            topic.version, req.version
        )));
    }

    if req.opinion.trim().is_empty() {
        return Err(AppError::ValidationFailed("处理意见不能为空".into()));
    }

    let role = claims.role_enum();
    if req.target_handler_id.is_some() && req.target_handler_id == Some(claims.user_id.clone()) {
        let is_registrar_resubmit = matches!(role.as_ref(), Some(UserRole::Registrar))
            && req.action == "dispatch";
        if is_registrar_resubmit {
            return Err(AppError::ValidationFailed(
                "登记员重新提交不能将自己设为处理人，请指派责任编辑或总编室".into()
            ));
        }
    }
    let now = Utc::now();
    let new_version = topic.version + 1;

    let (action_performed, new_status, new_handler_id, new_handler_name) =
        do_process_action(pool, id.clone(), &topic, &claims, role.as_ref(), req, new_version, now).await?;

    if let Some(atts) = &req.attachments {
        for att in atts {
            if att.attachment_type.trim().is_empty() || att.file_name.trim().is_empty() {
                return Err(AppError::ValidationFailed("附件类型或文件名不能为空".into()));
            }
            let aid = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&aid).bind(&id).bind(&att.attachment_type)
            .bind(&att.file_name).bind(&att.file_url).bind(&att.description)
            .bind(&claims.user_id).bind(&claims.display_name).bind(now.to_rfc3339())
            .execute(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
        }
    }

    write_audit(pool, Some(id.clone()), &claims, &action_performed, &format!("{} -> {}: {}", topic.status, new_status, req.opinion), None).await;

    let result: Topic = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&id)
        .fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    Ok(ProcessActionResult { topic: result, action_performed })
}

async fn do_process_action(
    pool: &SqlitePool,
    id: String,
    topic: &Topic,
    claims: &AuthClaims,
    role: Option<&UserRole>,
    req: &ProcessTopicRequest,
    new_version: i64,
    now: chrono::DateTime<Utc>,
) -> Result<(String, String, Option<String>, Option<String>), AppError> {
    let mut action_performed = String::new();
    let mut new_status = topic.status.clone();
    let mut new_handler_id = topic.current_handler_id.clone();
    let mut new_handler_name = topic.current_handler_name.clone();

    match req.action.as_str() {
        "dispatch" => {
            let _ = role.ok_or_else(|| AppError::Forbidden("无角色信息".into()))?;
            if topic.status != TopicStatus::PendingDispatch.slug() && topic.status != TopicStatus::Returned.slug() {
                return Err(AppError::StateConflict(format!(
                    "当前状态 \"{}\" 不允许派发操作，仅待派发/退回补正可派发",
                    TopicStatus::from_str(&topic.status).map(|s| s.as_str()).unwrap_or(&topic.status)
                )));
            }
            if let Some(UserRole::Auditor) = role {
                let (hid, hname) = if let Some(tid) = &req.target_handler_id {
                    let tu: Option<User> = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
                        .bind(tid).fetch_optional(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
                    let tu = tu.ok_or_else(|| AppError::ValidationFailed(format!("目标处理人 {} 不存在", tid)))?;
                    if tu.role != UserRole::Auditor.as_str() && tu.role != UserRole::Reviewer.as_str() {
                        return Err(AppError::Forbidden(format!("目标处理人角色 {} 不可作为派发对象", tu.role)));
                    }
                    (Some(tid.clone()), Some(tu.display_name))
                } else {
                    (Some(claims.user_id.clone()), Some(claims.display_name.clone()))
                };
                new_status = TopicStatus::Processing.slug().to_string();
                new_handler_id = hid;
                new_handler_name = hname;
                action_performed = "派发".to_string();
            } else if let Some(UserRole::Registrar) = role {
                if topic.status != TopicStatus::Returned.slug() {
                    return Err(AppError::Forbidden("登记员不能直接派发，仅可在退回补正后重新提交".into()));
                }
                let tid = req.target_handler_id.clone().ok_or_else(|| AppError::ValidationFailed("重新提交必须指定目标审核主管".into()))?;
                let tu: Option<User> = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
                    .bind(&tid).fetch_optional(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
                let tu = tu.ok_or_else(|| AppError::ValidationFailed(format!("目标处理人 {} 不存在", tid)))?;
                if tu.role != UserRole::Auditor.as_str() {
                    return Err(AppError::Forbidden("重新提交必须派发给审核主管".into()));
                }
                new_status = TopicStatus::Processing.slug().to_string();
                new_handler_id = Some(tid);
                new_handler_name = Some(tu.display_name);
                action_performed = "重新提交".to_string();
            } else {
                return Err(AppError::Forbidden("复核负责人不执行派发操作".into()));
            }
        }
        "return" => {
            if topic.status != TopicStatus::Processing.slug() {
                return Err(AppError::StateConflict(format!("当前状态 {} 不允许退回补正", topic.status)));
            }
            if Some(claims.user_id.clone()) != topic.current_handler_id {
                return Err(AppError::Forbidden("只有当前处理人可以退回补正".into()));
            }
            match role {
                Some(UserRole::Auditor) | Some(UserRole::Reviewer) => {
                    new_status = TopicStatus::Returned.slug().to_string();
                    let app_id = topic.applicant_id.clone().ok_or_else(|| AppError::Internal("申请人信息缺失".into()))?;
                    new_handler_id = Some(app_id);
                    new_handler_name = Some(topic.applicant_name.clone());
                    action_performed = "退回补正".to_string();
                }
                _ => return Err(AppError::Forbidden("登记员无权退回补正".into())),
            }
        }
        "progress" => {
            if topic.status != TopicStatus::Processing.slug() {
                return Err(AppError::StateConflict(format!("当前状态 {} 无法更新进度，仅处理中可操作", topic.status)));
            }
            if Some(claims.user_id.clone()) != topic.current_handler_id {
                return Err(AppError::Forbidden("仅当前处理人可更新进度".into()));
            }
            action_performed = "进度更新".to_string();
        }
        "submit_review" => {
            if topic.status != TopicStatus::Processing.slug() {
                return Err(AppError::StateConflict(format!("当前状态 {} 不允许提交复核", topic.status)));
            }
            if Some(claims.user_id.clone()) != topic.current_handler_id {
                return Err(AppError::Forbidden("仅当前处理人可提交复核".into()));
            }
            if let Some(UserRole::Auditor) = role {
                let decl_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM attachments WHERE topic_id = ? AND attachment_type = '选题申报'")
                    .bind(&id).fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
                let interview_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM attachments WHERE topic_id = ? AND attachment_type = '采访安排'")
                    .bind(&id).fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
                let manu_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM attachments WHERE topic_id = ? AND attachment_type = '稿件提交'")
                    .bind(&id).fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

                if decl_count == 0 {
                    return Err(AppError::ValidationFailed("提交复核缺少「选题申报」证据材料".into()));
                }
                if interview_count == 0 {
                    return Err(AppError::ValidationFailed("提交复核缺少「采访安排」证据材料".into()));
                }
                if manu_count == 0 {
                    return Err(AppError::ValidationFailed("提交复核缺少「稿件提交」证据材料".into()));
                }

                let reviewer: Option<User> = sqlx::query_as::<_, User>("SELECT * FROM users WHERE role = 'reviewer' LIMIT 1")
                    .fetch_optional(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
                if let Some(r) = reviewer {
                    new_handler_id = Some(r.id);
                    new_handler_name = Some(r.display_name);
                }
                action_performed = "提交复核".to_string();
            } else {
                return Err(AppError::Forbidden("仅审核主管可提交复核".into()));
            }
        }
        "close" => {
            if let Some(UserRole::Reviewer) = role {
                if topic.status != TopicStatus::Processing.slug() {
                    return Err(AppError::StateConflict(format!("当前状态 {} 不允许关闭，仅处理中题单可关闭", topic.status)));
                }
                if Some(claims.user_id.clone()) != topic.current_handler_id {
                    return Err(AppError::Forbidden("仅当前处理人（复核负责人）可执行关闭".into()));
                }
                let decl_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM attachments WHERE topic_id = ? AND attachment_type = '选题申报'")
                    .bind(&id).fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
                let interview_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM attachments WHERE topic_id = ? AND attachment_type = '采访安排'")
                    .bind(&id).fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
                let manu_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM attachments WHERE topic_id = ? AND attachment_type = '稿件提交'")
                    .bind(&id).fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
                if decl_count == 0 || interview_count == 0 || manu_count == 0 {
                    return Err(AppError::ValidationFailed(format!(
                        "关闭前需三类证据齐全：选题申报({})、采访安排({})、稿件提交({})",
                        decl_count, interview_count, manu_count
                    )));
                }
                new_status = TopicStatus::Closed.slug().to_string();
                new_handler_id = None;
                new_handler_name = None;
                action_performed = "关闭".to_string();
            } else if let Some(UserRole::Auditor) = role {
                return Err(AppError::Forbidden("审核主管无权关闭题单，请提交复核后由总编室关闭".into()));
            } else {
                return Err(AppError::Forbidden("登记员无权关闭题单".into()));
            }
        }
        "archive" => {
            if let Some(UserRole::Reviewer) = role {
                if topic.status != TopicStatus::Closed.slug() {
                    return Err(AppError::StateConflict(format!("当前状态 {} 不允许归档，仅已关闭题单可归档", topic.status)));
                }
                new_status = TopicStatus::Archived.slug().to_string();
                action_performed = "归档".to_string();
            } else {
                return Err(AppError::Forbidden("仅复核负责人可执行归档".into()));
            }
        }
        "reopen" => {
            if let Some(UserRole::Reviewer) = role {
                if topic.status != TopicStatus::Closed.slug() {
                    return Err(AppError::StateConflict(format!("当前状态 {} 不允许重开", topic.status)));
                }
                new_status = TopicStatus::Processing.slug().to_string();
                new_handler_id = Some(claims.user_id.clone());
                new_handler_name = Some(claims.display_name.clone());
                action_performed = "重开".to_string();
            } else {
                return Err(AppError::Forbidden("仅复核负责人可执行重开".into()));
            }
        }
        other => {
            return Err(AppError::BadRequest(format!("未知操作类型: {}", other)));
        }
    }

    let rec_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&rec_id).bind(&id).bind(&action_performed)
    .bind(&topic.status).bind(&new_status)
    .bind(&claims.user_id).bind(&claims.display_name).bind(&claims.role)
    .bind(&req.opinion).bind(req.remark.as_deref())
    .bind(now.to_rfc3339()).bind(new_version)
    .execute(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    sqlx::query(
        "UPDATE topics SET status = ?, current_handler_id = ?, current_handler_name = ?, updated_at = ?, version = ? WHERE id = ? AND version = ?"
    )
    .bind(&new_status)
    .bind(new_handler_id.as_ref())
    .bind(&new_handler_name)
    .bind(now.to_rfc3339()).bind(new_version)
    .bind(&id).bind(req.version)
    .execute(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    Ok((action_performed, new_status, new_handler_id, new_handler_name))
}

pub async fn batch_process(
    pool: &SqlitePool,
    headers: &HeaderMap,
    req: &BatchProcessRequest,
) -> Result<BatchProcessResponse, AppError> {
    let claims = extract_claims(headers)?;
    if req.ids.is_empty() {
        return Err(AppError::BadRequest("批量处理ID列表不能为空".into()));
    }
    if req.opinion.trim().is_empty() {
        return Err(AppError::ValidationFailed("批量处理意见不能为空".into()));
    }
    if req.ids.len() > 100 {
        return Err(AppError::BadRequest("单次批量处理不能超过100条".into()));
    }

    let mut results = Vec::with_capacity(req.ids.len());
    let mut success_count = 0usize;

    for id in &req.ids {
        let topic: Option<Topic> = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
            .bind(id)
            .fetch_optional(pool).await.ok().flatten();

        let topic = match topic {
            Some(t) => t,
            None => {
                results.push(BatchResultItem {
                    id: id.clone(),
                    title: "(不存在)".to_string(),
                    success: false,
                    error_code: Some("NOT_FOUND".to_string()),
                    error_message: Some(format!("选题单 {} 不存在", id)),
                    new_status: None,
                });
                continue;
            }
        };

        let ver = req.versions.get(id).copied().unwrap_or(topic.version);

        let (_, is_overdue, overdue_reason) = compute_warning(&topic.interview_deadline, &topic.submission_deadline, &topic.status);
        if is_overdue && (req.action == "dispatch" || req.action == "close") {
            results.push(BatchResultItem {
                id: id.clone(),
                title: topic.title.clone(),
                success: false,
                error_code: Some("OVERDUE_BLOCKED".to_string()),
                error_message: Some(format!(
                    "题单已逾期，不允许批量{}。逾期原因: {}；请先在详情页处理逾期补正",
                    match req.action.as_str() { "dispatch" => "派发", "close" => "关闭", _ => &req.action },
                    overdue_reason.unwrap_or_else(|| "未知".into())
                )),
                new_status: None,
            });
            continue;
        }

        let process_req = ProcessTopicRequest {
            action: req.action.clone(),
            opinion: req.opinion.clone(),
            remark: req.remark.clone(),
            target_handler_id: req.target_handler_id.clone(),
            version: ver,
            attachments: None,
        };

        match do_process_action_wrap(pool, headers, id.clone(), &process_req, &claims, &topic).await {
            Ok(r) => {
                success_count += 1;
                let new_status_saved = r.topic.status.clone();
                results.push(BatchResultItem {
                    id: id.clone(),
                    title: topic.title.clone(),
                    success: true,
                    error_code: None,
                    error_message: None,
                    new_status: Some(new_status_saved.clone()),
                });
                let rec_id = uuid::Uuid::new_v4().to_string();
                let _ = sqlx::query(
                    "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '批量备注', ?, ?, ?, ?, ?, ?, '[批量处理]', ?, ?)"
                )
                .bind(&rec_id).bind(id)
                .bind(&topic.status).bind(&new_status_saved)
                .bind(&claims.user_id).bind(&claims.display_name).bind(&claims.role)
                .bind(&req.opinion).bind(Utc::now().to_rfc3339()).bind(r.topic.version)
                .execute(pool).await;
            }
            Err(e) => {
                results.push(BatchResultItem {
                    id: id.clone(),
                    title: topic.title.clone(),
                    success: false,
                    error_code: Some(e.code().to_string()),
                    error_message: Some(e.to_string()),
                    new_status: None,
                });
            }
        }
    }

    write_audit(
        pool,
        None,
        &claims,
        "BATCH_PROCESS",
        &format!("批量{}共{}条，成功{}，失败{}", req.action, req.ids.len(), success_count, req.ids.len() - success_count),
        None,
    ).await;

    Ok(BatchProcessResponse {
        total: req.ids.len(),
        success_count,
        failed_count: req.ids.len() - success_count,
        results,
    })
}

async fn do_process_action_wrap(
    pool: &SqlitePool,
    _headers: &HeaderMap,
    id: String,
    req: &ProcessTopicRequest,
    claims: &AuthClaims,
    topic: &Topic,
) -> Result<ProcessActionResult, AppError> {
    if topic.version != req.version {
        return Err(AppError::VersionConflict(format!(
            "版本冲突: 当前={},提交={}", topic.version, req.version
        )));
    }
    if req.opinion.trim().is_empty() {
        return Err(AppError::ValidationFailed("处理意见不能为空".into()));
    }
    let role = claims.role_enum();
    let now = Utc::now();
    let new_version = topic.version + 1;
    let (action_performed, _ns, _nh, _nhn) =
        do_process_action(pool, id.clone(), topic, claims, role.as_ref(), req, new_version, now).await?;

    let result: Topic = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&id)
        .fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
    Ok(ProcessActionResult { topic: result, action_performed })
}

pub async fn topic_statistics(
    pool: &SqlitePool,
    headers: &HeaderMap,
) -> Result<serde_json::Value, AppError> {
    let claims = extract_claims(headers)?;

    let role = claims.role_enum();
    let mut base_sql = "SELECT status, COUNT(*) FROM topics".to_string();
    let mut where_clause = String::new();
    match role.as_ref() {
        Some(UserRole::Registrar) => {
            where_clause = format!(" WHERE applicant_id = '{}' OR current_handler_id = '{}' OR status IN ('pending_dispatch','returned')", claims.user_id, claims.user_id);
        }
        Some(UserRole::Auditor) => {
            where_clause = format!(" WHERE current_handler_id = '{}' OR status = 'pending_dispatch'", claims.user_id);
        }
        _ => {}
    }
    base_sql.push_str(&where_clause);
    base_sql.push_str(" GROUP BY status");

    let rows: Vec<(String, i64)> = sqlx::query_as(&base_sql)
        .fetch_all(pool)
        .await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    let mut map = HashMap::new();
    for (s, c) in rows {
        map.insert(s, c);
    }

    let pending = map.get("pending_dispatch").copied().unwrap_or(0);
    let processing = map.get("processing").copied().unwrap_or(0);
    let returned = map.get("returned").copied().unwrap_or(0);
    let closed = map.get("closed").copied().unwrap_or(0);
    let archived = map.get("archived").copied().unwrap_or(0);

    let mut overdue = 0i64;
    let mut warning = 0i64;
    let all_topics_sql = if where_clause.is_empty() {
        "SELECT interview_deadline, submission_deadline, status FROM topics".to_string()
    } else {
        format!("SELECT interview_deadline, submission_deadline, status FROM topics {}", where_clause)
    };
    let all: Vec<(Option<String>, Option<String>, String)> = sqlx::query_as(&all_topics_sql)
        .fetch_all(pool).await.unwrap_or_default();
    for (idl, sdl, st) in all {
        let idl2 = idl.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc)));
        let sdl2 = sdl.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc)));
        let (wl, is_overdue, _) = compute_warning(&idl2, &sdl2, &st);
        if is_overdue { overdue += 1; }
        if wl == "warning" { warning += 1; }
    }

    let my_pending: i64 = if role.as_ref() == Some(&UserRole::Registrar) {
        sqlx::query_scalar("SELECT COUNT(*) FROM topics WHERE status = 'returned' AND current_handler_id = ?")
            .bind(&claims.user_id).fetch_one(pool).await.unwrap_or(0)
    } else {
        sqlx::query_scalar("SELECT COUNT(*) FROM topics WHERE status = 'processing' AND current_handler_id = ?")
            .bind(&claims.user_id).fetch_one(pool).await.unwrap_or(0)
    };

    Ok(serde_json::json!({
        "by_status": {
            "pending_dispatch": pending,
            "processing": processing,
            "returned": returned,
            "closed": closed,
            "archived": archived,
        },
        "warning": {
            "normal": pending + processing + returned + closed + archived - overdue - warning,
            "warning": warning,
            "overdue": overdue,
        },
        "my_pending": my_pending,
    }))
}

pub async fn upload_attachment(
    pool: &SqlitePool,
    headers: &HeaderMap,
    topic_id: String,
    input: &AttachmentInput,
) -> Result<Attachment, AppError> {
    let claims = extract_claims(headers)?;
    let topic: Option<Topic> = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&topic_id)
        .fetch_optional(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
    let topic = topic.ok_or_else(|| AppError::NotFound(format!("选题单 {} 不存在", topic_id)))?;

    let role = claims.role_enum();
    let allowed = match role.as_ref() {
        Some(UserRole::Registrar) => {
            input.attachment_type == "选题申报" && (topic.applicant_id == Some(claims.user_id.clone()) || topic.current_handler_id == Some(claims.user_id.clone()))
        }
        Some(UserRole::Auditor) => {
            (input.attachment_type == "采访安排" || input.attachment_type == "稿件提交" || input.attachment_type == "补充证据")
                && topic.current_handler_id == Some(claims.user_id.clone())
        }
        Some(UserRole::Reviewer) => {
            input.attachment_type == "补充证据" && topic.current_handler_id == Some(claims.user_id.clone())
        }
        _ => false,
    };
    if !allowed {
        return Err(AppError::Forbidden(format!(
            "角色 {} 无权上传类型 {} 的附件（或当前非处理人）",
            claims.role, input.attachment_type
        )));
    }

    if input.file_name.trim().is_empty() {
        return Err(AppError::ValidationFailed("文件名不能为空".into()));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(&topic_id).bind(&input.attachment_type)
    .bind(&input.file_name).bind(&input.file_url).bind(&input.description)
    .bind(&claims.user_id).bind(&claims.display_name).bind(now.to_rfc3339())
    .execute(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;

    write_audit(pool, Some(topic_id.clone()), &claims, "UPLOAD_ATTACHMENT", &format!("上传{}: {}", input.attachment_type, input.file_name), None).await;

    let a: Attachment = sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE id = ?")
        .bind(&id)
        .fetch_one(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
    Ok(a)
}

pub async fn delete_attachment(
    pool: &SqlitePool,
    headers: &HeaderMap,
    topic_id: String,
    attach_id: String,
) -> Result<(), AppError> {
    let claims = extract_claims(headers)?;
    let att: Option<Attachment> = sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE id = ?")
        .bind(&attach_id)
        .fetch_optional(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
    let att = att.ok_or_else(|| AppError::NotFound("附件不存在".into()))?;
    if att.topic_id != topic_id {
        return Err(AppError::BadRequest("附件与题单不匹配".into()));
    }
    if att.uploaded_by != claims.user_id {
        return Err(AppError::Forbidden("仅上传人可删除附件".into()));
    }
    let topic: Option<Topic> = sqlx::query_as::<_, Topic>("SELECT * FROM topics WHERE id = ?")
        .bind(&topic_id).fetch_optional(pool).await.unwrap_or(None);
    if let Some(t) = topic {
        if t.status == TopicStatus::Closed.slug() || t.status == TopicStatus::Archived.slug() {
            return Err(AppError::StateConflict("已关闭/已归档的题单不允许删除附件".into()));
        }
    }
    sqlx::query("DELETE FROM attachments WHERE id = ?")
        .bind(&attach_id)
        .execute(pool).await.map_err(|e| AppError::Internal(format!("DB: {}", e)))?;
    write_audit(pool, Some(topic_id), &claims, "DELETE_ATTACHMENT", &format!("删除附件: {}", att.file_name), None).await;
    Ok(())
}

pub fn parse_topic_list_query(params: &HashMap<String, String>) -> TopicListQuery {
    TopicListQuery {
        status: params.get("status").cloned(),
        category: params.get("category").cloned(),
        priority: params.get("priority").cloned(),
        keyword: params.get("keyword").cloned(),
        page: params.get("page").and_then(|s| s.parse().ok()),
        page_size: params.get("page_size").and_then(|s| s.parse().ok()),
        warning: params.get("warning").cloned(),
    }
}
