use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    CaseAssignment, CaseFollowup, CaseQueue, CaseRegistration, CaseStatus, LegalCase, UserRole,
};
use chrono::{DateTime, Duration, Utc};
use rand::Rng;

pub fn check_version(current: i32, expected: i32) -> Result<()> {
    if current != expected {
        Err(AppError::VersionConflict {
            expected,
            actual: current,
        })
    } else {
        Ok(())
    }
}

pub fn check_registration_complete(reg: &CaseRegistration) -> (bool, Vec<String>) {
    let mut missing = Vec::new();

    if reg.client_name.as_ref().map_or(true, |s| s.trim().is_empty()) {
        missing.push("客户姓名".to_string());
    }
    if reg
        .client_phone
        .as_ref()
        .map_or(true, |s| s.trim().is_empty())
    {
        missing.push("联系电话".to_string());
    }
    if reg
        .client_id_card
        .as_ref()
        .map_or(true, |s| s.trim().is_empty())
    {
        missing.push("身份证号".to_string());
    }
    if reg
        .consultation_type
        .as_ref()
        .map_or(true, |s| s.trim().is_empty())
    {
        missing.push("咨询类型".to_string());
    }
    if reg
        .consultation_content
        .as_ref()
        .map_or(true, |s| s.trim().is_empty())
    {
        missing.push("咨询内容".to_string());
    }
    if reg.registered_by.is_none() {
        missing.push("登记人".to_string());
    }
    if reg.registered_at.is_none() {
        missing.push("登记时间".to_string());
    }

    (missing.is_empty(), missing)
}

pub fn check_assignment_complete(assign: &CaseAssignment) -> (bool, Vec<String>) {
    let mut missing = Vec::new();

    if assign.assistant_id.is_none() && assign.lawyer_id.is_none() {
        missing.push("至少需要指定协办助理或主办律师之一".to_string());
    }
    if assign
        .assignment_reason
        .as_ref()
        .map_or(true, |s| s.trim().is_empty())
    {
        missing.push("分派原因".to_string());
    }
    if assign.assigned_by.is_none() {
        missing.push("分派人".to_string());
    }
    if assign.assigned_at.is_none() {
        missing.push("分派时间".to_string());
    }

    (missing.is_empty(), missing)
}

pub fn check_followup_complete(followup: &CaseFollowup) -> (bool, Vec<String>) {
    let mut missing = Vec::new();

    if followup
        .followup_result
        .as_ref()
        .map_or(true, |s| s.trim().is_empty())
    {
        missing.push("回访结果".to_string());
    }
    if followup
        .client_satisfaction
        .as_ref()
        .map_or(true, |s| s.trim().is_empty())
    {
        missing.push("客户满意度".to_string());
    }
    if followup.followup_by.is_none() {
        missing.push("回访人".to_string());
    }
    if followup.followup_at.is_none() {
        missing.push("回访时间".to_string());
    }

    (missing.is_empty(), missing)
}

pub fn check_transition_prerequisites(
    db: &Database,
    case_id: i64,
    target_status: &CaseStatus,
) -> Result<()> {
    match target_status {
        CaseStatus::Submitted | CaseStatus::Reviewing => {
            let reg = get_registration(db, case_id)?;
            let (complete, missing) = check_registration_complete(&reg);
            if !complete {
                let reason = format!(
                    "咨询登记信息不完整，缺少: {}",
                    missing.join(", ")
                );
                record_exception(db, case_id, "incomplete_registration", &reason, Some("registration"), None)?;
                record_audit_note(db, case_id, Some("registration"), "incomplete_info", &reason, None)?;
                return Err(AppError::IncompleteInfo(reason));
            }
        }
        CaseStatus::Assigned => {
            let assign = get_assignment(db, case_id)?;
            let (complete, missing) = check_assignment_complete(&assign);
            if !complete {
                let reason = format!(
                    "案件分派信息不完整，缺少: {}",
                    missing.join(", ")
                );
                record_exception(db, case_id, "incomplete_assignment", &reason, Some("assignment"), None)?;
                record_audit_note(db, case_id, Some("assignment"), "incomplete_info", &reason, None)?;
                return Err(AppError::IncompleteInfo(reason));
            }
        }
        CaseStatus::Completed => {
            let followup = get_followup(db, case_id)?;
            let (complete, missing) = check_followup_complete(&followup);
            if !complete {
                let reason = format!(
                    "回访确认信息不完整，缺少: {}",
                    missing.join(", ")
                );
                record_exception(db, case_id, "incomplete_followup", &reason, Some("followup"), None)?;
                record_audit_note(db, case_id, Some("followup"), "incomplete_info", &reason, None)?;
                return Err(AppError::IncompleteInfo(reason));
            }
        }
        _ => {}
    }
    Ok(())
}

fn get_registration(db: &Database, case_id: i64) -> Result<CaseRegistration> {
    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, client_name, client_phone, client_id_card, consultation_type, 
         consultation_content, evidence_provided, registration_remark, registered_by, registered_at, 
         is_complete, created_at, updated_at FROM case_registration WHERE case_id = ?1",
    )?;
    let reg = stmt.query_row([case_id], |row| {
        Ok(CaseRegistration {
            id: row.get(0)?,
            case_id: row.get(1)?,
            client_name: row.get(2)?,
            client_phone: row.get(3)?,
            client_id_card: row.get(4)?,
            consultation_type: row.get(5)?,
            consultation_content: row.get(6)?,
            evidence_provided: row.get(7)?,
            registration_remark: row.get(8)?,
            registered_by: row.get(9)?,
            registered_at: row.get(10)?,
            is_complete: row.get(11)?,
            created_at: row.get(12)?,
            updated_at: row.get(13)?,
        })
    })?;
    Ok(reg)
}

fn get_assignment(db: &Database, case_id: i64) -> Result<CaseAssignment> {
    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, assistant_id, lawyer_id, assignment_reason, assignment_remark, 
         assigned_by, assigned_at, is_complete, created_at, updated_at FROM case_assignment WHERE case_id = ?1",
    )?;
    let assign = stmt.query_row([case_id], |row| {
        Ok(CaseAssignment {
            id: row.get(0)?,
            case_id: row.get(1)?,
            assistant_id: row.get(2)?,
            assistant_name: None,
            lawyer_id: row.get(3)?,
            lawyer_name: None,
            assignment_reason: row.get(4)?,
            assignment_remark: row.get(5)?,
            assigned_by: row.get(6)?,
            assigned_at: row.get(7)?,
            is_complete: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;
    Ok(assign)
}

fn get_followup(db: &Database, case_id: i64) -> Result<CaseFollowup> {
    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_id, followup_result, client_satisfaction, followup_remark, 
         followup_by, followup_at, is_complete, created_at, updated_at FROM case_followup WHERE case_id = ?1",
    )?;
    let followup = stmt.query_row([case_id], |row| {
        Ok(CaseFollowup {
            id: row.get(0)?,
            case_id: row.get(1)?,
            followup_result: row.get(2)?,
            client_satisfaction: row.get(3)?,
            followup_remark: row.get(4)?,
            followup_by: row.get(5)?,
            followup_at: row.get(6)?,
            is_complete: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;
    Ok(followup)
}

pub fn record_exception(
    db: &Database,
    case_id: i64,
    exception_type: &str,
    reason: &str,
    module: Option<&str>,
    operator_id: Option<i64>,
) -> Result<()> {
    let conn = db.conn.lock();
    conn.execute(
        "INSERT INTO exception_reasons (case_id, exception_type, reason, module, operator_id, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (
            case_id,
            exception_type,
            reason,
            module,
            operator_id,
            Utc::now(),
        ),
    )?;
    Ok(())
}

pub fn record_audit_note(
    db: &Database,
    case_id: i64,
    module: Option<&str>,
    audit_type: &str,
    content: &str,
    operator_id: Option<i64>,
) -> Result<()> {
    let conn = db.conn.lock();
    conn.execute(
        "INSERT INTO audit_notes (case_id, module, audit_type, content, operator_id, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (
            case_id,
            module,
            audit_type,
            content,
            operator_id,
            Utc::now(),
        ),
    )?;
    Ok(())
}

pub fn record_processing_record(
    db: &Database,
    case_id: i64,
    action: &str,
    from_status: Option<&str>,
    to_status: Option<&str>,
    operator_id: i64,
    remark: Option<&str>,
) -> Result<()> {
    let conn = db.conn.lock();
    conn.execute(
        "INSERT INTO processing_records (case_id, action, from_status, to_status, operator_id, remark, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (
            case_id,
            action,
            from_status,
            to_status,
            operator_id,
            remark,
            Utc::now(),
        ),
    )?;
    Ok(())
}

pub fn generate_case_no() -> String {
    let now = chrono::Local::now();
    let date_str = now.format("%Y%m%d").to_string();
    let rand_num: u32 = rand::thread_rng().gen_range(1000..9999);
    format!("LC{}{}", date_str, rand_num)
}

pub fn get_queue_for_status(status: &CaseStatus) -> CaseQueue {
    match status {
        CaseStatus::Draft | CaseStatus::PendingSubmit | CaseStatus::Submitted
        | CaseStatus::Returned | CaseStatus::Resubmitted => CaseQueue::Registration,
        CaseStatus::Reviewing => CaseQueue::Review,
        CaseStatus::Assigned => CaseQueue::Assignment,
        CaseStatus::Followup | CaseStatus::Completed => CaseQueue::Followup,
        CaseStatus::Archived => CaseQueue::Archive,
    }
}

pub fn get_handler_for_status(
    status: &CaseStatus,
    role: &UserRole,
    user_id: i64,
) -> Option<i64> {
    match status {
        CaseStatus::Reviewing => {
            if matches!(role, UserRole::Reviewer | UserRole::Supervisor | UserRole::Director) {
                Some(user_id)
            } else {
                None
            }
        }
        CaseStatus::Assigned | CaseStatus::Followup | CaseStatus::Completed => {
            if matches!(role, UserRole::Assistant | UserRole::Lawyer) {
                Some(user_id)
            } else {
                None
            }
        }
        _ => None,
    }
}

pub fn get_warning_status(deadline: Option<DateTime<Utc>>) -> Option<crate::models::WarningStatus> {
    let deadline = deadline?;
    let now = Utc::now();

    if now > deadline {
        Some(crate::models::WarningStatus::Overdue)
    } else if deadline - now < Duration::days(1) {
        Some(crate::models::WarningStatus::Approaching)
    } else {
        Some(crate::models::WarningStatus::Normal)
    }
}

pub fn get_user_name(db: &Database, user_id: i64) -> Result<Option<String>> {
    let conn = db.conn.lock();
    let mut stmt = conn.prepare("SELECT real_name FROM users WHERE id = ?1")?;
    let result = stmt.query_row([user_id], |row| row.get::<_, String>(0));
    match result {
        Ok(name) => Ok(Some(name)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn get_case(db: &Database, case_id: i64) -> Result<LegalCase> {
    let conn = db.conn.lock();
    let mut stmt = conn.prepare(
        "SELECT id, case_no, title, priority, status, queue, current_handler_id, deadline, 
         version, created_by, created_at, updated_at FROM legal_cases WHERE id = ?1",
    )?;
    let case = stmt.query_row([case_id], |row| {
        Ok(LegalCase {
            id: row.get(0)?,
            case_no: row.get(1)?,
            title: row.get(2)?,
            priority: crate::models::CasePriority::from_str(&row.get::<_, String>(3)?)
                .ok_or_else(|| rusqlite::Error::InvalidColumnType(3, "Invalid priority".to_string(), rusqlite::types::Type::Text))?,
            status: CaseStatus::from_str(&row.get::<_, String>(4)?)
                .ok_or_else(|| rusqlite::Error::InvalidColumnType(4, "Invalid status".to_string(), rusqlite::types::Type::Text))?,
            queue: CaseQueue::from_str(&row.get::<_, String>(5)?)
                .ok_or_else(|| rusqlite::Error::InvalidColumnType(5, "Invalid queue".to_string(), rusqlite::types::Type::Text))?,
            current_handler_id: row.get(6)?,
            current_handler_name: None,
            deadline: row.get(7)?,
            version: row.get(8)?,
            created_by: row.get(9)?,
            created_by_name: None,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
            warning_status: None,
        })
    })?;
    Ok(case)
}

pub fn update_case_status(
    db: &Database,
    case_id: i64,
    old_status: &CaseStatus,
    new_status: &CaseStatus,
    operator_id: i64,
    remark: Option<&str>,
) -> Result<()> {
    if !old_status.can_transition_to(new_status) {
        return Err(AppError::InvalidStatusTransition {
            from: old_status.as_str().to_string(),
            to: new_status.as_str().to_string(),
        });
    }

    check_transition_prerequisites(db, case_id, new_status)?;

    let queue = get_queue_for_status(new_status).as_str().to_string();

    {
        let conn = db.conn.lock();

        if matches!(new_status, CaseStatus::Assigned | CaseStatus::Followup) {
            let maybe_lawyer: Option<i64> = conn.query_row(
                "SELECT lawyer_id FROM case_assignment WHERE case_id = ?1",
                [case_id],
                |row| row.get::<_, Option<i64>>(0),
            ).unwrap_or(None);
            if let Some(lawyer_id) = maybe_lawyer {
                conn.execute(
                    "UPDATE legal_cases SET status = ?1, queue = ?2, current_handler_id = ?3, version = version + 1, updated_at = ?4 WHERE id = ?5",
                    (new_status.as_str(), &queue, lawyer_id, Utc::now(), case_id),
                )?;
            } else {
                conn.execute(
                    "UPDATE legal_cases SET status = ?1, queue = ?2, version = version + 1, updated_at = ?3 WHERE id = ?4",
                    (new_status.as_str(), &queue, Utc::now(), case_id),
                )?;
            }
        } else {
            conn.execute(
                "UPDATE legal_cases SET status = ?1, queue = ?2, version = version + 1, updated_at = ?3 WHERE id = ?4",
                (new_status.as_str(), &queue, Utc::now(), case_id),
            )?;
        }
    }

    record_processing_record(
        db,
        case_id,
        "status_transition",
        Some(old_status.as_str()),
        Some(new_status.as_str()),
        operator_id,
        remark,
    )?;

    Ok(())
}

pub fn init_module_records(db: &Database, case_id: i64) -> Result<()> {
    let conn = db.conn.lock();
    
    conn.execute(
        "INSERT OR IGNORE INTO case_registration (case_id, client_name, client_phone, client_id_card, 
         consultation_type, consultation_content, evidence_provided, registration_remark, 
         registered_by, registered_at, is_complete) 
         VALUES (?1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0)",
        [case_id],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO case_assignment (case_id, assistant_id, lawyer_id, assignment_reason, 
         assignment_remark, assigned_by, assigned_at, is_complete) 
         VALUES (?1, NULL, NULL, NULL, NULL, NULL, NULL, 0)",
        [case_id],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO case_followup (case_id, followup_result, client_satisfaction, 
         followup_remark, followup_by, followup_at, is_complete) 
         VALUES (?1, NULL, NULL, NULL, NULL, NULL, 0)",
        [case_id],
    )?;

    Ok(())
}
