use crate::models::*;
use crate::db::DbPool;
use anyhow::{Result, anyhow, bail};
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use sqlx::FromRow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub task_name: String,
    pub order_no: String,
    pub style_no: Option<String>,
    pub priority: String,
    pub deadline: DateTime<Utc>,
    pub responsible_person: String,
    pub created_by: String,
    pub operator_role: String,
    pub initial_evidence: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ProcessTaskRequest {
    pub task_id: String,
    pub action: String,
    pub operator_role: String,
    pub operator_name: String,
    pub opinion: Option<String>,
    pub result: Option<String>,
    pub return_reason: Option<String>,
    pub audit_note: Option<String>,
    pub version: i32,
    pub new_handler: Option<String>,
    pub new_deadline: Option<DateTime<Utc>>,
    pub has_mass_production_evidence: Option<bool>,
    pub evidence_note: Option<String>,
    pub abnormal_tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct BatchProcessRequest {
    pub task_ids: Vec<String>,
    pub action: String,
    pub operator_role: String,
    pub operator_name: String,
    pub opinion: Option<String>,
    pub version_map: Option<std::collections::HashMap<String, i32>>,
}

#[derive(Debug, Serialize)]
pub struct BatchResultItem {
    pub task_id: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct TaskListResponse {
    pub tasks: Vec<SamplingTask>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Deserialize)]
pub struct TaskQueryParams {
    pub status: Option<String>,
    pub role: Option<String>,
    pub handler: Option<String>,
    pub priority: Option<String>,
    pub keyword: Option<String>,
    pub overdue_status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub show_pending_assignment: Option<bool>,
    pub show_transferred: Option<bool>,
    pub show_visited: Option<bool>,
}

pub struct TaskService;

impl TaskService {
    fn validate_role(role: &str) -> Result<()> {
        match role {
            roles::SAMPLING_REGISTRAR | roles::SAMPLING_SUPERVISOR | roles::FACTORY_REVIEWER => Ok(()),
            _ => bail!("无效的角色: {}", role),
        }
    }

    fn can_view_task(role: &str, task: &SamplingTask) -> bool {
        match role {
            roles::SAMPLING_REGISTRAR => true,
            roles::SAMPLING_SUPERVISOR => {
                task.status == statuses::PENDING_ASSIGNMENT
                    || task.status == statuses::ASSIGNED
                    || task.status == statuses::PENDING_REVIEW
                    || task.status == statuses::RETURNED
                    || task.current_handler == role
            }
            roles::FACTORY_REVIEWER => {
                task.status == statuses::PENDING_VERIFICATION
                    || task.status == statuses::REVIEWED
                    || task.status == statuses::VERIFIED
                    || task.status == statuses::ARCHIVED
                    || task.current_handler == role
            }
            _ => false,
        }
    }

    fn can_act_on_task(role: &str, action: &str, task: &SamplingTask) -> Result<()> {
        match action {
            "assign" => {
                if role != roles::SAMPLING_SUPERVISOR {
                    bail!("只有打样审核主管可以分派任务");
                }
                if task.status != statuses::PENDING_ASSIGNMENT && task.status != statuses::RETURNED {
                    bail!("当前状态不支持分派操作");
                }
            }
            "review" => {
                if role != roles::SAMPLING_SUPERVISOR {
                    bail!("只有打样审核主管可以审核任务");
                }
                if task.status != statuses::ASSIGNED && task.status != statuses::PENDING_REVIEW {
                    bail!("当前状态不支持审核操作");
                }
            }
            "return" => {
                if role != roles::SAMPLING_SUPERVISOR && role != roles::FACTORY_REVIEWER {
                    bail!("只有审核主管或复核负责人可以退回任务");
                }
                if task.status == statuses::ARCHIVED {
                    bail!("已归档任务不能退回");
                }
            }
            "verify" => {
                if role != roles::FACTORY_REVIEWER {
                    bail!("只有加工厂复核负责人可以复核任务");
                }
                if task.status != statuses::REVIEWED && task.status != statuses::PENDING_VERIFICATION {
                    bail!("当前状态不支持复核操作");
                }
            }
            "archive" => {
                if role != roles::FACTORY_REVIEWER {
                    bail!("只有加工厂复核负责人可以归档任务");
                }
                if task.status != statuses::VERIFIED && task.status != statuses::PENDING_VERIFICATION {
                    bail!("当前状态不支持归档操作，请先完成复核");
                }
            }
            "rectify" => {
                if role != roles::SAMPLING_REGISTRAR {
                    bail!("只有打样登记员可以补正任务");
                }
                if task.status != statuses::RETURNED {
                    bail!("只有退回状态可以补正");
                }
            }
            "reassign" => {
                if role != roles::SAMPLING_SUPERVISOR {
                    bail!("只有打样审核主管可以转办任务");
                }
            }
            "add_evidence" => {
                if role != roles::SAMPLING_REGISTRAR && role != roles::SAMPLING_SUPERVISOR {
                    bail!("只有登记员或审核主管可以补充证据");
                }
            }
            _ => bail!("未知操作: {}", action),
        }
        Ok(())
    }

    fn check_evidence_requirement(action: &str, task: &SamplingTask, req: &ProcessTaskRequest) -> Result<()> {
        if action == "archive" || action == "verify" {
            let has_evidence = req.has_mass_production_evidence.unwrap_or(task.has_mass_production_evidence);
            if !has_evidence {
                bail!("缺少大货排产证据，无法完成归档/复核，请先补充证据");
            }
        }
        Ok(())
    }

    fn check_version(task_version: i32, req_version: i32) -> Result<()> {
        if task_version != req_version {
            bail!(
                "版本冲突：当前版本为 {}，您提交的版本为 {}，请刷新后重试",
                task_version,
                req_version
            );
        }
        Ok(())
    }

    fn check_deadline(deadline: DateTime<Utc>) -> bool {
        deadline < Utc::now()
    }

    fn get_overdue_status(deadline: DateTime<Utc>) -> String {
        let now = Utc::now();
        if deadline < now {
            "overdue".to_string()
        } else if deadline - now <= Duration::hours(24) {
            "warning".to_string()
        } else {
            "normal".to_string()
        }
    }

    pub async fn create_task(pool: &DbPool, req: CreateTaskRequest) -> Result<SamplingTask> {
        Self::validate_role(&req.operator_role)?;

        if req.operator_role != roles::SAMPLING_REGISTRAR {
            bail!("只有打样登记员可以发起打样任务");
        }

        let task_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let is_overdue = Self::check_deadline(req.deadline);

        let abnormal_tags = if is_overdue {
            vec!["逾期".to_string()]
        } else {
            vec![]
        };

        let task = SamplingTask {
            id: task_id.clone(),
            task_name: req.task_name,
            order_no: req.order_no,
            style_no: req.style_no,
            priority: req.priority,
            status: statuses::PENDING_ASSIGNMENT.to_string(),
            current_handler: roles::SAMPLING_SUPERVISOR.to_string(),
            responsible_person: req.responsible_person,
            deadline: req.deadline,
            sample_confirmation_status: Some("pending".to_string()),
            mass_production_evidence: if req.initial_evidence.unwrap_or(false) {
                Some("provided".to_string())
            } else {
                Some("missing".to_string())
            },
            has_mass_production_evidence: req.initial_evidence.unwrap_or(false),
            version: 1,
            created_at: now,
            updated_at: now,
            created_by: req.created_by.clone(),
            last_updated_by: req.created_by.clone(),
            is_overdue,
            overdue_reason: if is_overdue {
                Some("任务创建时已逾期".to_string())
            } else {
                None
            },
            return_reason: None,
            abnormal_tags: Some(serde_json::to_string(&abnormal_tags)?),
        };

        sqlx::query(
            r#"
            INSERT INTO sampling_tasks (
                id, task_name, order_no, style_no, priority, status, current_handler,
                responsible_person, deadline, sample_confirmation_status, mass_production_evidence,
                has_mass_production_evidence, version, created_at, updated_at, created_by,
                last_updated_by, is_overdue, overdue_reason, return_reason, abnormal_tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&task.id)
        .bind(&task.task_name)
        .bind(&task.order_no)
        .bind(&task.style_no)
        .bind(&task.priority)
        .bind(&task.status)
        .bind(&task.current_handler)
        .bind(&task.responsible_person)
        .bind(task.deadline)
        .bind(&task.sample_confirmation_status)
        .bind(&task.mass_production_evidence)
        .bind(task.has_mass_production_evidence)
        .bind(task.version)
        .bind(task.created_at)
        .bind(task.updated_at)
        .bind(&task.created_by)
        .bind(&task.last_updated_by)
        .bind(task.is_overdue)
        .bind(&task.overdue_reason)
        .bind(&task.return_reason)
        .bind(&task.abnormal_tags)
        .execute(pool)
        .await?;

        Self::add_processing_record(
            pool,
            &task_id,
            "create",
            None,
            Some(statuses::PENDING_ASSIGNMENT.to_string()),
            &req.operator_role,
            &req.created_by,
            None,
            Some(roles::SAMPLING_SUPERVISOR.to_string()),
            Some("打样任务已创建，待分派".to_string()),
            None,
            1,
        ).await?;

        Ok(task)
    }

    pub async fn get_task(pool: &DbPool, task_id: &str, role: &str) -> Result<SamplingTask> {
        Self::validate_role(role)?;

        let task: SamplingTask = sqlx::query_as::<_, SamplingTask>(
            "SELECT * FROM sampling_tasks WHERE id = ?"
        )
        .bind(task_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| anyhow!("任务不存在"))?;

        if !Self::can_view_task(role, &task) {
            bail!("权限不足，无法查看该任务");
        }

        Ok(task)
    }

    pub async fn list_tasks(pool: &DbPool, params: TaskQueryParams) -> Result<TaskListResponse> {
        let role = params.role.as_deref().unwrap_or(roles::SAMPLING_REGISTRAR);
        Self::validate_role(role)?;

        let page = params.page.unwrap_or(1);
        let page_size = params.page_size.unwrap_or(20);
        let offset = (page - 1) * page_size;

        let mut conditions: Vec<String> = vec![];
        let mut binds: Vec<String> = vec![];

        if let Some(status) = &params.status {
            conditions.push("status = ?".to_string());
            binds.push(status.clone());
        }

        if let Some(handler) = &params.handler {
            conditions.push("current_handler = ?".to_string());
            binds.push(handler.clone());
        }

        if let Some(priority) = &params.priority {
            conditions.push("priority = ?".to_string());
            binds.push(priority.clone());
        }

        if let Some(keyword) = &params.keyword {
            conditions.push("(task_name LIKE ? OR order_no LIKE ?)".to_string());
            binds.push(format!("%{}%", keyword));
            binds.push(format!("%{}%", keyword));
        }

        if let Some(overdue_status) = &params.overdue_status {
            match overdue_status.as_str() {
                "overdue" => {
                    conditions.push("is_overdue = 1".to_string());
                }
                "warning" => {
                    conditions.push("is_overdue = 0 AND deadline <= datetime('now', '+1 day')".to_string());
                }
                "normal" => {
                    conditions.push("is_overdue = 0 AND deadline > datetime('now', '+1 day')".to_string());
                }
                _ => {}
            }
        }

        if role == roles::SAMPLING_REGISTRAR {
        } else if role == roles::SAMPLING_SUPERVISOR {
            conditions.push(
                "(status IN (?, ?, ?, ?) OR current_handler = ?)".to_string()
            );
            binds.push(statuses::PENDING_ASSIGNMENT.to_string());
            binds.push(statuses::ASSIGNED.to_string());
            binds.push(statuses::PENDING_REVIEW.to_string());
            binds.push(statuses::RETURNED.to_string());
            binds.push(role.to_string());
        } else if role == roles::FACTORY_REVIEWER {
            conditions.push(
                "(status IN (?, ?, ?, ?) OR current_handler = ?)".to_string()
            );
            binds.push(statuses::PENDING_VERIFICATION.to_string());
            binds.push(statuses::REVIEWED.to_string());
            binds.push(statuses::VERIFIED.to_string());
            binds.push(statuses::ARCHIVED.to_string());
            binds.push(role.to_string());
        }

        let where_clause = if conditions.is_empty() {
            "".to_string()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!(
            "SELECT COUNT(*) as count FROM sampling_tasks {}",
            where_clause
        );

        let mut count_query = sqlx::query_as::<_, (i64,)>(&count_sql);
        for bind in &binds {
            count_query = count_query.bind(bind);
        }

        let (total,): (i64,) = count_query.fetch_one(pool).await?;

        let query_sql = format!(
            "SELECT * FROM sampling_tasks {} ORDER BY priority DESC, deadline ASC, created_at DESC LIMIT ? OFFSET ?",
            where_clause
        );

        let mut query = sqlx::query_as::<_, SamplingTask>(&query_sql);
        for bind in &binds {
            query = query.bind(bind);
        }
        query = query.bind(page_size);
        query = query.bind(offset);

        let tasks: Vec<SamplingTask> = query.fetch_all(pool).await?;

        Ok(TaskListResponse {
            tasks,
            total,
            page,
            page_size,
        })
    }

    pub async fn process_task(pool: &DbPool, req: ProcessTaskRequest) -> Result<SamplingTask> {
        Self::validate_role(&req.operator_role)?;

        let mut task = Self::get_task(pool, &req.task_id, &req.operator_role).await?;

        Self::can_act_on_task(&req.operator_role, &req.action, &task)?;

        Self::check_version(task.version, req.version)?;

        Self::check_evidence_requirement(&req.action, &task, &req)?;

        let from_status = task.status.clone();
        let handler_before = task.current_handler.clone();
        let new_version = task.version + 1;
        let now = Utc::now();

        match req.action.as_str() {
            "assign" => {
                task.status = statuses::ASSIGNED.to_string();
                task.current_handler = req.new_handler.clone().unwrap_or_else(|| roles::SAMPLING_SUPERVISOR.to_string());
                task.sample_confirmation_status = Some("in_progress".to_string());
            }
            "review" => {
                task.status = statuses::REVIEWED.to_string();
                task.current_handler = roles::FACTORY_REVIEWER.to_string();
                task.sample_confirmation_status = Some("confirmed".to_string());
            }
            "verify" => {
                task.status = statuses::VERIFIED.to_string();
                task.current_handler = roles::FACTORY_REVIEWER.to_string();
                if let Some(has_evidence) = req.has_mass_production_evidence {
                    task.has_mass_production_evidence = has_evidence;
                    task.mass_production_evidence = if has_evidence {
                        Some("verified".to_string())
                    } else {
                        Some("missing".to_string())
                    };
                }
            }
            "archive" => {
                task.status = statuses::ARCHIVED.to_string();
                task.current_handler = "system".to_string();
                task.sample_confirmation_status = Some("completed".to_string());
                task.mass_production_evidence = Some("verified".to_string());
                task.has_mass_production_evidence = true;
            }
            "return" => {
                task.status = statuses::RETURNED.to_string();
                task.current_handler = roles::SAMPLING_REGISTRAR.to_string();
                task.return_reason = req.return_reason.clone();
                let mut tags: Vec<String> = serde_json::from_str(&task.abnormal_tags.clone().unwrap_or_else(|| "[]".to_string()))
                    .unwrap_or_default();
                if !tags.contains(&"退回".to_string()) {
                    tags.push("退回".to_string());
                }
                task.abnormal_tags = Some(serde_json::to_string(&tags)?);
            }
            "rectify" => {
                task.status = statuses::PENDING_REVIEW.to_string();
                task.current_handler = roles::SAMPLING_SUPERVISOR.to_string();
                task.return_reason = None;
                let mut tags: Vec<String> = serde_json::from_str(&task.abnormal_tags.clone().unwrap_or_else(|| "[]".to_string()))
                    .unwrap_or_default();
                tags.retain(|t| t != "退回");
                task.abnormal_tags = Some(serde_json::to_string(&tags)?);

                if let Some(has_evidence) = req.has_mass_production_evidence {
                    task.has_mass_production_evidence = has_evidence;
                    task.mass_production_evidence = if has_evidence {
                        Some("provided".to_string())
                    } else {
                        Some("missing".to_string())
                    };
                }
            }
            "reassign" => {
                task.current_handler = req.new_handler.clone().unwrap_or_else(|| handler_before.clone());
            }
            "add_evidence" => {
                if let Some(has_evidence) = req.has_mass_production_evidence {
                    task.has_mass_production_evidence = has_evidence;
                    task.mass_production_evidence = if has_evidence {
                        Some("provided".to_string())
                    } else {
                        Some("missing".to_string())
                    };
                }
            }
            _ => bail!("不支持的操作: {}", req.action),
        }

        if let Some(new_deadline) = req.new_deadline {
            task.deadline = new_deadline;
            task.is_overdue = Self::check_deadline(new_deadline);
            if task.is_overdue {
                task.overdue_reason = Some("截止时间调整后已逾期".to_string());
            }
        }

        if let Some(tags) = req.abnormal_tags {
            task.abnormal_tags = Some(serde_json::to_string(&tags)?);
        }

        task.version = new_version;
        task.updated_at = now;
        task.last_updated_by = req.operator_name.clone();

        let handler_after = task.current_handler.clone();
        let to_status = Some(task.status.clone());

        sqlx::query(
            r#"
            UPDATE sampling_tasks SET
                status = ?, current_handler = ?, responsible_person = ?, deadline = ?,
                sample_confirmation_status = ?, mass_production_evidence = ?,
                has_mass_production_evidence = ?, version = ?, updated_at = ?,
                last_updated_by = ?, is_overdue = ?, overdue_reason = ?,
                return_reason = ?, abnormal_tags = ?
            WHERE id = ?
            "#
        )
        .bind(&task.status)
        .bind(&task.current_handler)
        .bind(&task.responsible_person)
        .bind(task.deadline)
        .bind(&task.sample_confirmation_status)
        .bind(&task.mass_production_evidence)
        .bind(task.has_mass_production_evidence)
        .bind(task.version)
        .bind(task.updated_at)
        .bind(&task.last_updated_by)
        .bind(task.is_overdue)
        .bind(&task.overdue_reason)
        .bind(&task.return_reason)
        .bind(&task.abnormal_tags)
        .bind(&task.id)
        .execute(pool)
        .await?;

        Self::add_processing_record(
            pool,
            &task.id,
            &req.action,
            Some(from_status),
            to_status,
            &req.operator_role,
            &req.operator_name,
            Some(handler_before),
            Some(handler_after),
            req.opinion.clone(),
            req.result.clone(),
            new_version,
        ).await?;

        if let Some(note) = req.audit_note {
            if !note.is_empty() {
                Self::add_audit_note(
                    pool,
                    &task.id,
                    &note,
                    &req.operator_role,
                    &req.operator_name,
                ).await?;
            }
        }

        if req.action == "return" {
            if let Some(reason) = req.return_reason.clone() {
                Self::add_abnormal_reason(
                    pool,
                    &task.id,
                    "return",
                    &reason,
                    &req.operator_role,
                    &req.operator_name,
                ).await?;
            }
        }

        Ok(task)
    }

    pub async fn batch_process(pool: &DbPool, req: BatchProcessRequest) -> Result<Vec<BatchResultItem>> {
        Self::validate_role(&req.operator_role)?;

        let mut results = vec![];

        for task_id in &req.task_ids {
            let version = req.version_map
                .as_ref()
                .and_then(|m| m.get(task_id))
                .copied()
                .unwrap_or(1);

            let process_req = ProcessTaskRequest {
                task_id: task_id.clone(),
                action: req.action.clone(),
                operator_role: req.operator_role.clone(),
                operator_name: req.operator_name.clone(),
                opinion: req.opinion.clone(),
                result: None,
                return_reason: None,
                audit_note: None,
                version,
                new_handler: None,
                new_deadline: None,
                has_mass_production_evidence: None,
                evidence_note: None,
                abnormal_tags: None,
            };

            match Self::process_task(pool, process_req).await {
                Ok(_) => {
                    results.push(BatchResultItem {
                        task_id: task_id.clone(),
                        success: true,
                        message: "操作成功".to_string(),
                    });
                }
                Err(e) => {
                    results.push(BatchResultItem {
                        task_id: task_id.clone(),
                        success: false,
                        message: e.to_string(),
                    });
                }
            }
        }

        Ok(results)
    }

    async fn add_processing_record(
        pool: &DbPool,
        task_id: &str,
        action: &str,
        from_status: Option<String>,
        to_status: Option<String>,
        operator_role: &str,
        operator_name: &str,
        handler_before: Option<String>,
        handler_after: Option<String>,
        opinion: Option<String>,
        result: Option<String>,
        version: i32,
    ) -> Result<()> {
        let record_id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO processing_records (
                id, task_id, action, from_status, to_status, operator_role,
                operator_name, handler_before, handler_after, opinion, result, created_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&record_id)
        .bind(task_id)
        .bind(action)
        .bind(from_status)
        .bind(to_status)
        .bind(operator_role)
        .bind(operator_name)
        .bind(handler_before)
        .bind(handler_after)
        .bind(opinion)
        .bind(result)
        .bind(Utc::now())
        .bind(version)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_processing_records(pool: &DbPool, task_id: &str, role: &str) -> Result<Vec<ProcessingRecord>> {
        Self::validate_role(role)?;

        let task = Self::get_task(pool, task_id, role).await?;

        let records: Vec<ProcessingRecord> = sqlx::query_as::<_, ProcessingRecord>(
            "SELECT * FROM processing_records WHERE task_id = ? ORDER BY created_at DESC, version DESC"
        )
        .bind(task_id)
        .fetch_all(pool)
        .await?;

        Ok(records)
    }

    async fn add_audit_note(
        pool: &DbPool,
        task_id: &str,
        note_content: &str,
        operator_role: &str,
        operator_name: &str,
    ) -> Result<()> {
        let note_id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO audit_notes (id, task_id, note_content, operator_role, operator_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&note_id)
        .bind(task_id)
        .bind(note_content)
        .bind(operator_role)
        .bind(operator_name)
        .bind(Utc::now())
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_audit_notes(pool: &DbPool, task_id: &str, role: &str) -> Result<Vec<AuditNote>> {
        Self::validate_role(role)?;

        let _ = Self::get_task(pool, task_id, role).await?;

        let notes: Vec<AuditNote> = sqlx::query_as::<_, AuditNote>(
            "SELECT * FROM audit_notes WHERE task_id = ? ORDER BY created_at DESC"
        )
        .bind(task_id)
        .fetch_all(pool)
        .await?;

        Ok(notes)
    }

    async fn add_abnormal_reason(
        pool: &DbPool,
        task_id: &str,
        reason_type: &str,
        description: &str,
        operator_role: &str,
        operator_name: &str,
    ) -> Result<()> {
        let reason_id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO abnormal_reasons (id, task_id, reason_type, description, operator_role, operator_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&reason_id)
        .bind(task_id)
        .bind(reason_type)
        .bind(description)
        .bind(operator_role)
        .bind(operator_name)
        .bind(Utc::now())
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn get_abnormal_reasons(pool: &DbPool, task_id: &str, role: &str) -> Result<Vec<AbnormalReason>> {
        Self::validate_role(role)?;

        let _ = Self::get_task(pool, task_id, role).await?;

        let reasons: Vec<AbnormalReason> = sqlx::query_as::<_, AbnormalReason>(
            "SELECT * FROM abnormal_reasons WHERE task_id = ? ORDER BY created_at DESC"
        )
        .bind(task_id)
        .fetch_all(pool)
        .await?;

        Ok(reasons)
    }

    pub async fn get_attachments(pool: &DbPool, task_id: &str, role: &str) -> Result<Vec<Attachment>> {
        Self::validate_role(role)?;

        let _ = Self::get_task(pool, task_id, role).await?;

        let attachments: Vec<Attachment> = sqlx::query_as::<_, Attachment>(
            "SELECT * FROM attachments WHERE task_id = ? ORDER BY uploaded_at DESC"
        )
        .bind(task_id)
        .fetch_all(pool)
        .await?;

        Ok(attachments)
    }

    pub async fn get_statistics(pool: &DbPool, role: &str) -> Result<serde_json::Value> {
        Self::validate_role(role)?;

        let mut all_tasks: Vec<SamplingTask> = vec![];
        let mut page = 1;
        let page_size = 100;

        loop {
            let response = Self::list_tasks(pool, TaskQueryParams {
                status: None,
                role: Some(role.to_string()),
                handler: None,
                priority: None,
                keyword: None,
                overdue_status: None,
                page: Some(page),
                page_size: Some(page_size),
                show_pending_assignment: None,
                show_transferred: None,
                show_visited: None,
            }).await?;

            all_tasks.extend(response.tasks);

            if (page * page_size) >= response.total {
                break;
            }
            page += 1;
        }

        let total = all_tasks.len();
        let pending_assignment = all_tasks.iter().filter(|t| t.status == statuses::PENDING_ASSIGNMENT).count();
        let pending_review = all_tasks.iter().filter(|t| t.status == statuses::PENDING_REVIEW || t.status == statuses::ASSIGNED).count();
        let pending_verification = all_tasks.iter().filter(|t| t.status == statuses::PENDING_VERIFICATION || t.status == statuses::REVIEWED).count();
        let verified = all_tasks.iter().filter(|t| t.status == statuses::VERIFIED).count();
        let archived = all_tasks.iter().filter(|t| t.status == statuses::ARCHIVED).count();
        let returned = all_tasks.iter().filter(|t| t.status == statuses::RETURNED).count();
        let overdue = all_tasks.iter().filter(|t| t.is_overdue).count();
        let normal = all_tasks.iter().filter(|t| !t.is_overdue && Self::get_overdue_status(t.deadline) == "normal").count();
        let warning = all_tasks.iter().filter(|t| !t.is_overdue && Self::get_overdue_status(t.deadline) == "warning").count();

        let stats = serde_json::json!({
            "total": total,
            "by_status": {
                "pending_assignment": pending_assignment,
                "pending_review": pending_review,
                "pending_verification": pending_verification,
                "verified": verified,
                "archived": archived,
                "returned": returned,
            },
            "by_overdue": {
                "normal": normal,
                "warning": warning,
                "overdue": overdue,
            }
        });

        Ok(stats)
    }

    pub async fn get_task_with_details(pool: &DbPool, task_id: &str, role: &str) -> Result<serde_json::Value> {
        let task = Self::get_task(pool, task_id, role).await?;
        let records = Self::get_processing_records(pool, task_id, role).await?;
        let audit_notes = Self::get_audit_notes(pool, task_id, role).await?;
        let attachments = Self::get_attachments(pool, task_id, role).await?;
        let abnormal_reasons = Self::get_abnormal_reasons(pool, task_id, role).await?;

        let result = serde_json::json!({
            "task": task,
            "processing_records": records,
            "audit_notes": audit_notes,
            "attachments": attachments,
            "abnormal_reasons": abnormal_reasons,
        });

        Ok(result)
    }
}
