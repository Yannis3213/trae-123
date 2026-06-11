use crate::errors::AppError;
use crate::models::{
    Attachment, AuditNote, BatchProcessResult, Case, CaseStatus, CaseWithDetail,
    CreateCaseRequest, ExpiryStatus, PaginatedResponse, ProcessingRecord, ProcessingStage,
    Role, StatisticsResponse, UpdateStatusRequest, User,
};
use crate::services::validation_service::{
    calculate_expiry_status, determine_next_stage, get_expiry_days, validate_batch_permission,
    validate_case_evidence, validate_handler_assignment, validate_status_transition, validate_version,
};
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn get_case_by_id(pool: &SqlitePool, case_id: Uuid) -> Result<Case, AppError> {
    let case = sqlx::query_as!(
        Case,
        r#"SELECT
            id as 'id: uuid::Uuid',
            case_number, title, description, case_type, location,
            reporter_name, reporter_phone,
            status as 'status: CaseStatus',
            current_stage as 'current_stage: ProcessingStage',
            current_handler_id as 'current_handler_id: uuid::Uuid',
            current_handler_name,
            registration_materials_complete,
            dispatch_timeline_met,
            followup_evidence_complete,
            deadline as 'deadline: chrono::DateTime<chrono::Utc>',
            version,
            created_by as 'created_by: uuid::Uuid',
            created_by_name,
            created_at as 'created_at: chrono::DateTime<chrono::Utc>',
            updated_at as 'updated_at: chrono::DateTime<chrono::Utc>',
            completed_at as 'completed_at: chrono::DateTime<chrono::Utc>'
        FROM cases WHERE id = ?"#,
        case_id.to_string()
    )
    .fetch_one(pool)
    .await?;

    Ok(case)
}

pub async fn get_case_detail(
    pool: &SqlitePool,
    case_id: Uuid,
) -> Result<CaseWithDetail, AppError> {
    let case = get_case_by_id(pool, case_id).await?;
    let expiry_status = calculate_expiry_status(&case);

    let attachments = sqlx::query_as!(
        Attachment,
        r#"SELECT
            id as 'id: uuid::Uuid',
            case_id as 'case_id: uuid::Uuid',
            file_name, file_type, file_size, category,
            uploaded_by as 'uploaded_by: uuid::Uuid',
            uploaded_by_name,
            uploaded_at as 'uploaded_at: chrono::DateTime<chrono::Utc>'
        FROM attachments WHERE case_id = ? ORDER BY uploaded_at DESC"#,
        case_id.to_string()
    )
    .fetch_all(pool)
    .await?;

    let processing_records = sqlx::query_as!(
        ProcessingRecord,
        r#"SELECT
            id as 'id: uuid::Uuid',
            case_id as 'case_id: uuid::Uuid',
            stage as 'stage: ProcessingStage',
            action,
            from_status as 'from_status: CaseStatus',
            to_status as 'to_status: CaseStatus',
            handler_id as 'handler_id: uuid::Uuid',
            handler_name,
            handler_role as 'handler_role: Role',
            remarks,
            created_at as 'created_at: chrono::DateTime<chrono::Utc>'
        FROM processing_records WHERE case_id = ? ORDER BY created_at ASC"#,
        case_id.to_string()
    )
    .fetch_all(pool)
    .await?;

    let audit_notes = sqlx::query_as!(
        AuditNote,
        r#"SELECT
            id as 'id: uuid::Uuid',
            case_id as 'case_id: uuid::Uuid',
            note, anomaly_reason,
            noted_by as 'noted_by: uuid::Uuid',
            noted_by_name,
            noted_at as 'noted_at: chrono::DateTime<chrono::Utc>'
        FROM audit_notes WHERE case_id = ? ORDER BY noted_at DESC"#,
        case_id.to_string()
    )
    .fetch_all(pool)
    .await?;

    Ok(CaseWithDetail {
        case,
        expiry_status,
        attachments,
        processing_records,
        audit_notes,
    })
}

pub async fn list_cases(
    pool: &SqlitePool,
    status: Option<CaseStatus>,
    stage: Option<ProcessingStage>,
    expiry: Option<ExpiryStatus>,
    keyword: Option<String>,
    page: i64,
    page_size: i64,
) -> Result<PaginatedResponse<CaseWithDetail>, AppError> {
    let mut sql = "SELECT id FROM cases WHERE 1=1".to_string();
    let mut count_sql = "SELECT COUNT(*) FROM cases WHERE 1=1".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(s) = status {
        sql.push_str(" AND status = ?");
        count_sql.push_str(" AND status = ?");
        params.push(s.as_str().to_string());
    }

    if let Some(st) = stage {
        sql.push_str(" AND current_stage = ?");
        count_sql.push_str(" AND current_stage = ?");
        params.push(st.as_str().to_string());
    }

    if let Some(kw) = keyword {
        let like = format!("%{}%", kw);
        sql.push_str(" AND (title LIKE ? OR case_number LIKE ? OR reporter_name LIKE ?)");
        count_sql.push_str(" AND (title LIKE ? OR case_number LIKE ? OR reporter_name LIKE ?)");
        params.push(like.clone());
        params.push(like.clone());
        params.push(like);
    }

    sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let mut count_params = params.clone();

    let mut query = sqlx::query_scalar::<_, String>(&sql);
    for p in &params {
        query = query.bind(p);
    }
    query = query.bind(page_size).bind((page - 1) * page_size);

    let ids: Vec<String> = query.fetch_all(pool).await?;

    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
    for p in &count_params {
        count_query = count_query.bind(p);
    }
    let total: i64 = count_query.fetch_one(pool).await?;

    let mut items = Vec::new();
    for id_str in ids {
        let case_id = Uuid::parse_str(&id_str)
            .map_err(|e| AppError::Internal(format!("ID解析错误: {}", e)))?;
        let mut detail = get_case_detail(pool, case_id).await?;

        if let Some(expiry_filter) = expiry {
            if detail.expiry_status != expiry_filter {
                continue;
            }
        }
        items.push(detail);
    }

    if let Some(expiry_filter) = expiry {
        let filtered_total = items.len() as i64;
        Ok(PaginatedResponse {
            items,
            total: filtered_total,
            page,
            page_size,
        })
    } else {
        Ok(PaginatedResponse {
            items,
            total,
            page,
            page_size,
        })
    }
}

pub async fn create_case(
    pool: &SqlitePool,
    req: CreateCaseRequest,
    user: &User,
) -> Result<Case, AppError> {
    let case_id = Uuid::new_v4();
    let case_number = format!(
        "JQ{}{:04}",
        Utc::now().format("%Y%m"),
        (sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM cases")
            .fetch_one(pool)
            .await?
            + 1) as u32
    );

    let now = Utc::now();

    sqlx::query!(
        r#"INSERT INTO cases (
            id, case_number, title, description, case_type, location,
            reporter_name, reporter_phone, status, current_stage,
            registration_materials_complete, dispatch_timeline_met, followup_evidence_complete,
            deadline, version, created_by, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, ?, 1, ?, ?, ?, ?)"#,
        case_id.to_string(),
        case_number,
        req.title,
        req.description,
        req.case_type,
        req.location,
        req.reporter_name,
        req.reporter_phone,
        CaseStatus::UnderReview.as_str(),
        ProcessingStage::Registration.as_str(),
        req.deadline.to_rfc3339(),
        user.id.to_string(),
        user.real_name,
        now.to_rfc3339(),
        now.to_rfc3339()
    )
    .execute(pool)
    .await?;

    let record_id = Uuid::new_v4();
    sqlx::query!(
        r#"INSERT INTO processing_records (
            id, case_id, stage, action, from_status, to_status,
            handler_id, handler_name, handler_role, remarks, created_at
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)"#,
        record_id.to_string(),
        case_id.to_string(),
        ProcessingStage::Registration.as_str(),
        "接警登记",
        CaseStatus::UnderReview.as_str(),
        user.id.to_string(),
        user.real_name,
        user.role.as_str(),
        "新建警情登记",
        now.to_rfc3339()
    )
    .execute(pool)
    .await?;

    get_case_by_id(pool, case_id).await
}

pub async fn update_case_status(
    pool: &SqlitePool,
    req: UpdateStatusRequest,
    user: &User,
) -> Result<CaseWithDetail, AppError> {
    let mut case = get_case_by_id(pool, req.case_id).await?;

    validate_version(&case, req.version)?;
    validate_handler_assignment(&case, user)?;

    let (action_stage, action_name) = validate_status_transition(&case, req.to_status, user)?;

    let mut updated_case = case.clone();
    if let Some(reg) = req.registration_materials_complete {
        updated_case.registration_materials_complete = reg;
    }
    if let Some(dispatch) = req.dispatch_timeline_met {
        updated_case.dispatch_timeline_met = dispatch;
    }
    if let Some(followup) = req.followup_evidence_complete {
        updated_case.followup_evidence_complete = followup;
    }

    if req.to_status == CaseStatus::Completed
        || (req.to_status == CaseStatus::UnderReview && case.current_stage == ProcessingStage::Dispatch)
    {
        validate_case_evidence(&updated_case, req.to_status)?;
    }

    let next_stage = determine_next_stage(req.to_status, case.current_stage);

    let (handler_id, handler_name) = match req.to_status {
        CaseStatus::PendingCorrection => (None, None),
        CaseStatus::UnderReview => match next_stage {
            ProcessingStage::Dispatch => {
                let officer = sqlx::query_as!(
                    User,
                    r#"SELECT id as 'id: uuid::Uuid', username, real_name,
                       role as 'role: Role', password_hash,
                       created_at as 'created_at: chrono::DateTime<chrono::Utc>',
                       updated_at as 'updated_at: chrono::DateTime<chrono::Utc>'
                       FROM users WHERE role = 'police_officer' LIMIT 1"#
                )
                .fetch_one(pool)
                .await
                .ok();
                (
                    officer.as_ref().map(|u| u.id),
                    officer.as_ref().map(|u| u.real_name.clone()),
                )
            }
            ProcessingStage::Review => {
                let reviewer = sqlx::query_as!(
                    User,
                    r#"SELECT id as 'id: uuid::Uuid', username, real_name,
                       role as 'role: Role', password_hash,
                       created_at as 'created_at: chrono::DateTime<chrono::Utc>',
                       updated_at as 'updated_at: chrono::DateTime<chrono::Utc>'
                       FROM users WHERE role = 'reviewer' LIMIT 1"#
                )
                .fetch_one(pool)
                .await
                .ok();
                (
                    reviewer.as_ref().map(|u| u.id),
                    reviewer.as_ref().map(|u| u.real_name.clone()),
                )
            }
            _ => (None, None),
        },
        CaseStatus::Completed => (None, None),
    };

    let now = Utc::now();
    let completed_at = if req.to_status == CaseStatus::Completed {
        Some(now)
    } else {
        None
    };

    sqlx::query!(
        r#"UPDATE cases SET
            status = ?,
            current_stage = ?,
            current_handler_id = ?,
            current_handler_name = ?,
            registration_materials_complete = ?,
            dispatch_timeline_met = ?,
            followup_evidence_complete = ?,
            version = version + 1,
            updated_at = ?,
            completed_at = ?
        WHERE id = ?"#,
        req.to_status.as_str(),
        next_stage.as_str(),
        handler_id.map(|id| id.to_string()),
        handler_name,
        updated_case.registration_materials_complete as i32,
        updated_case.dispatch_timeline_met as i32,
        updated_case.followup_evidence_complete as i32,
        now.to_rfc3339(),
        completed_at.map(|dt| dt.to_rfc3339()),
        case.id.to_string()
    )
    .execute(pool)
    .await?;

    let record_id = Uuid::new_v4();
    sqlx::query!(
        r#"INSERT INTO processing_records (
            id, case_id, stage, action, from_status, to_status,
            handler_id, handler_name, handler_role, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        record_id.to_string(),
        case.id.to_string(),
        action_stage.as_str(),
        action_name,
        Some(case.status.as_str()),
        req.to_status.as_str(),
        user.id.to_string(),
        user.real_name,
        user.role.as_str(),
        req.remarks,
        now.to_rfc3339()
    )
    .execute(pool)
    .await?;

    get_case_detail(pool, req.case_id).await
}

pub async fn batch_process_cases(
    pool: &SqlitePool,
    case_ids: Vec<Uuid>,
    to_status: CaseStatus,
    remarks: String,
    version_map: std::collections::HashMap<String, i64>,
    user: &User,
) -> Result<Vec<BatchProcessResult>, AppError> {
    let mut results = Vec::new();
    let mut cases = Vec::new();

    for case_id in &case_ids {
        match get_case_by_id(pool, *case_id).await {
            Ok(case) => cases.push(case),
            Err(e) => results.push(BatchProcessResult {
                case_id: *case_id,
                case_number: "未知".into(),
                success: false,
                message: format!("获取案件信息失败: {}", e),
                error_details: Some(vec![e.to_string()]),
            }),
        }
    }

    validate_batch_permission(&cases, to_status, user)?;

    for case in cases {
        let expected_version = version_map.get(&case.id.to_string()).copied().unwrap_or(1);

        let mut errors: Vec<String> = Vec::new();

        if let Err(e) = validate_version(&case, expected_version) {
            errors.push(e.to_string());
        }

        if let Err(e) = validate_handler_assignment(&case, user) {
            errors.push(e.to_string());
        }

        let transition_result = validate_status_transition(&case, to_status, user);
        if let Err(e) = transition_result {
            errors.push(e.to_string());
        }

        let expiry_status = calculate_expiry_status(&case);
        if expiry_status == ExpiryStatus::Overdue && to_status == CaseStatus::Completed {
            errors.push(format!(
                "案件已逾期{}天，请先到详情页进行补正动作并说明逾期原因",
                -get_expiry_days(&case)
            ));
        }

        if to_status == CaseStatus::Completed || to_status == CaseStatus::UnderReview {
            if !case.registration_materials_complete {
                errors.push("警情登记材料不齐全".into());
            }
        }
        if to_status == CaseStatus::Completed {
            if !case.dispatch_timeline_met {
                errors.push("处置派警时限未达标".into());
            }
            if !case.followup_evidence_complete {
                errors.push("回访确认证据不完整".into());
            }
        }

        if !errors.is_empty() {
            results.push(BatchProcessResult {
                case_id: case.id,
                case_number: case.case_number.clone(),
                success: false,
                message: "校验失败，无法批量处理".into(),
                error_details: Some(errors),
            });
            continue;
        }

        let transition = transition_result.unwrap();
        let next_stage = determine_next_stage(to_status, case.current_stage);

        let now = Utc::now();
        let completed_at = if to_status == CaseStatus::Completed {
            Some(now)
        } else {
            None
        };

        let update_result = sqlx::query!(
            r#"UPDATE cases SET
                status = ?,
                current_stage = ?,
                version = version + 1,
                updated_at = ?,
                completed_at = ?
            WHERE id = ? AND version = ?"#,
            to_status.as_str(),
            next_stage.as_str(),
            now.to_rfc3339(),
            completed_at.map(|dt| dt.to_rfc3339()),
            case.id.to_string(),
            expected_version
        )
        .execute(pool)
        .await;

        match update_result {
            Ok(result) => {
                if result.rows_affected() == 0 {
                    results.push(BatchProcessResult {
                        case_id: case.id,
                        case_number: case.case_number,
                        success: false,
                        message: "版本冲突，案件已被他人修改".into(),
                        error_details: Some(vec!["请刷新页面后重试".into()]),
                    });
                } else {
                    let record_id = Uuid::new_v4();
                    sqlx::query!(
                        r#"INSERT INTO processing_records (
                            id, case_id, stage, action, from_status, to_status,
                            handler_id, handler_name, handler_role, remarks, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
                        record_id.to_string(),
                        case.id.to_string(),
                        transition.0.as_str(),
                        transition.1,
                        Some(case.status.as_str()),
                        to_status.as_str(),
                        user.id.to_string(),
                        user.real_name,
                        user.role.as_str(),
                        &remarks,
                        now.to_rfc3339()
                    )
                    .execute(pool)
                    .await
                    .ok();

                    results.push(BatchProcessResult {
                        case_id: case.id,
                        case_number: case.case_number,
                        success: true,
                        message: format!("状态已变更为{}", to_status.display_name()),
                        error_details: None,
                    });
                }
            }
            Err(e) => {
                results.push(BatchProcessResult {
                    case_id: case.id,
                    case_number: case.case_number,
                    success: false,
                    message: format!("更新失败: {}", e),
                    error_details: Some(vec![e.to_string()]),
                });
            }
        }
    }

    Ok(results)
}

pub async fn add_attachment(
    pool: &SqlitePool,
    case_id: Uuid,
    file_name: String,
    file_type: String,
    file_size: i64,
    category: String,
    user: &User,
) -> Result<Attachment, AppError> {
    let attach_id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query!(
        r#"INSERT INTO attachments (
            id, case_id, file_name, file_type, file_size, category,
            uploaded_by, uploaded_by_name, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        attach_id.to_string(),
        case_id.to_string(),
        file_name,
        file_type,
        file_size,
        category,
        user.id.to_string(),
        user.real_name,
        now.to_rfc3339()
    )
    .execute(pool)
    .await?;

    sqlx::query_as!(
        Attachment,
        r#"SELECT
            id as 'id: uuid::Uuid',
            case_id as 'case_id: uuid::Uuid',
            file_name, file_type, file_size, category,
            uploaded_by as 'uploaded_by: uuid::Uuid',
            uploaded_by_name,
            uploaded_at as 'uploaded_at: chrono::DateTime<chrono::Utc>'
        FROM attachments WHERE id = ?"#,
        attach_id.to_string()
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn add_audit_note(
    pool: &SqlitePool,
    case_id: Uuid,
    note: String,
    anomaly_reason: Option<String>,
    user: &User,
) -> Result<AuditNote, AppError> {
    let note_id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query!(
        r#"INSERT INTO audit_notes (
            id, case_id, note, anomaly_reason, noted_by, noted_by_name, noted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)"#,
        note_id.to_string(),
        case_id.to_string(),
        note,
        anomaly_reason,
        user.id.to_string(),
        user.real_name,
        now.to_rfc3339()
    )
    .execute(pool)
    .await?;

    sqlx::query_as!(
        AuditNote,
        r#"SELECT
            id as 'id: uuid::Uuid',
            case_id as 'case_id: uuid::Uuid',
            note, anomaly_reason,
            noted_by as 'noted_by: uuid::Uuid',
            noted_by_name,
            noted_at as 'noted_at: chrono::DateTime<chrono::Utc>'
        FROM audit_notes WHERE id = ?"#,
        note_id.to_string()
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn get_processing_records(
    pool: &SqlitePool,
    case_id: Uuid,
) -> Result<Vec<ProcessingRecord>, AppError> {
    sqlx::query_as!(
        ProcessingRecord,
        r#"SELECT
            id as 'id: uuid::Uuid',
            case_id as 'case_id: uuid::Uuid',
            stage as 'stage: ProcessingStage',
            action,
            from_status as 'from_status: CaseStatus',
            to_status as 'to_status: CaseStatus',
            handler_id as 'handler_id: uuid::Uuid',
            handler_name,
            handler_role as 'handler_role: Role',
            remarks,
            created_at as 'created_at: chrono::DateTime<chrono::Utc>'
        FROM processing_records WHERE case_id = ? ORDER BY created_at ASC"#,
        case_id.to_string()
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

pub async fn get_expiring_cases(pool: &SqlitePool) -> Result<serde_json::Value, AppError> {
    let now = Utc::now();
    let two_days_later = now + chrono::Duration::days(2);

    let normal: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM cases WHERE status != 'completed' AND deadline > ?",
    )
    .bind(two_days_later.to_rfc3339())
    .fetch_one(pool)
    .await?;

    let nearing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM cases WHERE status != 'completed' AND deadline <= ? AND deadline > ?",
    )
    .bind(two_days_later.to_rfc3339())
    .bind(now.to_rfc3339())
    .fetch_one(pool)
    .await?;

    let overdue: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM cases WHERE status != 'completed' AND deadline <= ?",
    )
    .bind(now.to_rfc3339())
    .fetch_one(pool)
    .await?;

    let overdue_by_officer: Vec<serde_json::Value> = sqlx::query!(
        r#"SELECT
            current_handler_name as handler_name,
            COUNT(*) as count
        FROM cases
        WHERE status != 'completed' AND deadline <= ? AND current_handler_name IS NOT NULL
        GROUP BY current_handler_name
        ORDER BY count DESC"#,
        now.to_rfc3339()
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| {
        serde_json::json!({
            "handler_name": r.handler_name,
            "count": r.count
        })
    })
    .collect();

    Ok(serde_json::json!({
        "normal": normal,
        "nearing_expiry": nearing,
        "overdue": overdue,
        "overdue_by_officer": overdue_by_officer
    }))
}

pub async fn get_statistics(pool: &SqlitePool) -> Result<StatisticsResponse, AppError> {
    let now = Utc::now();
    let two_days_later = now + chrono::Duration::days(2);

    let total_cases: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cases")
        .fetch_one(pool)
        .await?;

    let pending_correction: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM cases WHERE status = 'pending_correction'")
            .fetch_one(pool)
            .await?;

    let under_review: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM cases WHERE status = 'under_review'")
            .fetch_one(pool)
            .await?;

    let completed: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cases WHERE status = 'completed'")
        .fetch_one(pool)
        .await?;

    let normal: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM cases WHERE status != 'completed' AND deadline > ?",
    )
    .bind(two_days_later.to_rfc3339())
    .fetch_one(pool)
    .await?;

    let nearing_expiry: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM cases WHERE status != 'completed' AND deadline <= ? AND deadline > ?",
    )
    .bind(two_days_later.to_rfc3339())
    .bind(now.to_rfc3339())
    .fetch_one(pool)
    .await?;

    let overdue: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM cases WHERE status != 'completed' AND deadline <= ?",
    )
    .bind(now.to_rfc3339())
    .fetch_one(pool)
    .await?;

    let by_stage_registration: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM cases WHERE current_stage = 'registration'")
            .fetch_one(pool)
            .await?;

    let by_stage_dispatch: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM cases WHERE current_stage = 'dispatch'")
            .fetch_one(pool)
            .await?;

    let by_stage_review: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM cases WHERE current_stage = 'review'")
            .fetch_one(pool)
            .await?;

    Ok(StatisticsResponse {
        total_cases,
        pending_correction,
        under_review,
        completed,
        normal,
        nearing_expiry,
        overdue,
        by_stage_registration,
        by_stage_dispatch,
        by_stage_review,
    })
}
