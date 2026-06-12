use rusqlite::{Connection, params};
use uuid::Uuid;
use chrono::{Utc, NaiveDateTime, Duration};
use crate::models::*;
use std::collections::HashMap;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &str, init_sql: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.execute_batch(init_sql)?;
        Ok(Database { conn })
    }

    pub fn get_conn(&self) -> &Connection {
        &self.conn
    }

    pub fn login(&self, username: &str, password: &str) -> Option<User> {
        let mut stmt = self.conn.prepare(
            "SELECT u.id, u.username, u.password, u.real_name 
             FROM users u 
             WHERE u.username = ?1 AND u.password = ?2"
        ).ok()?;
        
        let user_result = stmt.query_row(params![username, password], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, 
                row.get::<_, String>(2)?, row.get::<_, String>(3)?))
        }).ok()?;

        let (id, uname, passwd, real_name) = user_result;
        
        let mut role_stmt = self.conn.prepare(
            "SELECT r.id FROM user_roles ur 
             JOIN roles r ON ur.role_id = r.id 
             WHERE ur.user_id = ?1"
        ).ok()?;
        
        let roles: Vec<String> = role_stmt.query_map(params![id], |row| {
            row.get::<_, String>(0)
        }).ok()?.filter_map(|r| r.ok()).collect();

        Some(User {
            id,
            username: uname,
            password: passwd,
            real_name,
            roles,
        })
    }

    pub fn get_user_by_id(&self, user_id: &str) -> Option<User> {
        let mut stmt = self.conn.prepare(
            "SELECT u.id, u.username, u.password, u.real_name FROM users u WHERE u.id = ?1"
        ).ok()?;
        
        let user_result = stmt.query_row(params![user_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, 
                row.get::<_, String>(2)?, row.get::<_, String>(3)?))
        }).ok()?;

        let (id, username, password, real_name) = user_result;
        
        let mut role_stmt = self.conn.prepare(
            "SELECT r.id FROM user_roles ur 
             JOIN roles r ON ur.role_id = r.id 
             WHERE ur.user_id = ?1"
        ).ok()?;
        
        let roles: Vec<String> = role_stmt.query_map(params![id], |row| {
            row.get::<_, String>(0)
        }).ok()?.filter_map(|r| r.ok()).collect();

        Some(User {
            id,
            username,
            password,
            real_name,
            roles,
        })
    }

    pub fn get_user_real_name(&self, user_id: &str) -> Option<String> {
        let mut stmt = self.conn.prepare("SELECT real_name FROM users WHERE id = ?1").ok()?;
        stmt.query_row(params![user_id], |row| row.get::<_, String>(0)).ok()
    }

    pub fn get_role_name(&self, role_id: &str) -> Option<String> {
        let mut stmt = self.conn.prepare("SELECT name FROM roles WHERE id = ?1").ok()?;
        stmt.query_row(params![role_id], |row| row.get::<_, String>(0)).ok()
    }

    fn resolve_acting_role(&self, user: &User, acting_role: &Option<String>) -> String {
        if let Some(role) = acting_role {
            if user.roles.contains(role) {
                return role.clone();
            }
        }
        user.roles.first().cloned().unwrap_or_else(|| "register".to_string())
    }

    fn calc_warning_level(&self, deadline: Option<NaiveDateTime>) -> Option<String> {
        let now = Utc::now().naive_utc();
        if let Some(dl) = deadline {
            if now > dl {
                Some("overdue".to_string())
            } else if dl - now <= Duration::days(1) {
                Some("warning".to_string())
            } else {
                Some("normal".to_string())
            }
        } else {
            None
        }
    }

    fn get_handler_by_role(&self, role: &str) -> String {
        match role {
            "auditor" => "u2".to_string(),
            "reviewer" => "u3".to_string(),
            _ => "u1".to_string(),
        }
    }

    fn map_status_filter(&self, status: &Option<String>) -> (Option<String>, Option<String>, Option<String>) {
        match status.as_deref() {
            Some("待核验") | Some("pending_invoice") => (None, Some("pending".to_string()), None),
            Some("核验失败") | Some("verify_failed") => (None, Some("failed".to_string()), None),
            Some("核验完成") | Some("invoice_passed") => (None, Some("passed".to_string()), None),
            Some("放款待确认") => (None, None, Some("pending".to_string())),
            Some("放款完成") => (None, None, Some("confirmed".to_string())),
            _ => (status.clone(), None, None),
        }
    }

    pub fn list_applications(&self, query: &ApplicationListQuery, current_user: &User) 
        -> Result<PaginatedResponse<FinanceApplication>, Box<dyn std::error::Error>> 
    {
        let page = query.page.unwrap_or(1);
        let page_size = query.page_size.unwrap_or(20);
        let offset = (page - 1) * page_size;
        let acting_role = self.resolve_acting_role(current_user, &query.acting_role);

        let mut conditions: Vec<String> = Vec::new();
        let mut params_vec: Vec<String> = Vec::new();

        let (status_filter, invoice_filter, loan_filter) = self.map_status_filter(&query.status);

        if let Some(status) = status_filter {
            conditions.push("status = ?".to_string());
            params_vec.push(status);
        }
        if let Some(invoice_status) = &query.invoice_status {
            conditions.push("invoice_verify_status = ?".to_string());
            params_vec.push(invoice_status.clone());
        } else if let Some(invoice_filter) = invoice_filter {
            conditions.push("invoice_verify_status = ?".to_string());
            params_vec.push(invoice_filter);
        }
        if let Some(loan_status) = &query.loan_status {
            conditions.push("loan_confirm_status = ?".to_string());
            params_vec.push(loan_status.clone());
        } else if let Some(loan_filter) = loan_filter {
            conditions.push("loan_confirm_status = ?".to_string());
            params_vec.push(loan_filter);
        }
        if let Some(clue_no) = &query.clue_no {
            conditions.push("clue_no LIKE ?".to_string());
            params_vec.push(format!("%{}%", clue_no));
        }
        if let Some(customer_name) = &query.customer_name {
            conditions.push("customer_name LIKE ?".to_string());
            params_vec.push(format!("%{}%", customer_name));
        }
        if let Some(node) = &query.node {
            conditions.push("current_node = ?".to_string());
            params_vec.push(node.clone());
        }
        if let Some(handler) = &query.handler {
            conditions.push("current_handler = ?".to_string());
            params_vec.push(handler.clone());
        }

        match acting_role.as_str() {
            "register" => {
                conditions.push("(created_by = ? OR current_handler = ?)".to_string());
                params_vec.push(current_user.id.clone());
                params_vec.push(current_user.id.clone());
            }
            "auditor" => {
                conditions.push("(current_handler = ? OR current_node IN ('register_done', 'verify_rejected'))".to_string());
                params_vec.push(current_user.id.clone());
            }
            "reviewer" => {
                conditions.push("(current_handler = ? OR current_node = 'verify_done')".to_string());
                params_vec.push(current_user.id.clone());
            }
            _ => {}
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!("SELECT COUNT(*) FROM finance_applications {}", where_clause);
        let mut count_stmt = self.conn.prepare(&count_sql)?;
        let total: i64 = count_stmt.query_row(rusqlite::params_from_iter(params_vec.iter()), |row| row.get(0))?;

        let sql = format!(
            "SELECT id, application_no, clue_no, customer_name, finance_amount, invoice_count, 
                    status, current_handler, current_node, node_deadline, version, created_by, 
                    created_at, updated_at, invoice_verify_status, loan_confirm_status, correction_count, remark
             FROM finance_applications 
             {} 
             ORDER BY 
                CASE status 
                    WHEN 'overdue' THEN 0
                    WHEN 'pending_correction' THEN 1
                    WHEN 'pending_verify' THEN 2
                    WHEN 'verify_passed' THEN 3
                    WHEN 'archived' THEN 4
                    ELSE 5
                END,
                created_at DESC 
             LIMIT ? OFFSET ?",
            where_clause
        );

        let mut stmt = self.conn.prepare(&sql)?;
        let mut rows = stmt.query(rusqlite::params_from_iter(
            params_vec.iter().chain(std::iter::once(&page_size.to_string())).chain(std::iter::once(&offset.to_string()))
        ))?;

        let mut list: Vec<FinanceApplication> = Vec::new();
        while let Some(row) = rows.next()? {
            let deadline: Option<NaiveDateTime> = row.get(9)?;
            let app = FinanceApplication {
                id: row.get(0)?,
                application_no: row.get(1)?,
                clue_no: row.get(2)?,
                customer_name: row.get(3)?,
                finance_amount: row.get(4)?,
                invoice_count: row.get(5)?,
                status: row.get(6)?,
                current_handler: row.get(7)?,
                current_handler_name: row.get::<_, Option<String>>(7)?.and_then(|h| self.get_user_real_name(&h)),
                current_node: row.get(8)?,
                node_deadline: deadline,
                warning_level: self.calc_warning_level(deadline),
                version: row.get(10)?,
                created_by: row.get(11)?,
                created_by_name: self.get_user_real_name(&row.get::<_, String>(11)?),
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                invoice_verify_status: row.get(14)?,
                loan_confirm_status: row.get(15)?,
                correction_count: row.get(16)?,
                remark: row.get(17)?,
            };
            list.push(app);
        }

        Ok(PaginatedResponse {
            list,
            total,
            page,
            page_size,
        })
    }

    pub fn get_evidence_requirements(&self, app_id: &str) -> Result<Vec<EvidenceRequirement>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_id, evidence_type, evidence_name, required, provided, 
                    attachment_id, required_by_role, required_at, provided_at, remark
             FROM evidence_requirements 
             WHERE application_id = ?1 
             ORDER BY required_at DESC"
        )?;

        let rows = stmt.query_map(params![app_id], |row| {
            let required_int: i64 = row.get(4)?;
            let provided_int: i64 = row.get(5)?;
            Ok(EvidenceRequirement {
                id: row.get(0)?,
                application_id: row.get(1)?,
                evidence_type: row.get(2)?,
                evidence_name: row.get(3)?,
                required: required_int != 0,
                provided: provided_int != 0,
                attachment_id: row.get(6)?,
                required_by_role: row.get(7)?,
                required_at: row.get(8)?,
                provided_at: row.get(9)?,
                remark: row.get(10)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn check_required_evidence(&self, app_id: &str) -> Result<(bool, Vec<String>), Box<dyn std::error::Error>> {
        let reqs = self.get_evidence_requirements(app_id)?;
        let mut missing: Vec<String> = Vec::new();
        for req in &reqs {
            if req.required && !req.provided {
                missing.push(format!("[{}]{}", req.evidence_type, req.evidence_name));
            }
        }
        Ok((missing.is_empty(), missing))
    }

    pub fn get_application_detail(&self, id: &str, current_user: &User) 
        -> Result<ApplicationDetail, Box<dyn std::error::Error>> 
    {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_no, clue_no, customer_name, finance_amount, invoice_count, 
                    status, current_handler, current_node, node_deadline, version, created_by, 
                    created_at, updated_at, invoice_verify_status, loan_confirm_status, correction_count, remark
             FROM finance_applications WHERE id = ?1"
        )?;

        let row = stmt.query_row(params![id], |row| {
            let deadline: Option<NaiveDateTime> = row.get(9)?;
            Ok(FinanceApplication {
                id: row.get(0)?,
                application_no: row.get(1)?,
                clue_no: row.get(2)?,
                customer_name: row.get(3)?,
                finance_amount: row.get(4)?,
                invoice_count: row.get(5)?,
                status: row.get(6)?,
                current_handler: row.get(7)?,
                current_handler_name: row.get::<_, Option<String>>(7)?.and_then(|h| self.get_user_real_name(&h)),
                current_node: row.get(8)?,
                node_deadline: deadline,
                warning_level: self.calc_warning_level(deadline),
                version: row.get(10)?,
                created_by: row.get(11)?,
                created_by_name: self.get_user_real_name(&row.get::<_, String>(11)?),
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                invoice_verify_status: row.get(14)?,
                loan_confirm_status: row.get(15)?,
                correction_count: row.get(16)?,
                remark: row.get(17)?,
            })
        })?;

        let attachments = self.get_attachments(id)?;
        let records = self.get_processing_records(id)?;
        let exceptions = self.get_exception_reasons(id)?;
        let audit_notes = self.get_audit_notes(id)?;
        let evidence_requirements = self.get_evidence_requirements(id)?;

        let (can_process, allowed_actions) = self.get_allowed_actions(&row, current_user, None);

        Ok(ApplicationDetail {
            application: row,
            attachments,
            records,
            exceptions,
            audit_notes,
            evidence_requirements,
            can_process,
            allowed_actions,
        })
    }

    fn get_allowed_actions(&self, app: &FinanceApplication, user: &User, acting_role_opt: Option<&str>) -> (bool, Vec<String>) {
        let mut actions: Vec<String> = Vec::new();
        let mut can_process = false;

        let acting_role = acting_role_opt
            .map(|r| r.to_string())
            .unwrap_or_else(|| self.resolve_acting_role(user, &None));

        let is_register = acting_role == "register";
        let is_auditor = acting_role == "auditor";
        let is_reviewer = acting_role == "reviewer";

        let is_handler = app.current_handler.as_deref() == Some(&user.id);
        let is_creator = app.created_by == user.id;

        match app.status.as_str() {
            "draft" => {
                if is_register && is_creator {
                    can_process = true;
                    actions.push("submit".to_string());
                    actions.push("edit".to_string());
                }
            }
            "pending_verify" => {
                if is_auditor && is_handler {
                    can_process = true;
                    actions.push("pass".to_string());
                    actions.push("reject".to_string());
                    actions.push("note".to_string());
                }
                if is_register && is_creator {
                    actions.push("note".to_string());
                }
            }
            "pending_correction" => {
                if is_register && is_creator {
                    can_process = true;
                    actions.push("resubmit".to_string());
                    actions.push("note".to_string());
                }
                if is_auditor {
                    actions.push("note".to_string());
                }
            }
            "verify_passed" => {
                if is_reviewer && is_handler {
                    can_process = true;
                    actions.push("archive".to_string());
                    actions.push("return".to_string());
                    actions.push("note".to_string());
                }
                if is_auditor {
                    actions.push("note".to_string());
                }
            }
            "overdue" => {
                if is_auditor && is_handler {
                    can_process = true;
                    actions.push("pass".to_string());
                    actions.push("reject".to_string());
                    actions.push("note".to_string());
                }
            }
            "archived" => {
                actions.push("note".to_string());
            }
            _ => {}
        }

        (can_process, actions)
    }

    pub fn get_attachments(&self, app_id: &str) -> Result<Vec<Attachment>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_id, file_name, file_type, file_size, evidence_type, 
                    uploaded_by, uploaded_at 
             FROM attachments WHERE application_id = ?1 ORDER BY uploaded_at DESC"
        )?;

        let rows = stmt.query_map(params![app_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                application_id: row.get(1)?,
                file_name: row.get(2)?,
                file_type: row.get(3)?,
                file_size: row.get(4)?,
                evidence_type: row.get(5)?,
                uploaded_by: row.get(6)?,
                uploaded_by_name: self.get_user_real_name(&row.get::<_, String>(6)?),
                uploaded_at: row.get(7)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_processing_records(&self, app_id: &str) -> Result<Vec<ProcessingRecord>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_id, from_status, to_status, from_node, to_node, action, 
                    handler, handler_role, acting_role, comment, correction_note, 
                    evidence_required, evidence_provided,
                    invoice_status_before, invoice_status_after, loan_status_before, loan_status_after,
                    version_before, version_after, created_at
             FROM processing_records WHERE application_id = ?1 ORDER BY created_at ASC, id ASC"
        )?;

        let action_names: HashMap<&str, &str> = [
            ("create", "创建"),
            ("submit", "提交核验"),
            ("pass", "核验通过"),
            ("reject", "退回补正"),
            ("resubmit", "重新提交"),
            ("archive", "复核归档"),
            ("return", "复核退回补正"),
            ("note", "添加备注"),
        ].iter().cloned().collect();

        let role_names: HashMap<&str, &str> = [
            ("register", "融资申请登记员"),
            ("auditor", "融资申请审核主管"),
            ("reviewer", "供应链金融平台复核负责人"),
        ].iter().cloned().collect();

        let rows = stmt.query_map(params![app_id], |row| {
            let handler: String = row.get(7)?;
            let handler_role: String = row.get(8)?;
            let action: String = row.get(6)?;
            Ok(ProcessingRecord {
                id: row.get(0)?,
                application_id: row.get(1)?,
                from_status: row.get(2)?,
                to_status: row.get(3)?,
                from_node: row.get(4)?,
                to_node: row.get(5)?,
                action: action.clone(),
                action_name: action_names.get(action.as_str()).map(|s| s.to_string()),
                handler: handler.clone(),
                handler_name: self.get_user_real_name(&handler),
                handler_role: handler_role.clone(),
                acting_role: row.get(9)?,
                handler_role_name: role_names.get(handler_role.as_str()).map(|s| s.to_string()),
                comment: row.get(10)?,
                correction_note: row.get(11)?,
                evidence_required: row.get(12)?,
                evidence_provided: row.get(13)?,
                invoice_status_before: row.get(14)?,
                invoice_status_after: row.get(15)?,
                loan_status_before: row.get(16)?,
                loan_status_after: row.get(17)?,
                version_before: row.get(18)?,
                version_after: row.get(19)?,
                created_at: row.get(20)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_exception_reasons(&self, app_id: &str) -> Result<Vec<ExceptionReason>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_id, record_id, audit_note_id, exception_type, reason, severity, source_role,
                    resolved, resolved_by, resolved_by_role, resolved_note, resolved_at, created_at
             FROM exception_reasons WHERE application_id = ?1 ORDER BY created_at DESC"
        )?;

        let type_names: HashMap<&str, &str> = [
            ("missing_material", "材料缺失"),
            ("reject_correction", "审核退回补正"),
            ("review_return", "复核退回补正"),
            ("overdue", "节点逾期"),
            ("invoice_verify_pending", "发票核验待完成"),
            ("status_conflict", "状态冲突"),
            ("permission_denied", "权限不足"),
            ("version_conflict", "版本冲突"),
            ("duplicate_submit", "重复提交"),
            ("missing_evidence", "缺少必填证据"),
        ].iter().cloned().collect();

        let rows = stmt.query_map(params![app_id], |row| {
            let exc_type: String = row.get(4)?;
            let resolved_int: i64 = row.get(8)?;
            Ok(ExceptionReason {
                id: row.get(0)?,
                application_id: row.get(1)?,
                record_id: row.get(2)?,
                audit_note_id: row.get(3)?,
                exception_type: exc_type.clone(),
                exception_type_name: type_names.get(exc_type.as_str()).map(|s| s.to_string()),
                reason: row.get(5)?,
                severity: row.get(6)?,
                source_role: row.get(7)?,
                resolved: resolved_int != 0,
                resolved_by: row.get(9)?,
                resolved_by_role: row.get(10)?,
                resolved_note: row.get(11)?,
                resolved_at: row.get(12)?,
                created_at: row.get(13)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_audit_notes(&self, app_id: &str) -> Result<Vec<AuditNote>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_id, note, note_type, related_record_id, related_exception_id,
                    created_by, created_by_role, created_at
             FROM audit_notes WHERE application_id = ?1 ORDER BY created_at DESC"
        )?;

        let rows = stmt.query_map(params![app_id], |row| {
            let created_by: String = row.get(6)?;
            Ok(AuditNote {
                id: row.get(0)?,
                application_id: row.get(1)?,
                note: row.get(2)?,
                note_type: row.get(3)?,
                related_record_id: row.get(4)?,
                related_exception_id: row.get(5)?,
                created_by: created_by.clone(),
                created_by_role: row.get(7)?,
                created_by_name: self.get_user_real_name(&created_by),
                created_at: row.get(8)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn create_application(&self, req: &CreateApplicationRequest, user: &User) 
        -> Result<FinanceApplication, Box<dyn std::error::Error>> 
    {
        let acting_role = self.resolve_acting_role(user, &req.acting_role);
        
        if acting_role != "register" {
            return Err("权限不足：只有融资申请登记员角色可以创建申请单".into());
        }

        let id = Uuid::new_v4().to_string();
        let now = Utc::now().naive_utc();
        
        let no_prefix = "RZ";
        let date_str = now.format("%Y%m").to_string();
        let mut count_stmt = self.conn.prepare(
            "SELECT COUNT(*) FROM finance_applications WHERE application_no LIKE ?1"
        )?;
        let count: i64 = count_stmt.query_row(params![format!("{}{}%", no_prefix, date_str)], |row| row.get(0))?;
        let application_no = format!("{}{}{:03}", no_prefix, date_str, count + 1);

        let deadline = now + Duration::days(3);
        let auditor_handler = self.get_handler_by_role("auditor");

        self.conn.execute(
            "INSERT INTO finance_applications 
             (id, application_no, clue_no, customer_name, finance_amount, invoice_count, 
              status, current_handler, current_node, node_deadline, version, created_by, 
              created_at, updated_at, invoice_verify_status, loan_confirm_status, correction_count, remark)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![
                id, application_no, req.clue_no, req.customer_name, req.finance_amount,
                req.invoice_count, "pending_verify", auditor_handler, "register_done",
                deadline, 1, user.id, now, now, "pending", "pending", 0, req.remark
            ]
        )?;

        if let Some(ev_reqs) = &req.evidence_requirements {
            let name_map: std::collections::HashMap<&str, &str> = [
                ("contract", "购销合同"),
                ("invoice", "增值税发票"),
                ("invoice_list", "发票清单"),
                ("loan_voucher", "放款凭证"),
                ("delivery_note", "送货单"),
                ("receipt", "签收单"),
                ("other", "其他材料"),
            ].iter().cloned().collect();
            for ev_type in ev_reqs {
                let ev_id = Uuid::new_v4().to_string();
                let ev_name = name_map.get(ev_type.as_str()).map(|s| s.to_string()).unwrap_or_else(|| ev_type.clone());
                self.conn.execute(
                    "INSERT INTO evidence_requirements 
                     (id, application_id, evidence_type, evidence_name, required, provided, 
                      attachment_id, required_by_role, required_at, provided_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    params![
                        ev_id, id, ev_type, ev_name, 1_i64, 0_i64,
                        None::<String>, acting_role, now, None::<NaiveDateTime>
                    ]
                )?;
            }
        }

        let record_id = Uuid::new_v4().to_string();
        let ev_req_str = req.evidence_requirements.as_ref()
            .map(|list| list.join(","));
        self.conn.execute(
            "INSERT INTO processing_records 
             (id, application_id, from_status, to_status, from_node, to_node, action, 
              handler, handler_role, acting_role, comment, evidence_required, evidence_provided,
              version_before, version_after, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                record_id, id, None::<String>, "pending_verify", None::<String>, "register_done",
                "create", user.id, "register", acting_role, "创建融资申请单",
                ev_req_str.clone(), None::<String>, None::<i64>, 1, now
            ]
        )?;

        let submit_record_id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO processing_records 
             (id, application_id, from_status, to_status, from_node, to_node, action, 
              handler, handler_role, acting_role, comment, evidence_required, evidence_provided,
              version_before, version_after, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                submit_record_id, id, "draft", "pending_verify", "register", "register_done",
                "submit", user.id, "register", acting_role, "提交核验",
                ev_req_str, ev_req_str, 1_i64, 2_i64, now
            ]
        )?;

        self.conn.execute(
            "UPDATE finance_applications SET version = 2 WHERE id = ?1",
            params![id]
        )?;

        if req.invoice_count > 0 {
            let exc_id = Uuid::new_v4().to_string();
            self.conn.execute(
                "INSERT INTO exception_reasons 
                 (id, application_id, exception_type, reason, severity, source_role, resolved, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    exc_id, id, "invoice_verify_pending",
                    format!("发票核验尚未完成，当前待核验{}张发票", req.invoice_count),
                    "warning", acting_role, 0, now
                ]
            )?;
        }

        let detail = self.get_application_detail(&id, user)?;
        Ok(detail.application)
    }

    pub fn process_application(&self, id: &str, req: &ProcessApplicationRequest, user: &User)
        -> Result<ApplicationDetail, Box<dyn std::error::Error>>
    {
        let acting_role = self.resolve_acting_role(user, &req.acting_role);
        let is_register = acting_role == "register";
        let is_auditor = acting_role == "auditor";
        let is_reviewer = acting_role == "reviewer";

        let detail = self.get_application_detail(id, user)?;
        let app = &detail.application;

        if app.version != req.version {
            return Err("版本冲突：该申请单已被其他人处理，请刷新后重试".into());
        }

        if app.current_handler.as_deref().is_some() 
           && app.current_handler.as_deref() != Some(&user.id)
           && req.action != "note" {
            return Err(format!("角色边界拦截：当前处理人为 {}，您无权推进此队列",
                app.current_handler_name.clone().unwrap_or_else(|| "未知".to_string())).into());
        }

        let (can_process, allowed) = self.get_allowed_actions(app, user, Some(&acting_role));
        if req.action != "note" && !can_process {
            return Err(format!("越权拦截：角色[{}]在当前状态下不支持操作[{}]，允许操作: {}",
                acting_role, req.action, allowed.join(","))
                .into());
        }
        if !allowed.contains(&req.action) {
            return Err(format!("角色权限拦截：当前角色不支持操作[{}]，允许操作: {}",
                req.action, allowed.join(",")).into());
        }

        let now = Utc::now().naive_utc();
        let new_version = app.version + 1;
        let record_id = Uuid::new_v4().to_string();
        let correction_note = req.correction_note.clone();
        let ev_req = req.evidence_required.as_ref().map(|v| v.join(","));
        let ev_prov = req.evidence_provided.as_ref().map(|v| v.join(","));
        let old_invoice_status = app.invoice_verify_status.clone();
        let old_loan_status = app.loan_confirm_status.clone();
        let new_invoice_status = req.invoice_status.clone();
        let new_loan_status = req.loan_status.clone();

        let mut last_exception_id: Option<String> = None;

        match req.action.as_str() {
            "pass" => {
                if !is_auditor {
                    return Err("越权拦截：只有风控审核角色可以执行核验通过".into());
                }
                if app.status != "pending_verify" && app.status != "overdue" {
                    return Err("状态冲突：当前状态不支持核验通过操作".into());
                }

                let (ok, missing) = self.check_required_evidence(id)?;
                if !ok {
                    return Err(format!("缺少必填证据拦截：{}", missing.join("；")).into());
                }

                let reviewer_handler = self.get_handler_by_role("reviewer");
                let inv_status = new_invoice_status.clone().unwrap_or_else(|| "passed".to_string());
                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'verify_passed', current_handler = ?1, 
                         current_node = 'verify_done', version = ?2, 
                         updated_at = ?3, invoice_verify_status = ?4
                     WHERE id = ?5 AND version = ?6",
                    params![reviewer_handler, new_version, now, inv_status, id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, acting_role, comment, correction_note,
                      evidence_required, evidence_provided,
                      invoice_status_before, invoice_status_after,
                      version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
                    params![
                        record_id, id, app.status, "verify_passed", "register_done", "verify_done",
                        "pass", user.id, "auditor", acting_role, req.comment, correction_note.clone(),
                        ev_req, ev_prov,
                        old_invoice_status, inv_status,
                        app.version, new_version, now
                    ]
                )?;

                if app.status == "overdue" {
                    self.conn.execute(
                        "UPDATE exception_reasons SET resolved = 1, resolved_by = ?1, resolved_by_role = ?2, resolved_at = ?3, resolved_note = ?4
                         WHERE application_id = ?5 AND exception_type = 'overdue' AND resolved = 0",
                        params![user.id, acting_role, now, req.comment.clone().unwrap_or_default(), id]
                    )?;
                }
                self.conn.execute(
                    "UPDATE exception_reasons SET resolved = 1, resolved_by = ?1, resolved_by_role = ?2, resolved_at = ?3 
                     WHERE application_id = ?4 AND exception_type = 'invoice_verify_pending' AND resolved = 0",
                    params![user.id, acting_role, now, id]
                )?;
            }
            "reject" => {
                if !is_auditor {
                    return Err("越权拦截：只有风控审核角色可以执行退回补正".into());
                }
                if app.status != "pending_verify" && app.status != "overdue" {
                    return Err("状态冲突：当前状态不支持退回补正操作".into());
                }

                let new_correction_count = app.correction_count + 1;
                let inv_status = new_invoice_status.clone().unwrap_or_else(|| "failed".to_string());
                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'pending_correction', current_handler = ?1, 
                         current_node = 'verify_rejected', version = ?2, updated_at = ?3,
                         correction_count = ?4, invoice_verify_status = ?5
                     WHERE id = ?6 AND version = ?7",
                    params![app.created_by, new_version, now, new_correction_count, inv_status, id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, acting_role, comment, correction_note,
                      evidence_required, evidence_provided,
                      invoice_status_before, invoice_status_after,
                      version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
                    params![
                        record_id, id, app.status, "pending_correction", "register_done", "verify_rejected",
                        "reject", user.id, "auditor", acting_role, req.comment, correction_note.clone(),
                        ev_req, ev_prov,
                        old_invoice_status, inv_status,
                        app.version, new_version, now
                    ]
                )?;

                let exc_id = Uuid::new_v4().to_string();
                last_exception_id = Some(exc_id.clone());
                let reason = req.exception_reason.clone()
                    .unwrap_or_else(|| correction_note.clone()
                    .unwrap_or_else(|| "材料不符合要求，请核对后重新提交".to_string()));
                self.conn.execute(
                    "INSERT INTO exception_reasons 
                     (id, application_id, record_id, exception_type, reason, severity, source_role, resolved, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![exc_id, id, record_id, "reject_correction", reason, "warning", acting_role, 0, now]
                )?;

                let note_id = Uuid::new_v4().to_string();
                self.conn.execute(
                    "INSERT INTO audit_notes 
                     (id, application_id, note, note_type, related_record_id, related_exception_id,
                      created_by, created_by_role, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![note_id, id, format!("风控审核退回：{}", reason), "exception",
                        record_id, exc_id, user.id, acting_role, now]
                )?;
            }
            "resubmit" => {
                if !is_register {
                    return Err("越权拦截：只有融资申请登记员角色可以重新提交".into());
                }
                if app.status != "pending_correction" {
                    return Err("状态冲突：当前状态不支持重新提交操作".into());
                }
                if app.created_by != user.id {
                    return Err("权限拦截：只有创建人可以重新提交该申请单".into());
                }

                let auditor_handler = self.get_handler_by_role("auditor");
                let new_node = if app.current_node == "review_returned" { "verify_done" } else { "register_done" };
                let new_status = if app.current_node == "review_returned" { "verify_passed" } else { "pending_verify" };
                let new_handler = if app.current_node == "review_returned" { 
                    self.get_handler_by_role("reviewer") 
                } else { 
                    auditor_handler 
                };

                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = ?1, current_handler = ?2, 
                         current_node = ?3, version = ?4, updated_at = ?5,
                         node_deadline = ?6
                     WHERE id = ?7 AND version = ?8",
                    params![new_status, new_handler, new_node, new_version, now, 
                        now + Duration::days(3), id, app.version]
                )?;

                if let Some(updates) = &req.evidence_updates {
                    for uev in updates {
                        let provided_int = if uev.provided { 1 } else { 0 };
                        let provided_at: Option<NaiveDateTime> = if uev.provided { Some(now) } else { None };
                        if let Some(ev_id) = &uev.id {
                            self.conn.execute(
                                "UPDATE evidence_requirements 
                                 SET provided = ?1, attachment_id = ?2, provided_at = ?3, remark = ?4
                                 WHERE id = ?5 AND application_id = ?6",
                                params![provided_int, uev.attachment_id, provided_at, uev.remark, ev_id, id]
                            )?;
                        } else {
                            let new_ev_id = Uuid::new_v4().to_string();
                            self.conn.execute(
                                "INSERT INTO evidence_requirements 
                                 (id, application_id, evidence_type, evidence_name, required, provided, 
                                  attachment_id, required_by_role, required_at, provided_at, remark)
                                 VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, ?9, ?10)",
                                params![
                                    new_ev_id, id, uev.evidence_type, uev.evidence_name, 
                                    provided_int, uev.attachment_id, acting_role, now, provided_at, uev.remark
                                ]
                            )?;
                        }
                    }
                }

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, acting_role, comment, correction_note,
                      evidence_required, evidence_provided,
                      version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
                    params![
                        record_id, id, "pending_correction", new_status, app.current_node, new_node,
                        "resubmit", user.id, "register", acting_role, req.comment, correction_note.clone(),
                        ev_req, ev_prov,
                        app.version, new_version, now
                    ]
                )?;

                let exc_types: Vec<&str> = if app.current_node == "review_returned" {
                    vec!["review_return"]
                } else {
                    vec!["reject_correction"]
                };
                for et in exc_types {
                    self.conn.execute(
                        "UPDATE exception_reasons SET resolved = 1, resolved_by = ?1, resolved_by_role = ?2, resolved_at = ?3, resolved_note = ?4
                         WHERE application_id = ?5 AND exception_type = ?6 AND resolved = 0",
                        params![user.id, acting_role, now, 
                            correction_note.clone().unwrap_or_else(|| "已补正材料".to_string()),
                            id, et]
                    )?;
                }
            }
            "archive" => {
                if !is_reviewer {
                    return Err("越权拦截：只有复核负责人角色可以执行归档".into());
                }
                if app.status != "verify_passed" {
                    return Err("状态冲突：当前状态不支持归档操作".into());
                }

                let (ok, missing) = self.check_required_evidence(id)?;
                if !ok {
                    return Err(format!("复核缺证据拦截：{}", missing.join("；")).into());
                }

                let loan_status = new_loan_status.clone().unwrap_or_else(|| "confirmed".to_string());
                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'archived', current_handler = NULL, 
                         current_node = 'review_done', version = ?1, updated_at = ?2,
                         loan_confirm_status = ?3
                     WHERE id = ?4 AND version = ?5",
                    params![new_version, now, loan_status, id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, acting_role, comment, correction_note,
                      evidence_required, evidence_provided,
                      loan_status_before, loan_status_after,
                      version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
                    params![
                        record_id, id, "verify_passed", "archived", "verify_done", "review_done",
                        "archive", user.id, "reviewer", acting_role, req.comment, correction_note.clone(),
                        ev_req, ev_prov,
                        old_loan_status, loan_status,
                        app.version, new_version, now
                    ]
                )?;

                self.conn.execute(
                    "UPDATE exception_reasons SET resolved = 1, resolved_by = ?1, resolved_by_role = ?2, resolved_at = ?3 
                     WHERE application_id = ?4 AND resolved = 0",
                    params![user.id, acting_role, now, id]
                )?;
            }
            "return" => {
                if !is_reviewer {
                    return Err("越权拦截：只有复核负责人角色可以执行退回".into());
                }
                if app.status != "verify_passed" {
                    return Err("状态冲突：当前状态不支持退回操作".into());
                }

                let new_correction_count = app.correction_count + 1;
                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'pending_correction', current_handler = ?1, 
                         current_node = 'review_returned', version = ?2, updated_at = ?3,
                         correction_count = ?4
                     WHERE id = ?5 AND version = ?6",
                    params![app.created_by, new_version, now, new_correction_count, id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, acting_role, comment, correction_note,
                      evidence_required, evidence_provided,
                      version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
                    params![
                        record_id, id, "verify_passed", "pending_correction", "verify_done", "review_returned",
                        "return", user.id, "reviewer", acting_role, req.comment, correction_note.clone(),
                        ev_req, ev_prov,
                        app.version, new_version, now
                    ]
                )?;

                let exc_id = Uuid::new_v4().to_string();
                last_exception_id = Some(exc_id.clone());
                let reason = req.exception_reason.clone()
                    .unwrap_or_else(|| correction_note.clone()
                    .unwrap_or_else(|| "复核不通过，请核对后重新提交".to_string()));
                self.conn.execute(
                    "INSERT INTO exception_reasons 
                     (id, application_id, record_id, exception_type, reason, severity, source_role, resolved, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![exc_id, id, record_id, "review_return", reason, "error", acting_role, 0, now]
                )?;

                let note_id = Uuid::new_v4().to_string();
                self.conn.execute(
                    "INSERT INTO audit_notes 
                     (id, application_id, note, note_type, related_record_id, related_exception_id,
                      created_by, created_by_role, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![note_id, id, format!("复核退回：{}", reason), "exception",
                        record_id, exc_id, user.id, acting_role, now]
                )?;
            }
            "note" => {
                let role = acting_role.as_str();
                let note_id = Uuid::new_v4().to_string();
                self.conn.execute(
                    "INSERT INTO audit_notes 
                     (id, application_id, note, note_type, created_by, created_by_role, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![note_id, id, req.comment.clone().unwrap_or_default(), 
                        "general", user.id, role, now]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, action, 
                      handler, handler_role, acting_role, comment, 
                      version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    params![
                        record_id, id, app.status, app.status,
                        "note", user.id, role, acting_role, req.comment,
                        app.version, app.version, now
                    ]
                )?;

                return self.get_application_detail(id, user);
            }
            _ => {
                return Err("不支持的操作类型".into());
            }
        }

        self.get_application_detail(id, user)
    }

    pub fn batch_process(&self, req: &BatchProcessRequest, user: &User)
        -> Result<Vec<BatchProcessResult>, Box<dyn std::error::Error>>
    {
        let acting_role = self.resolve_acting_role(user, &req.acting_role);
        let mut results: Vec<BatchProcessResult> = Vec::new();

        for app_id in &req.ids {
            let result = match self.get_application_detail(app_id, user) {
                Ok(detail) => {
                    let version = req.version_map
                        .as_ref()
                        .and_then(|m| m.get(app_id))
                        .copied()
                        .unwrap_or(detail.application.version);

                    let process_req = ProcessApplicationRequest {
                        action: req.action.clone(),
                        comment: req.comment.clone(),
                        version,
                        acting_role: Some(acting_role.clone()),
                        evidence_required: None,
                        evidence_provided: None,
                        exception_reason: None,
                        correction_note: None,
                        invoice_status: None,
                        loan_status: None,
                        evidence_updates: None,
                    };

                    match self.process_application(app_id, &process_req, user) {
                        Ok(new_detail) => BatchProcessResult {
                            id: app_id.clone(),
                            application_no: new_detail.application.application_no.clone(),
                            success: true,
                            message: "处理成功".to_string(),
                        },
                        Err(e) => BatchProcessResult {
                            id: app_id.clone(),
                            application_no: detail.application.application_no.clone(),
                            success: false,
                            message: e.to_string(),
                        },
                    }
                }
                Err(e) => BatchProcessResult {
                    id: app_id.clone(),
                    application_no: String::new(),
                    success: false,
                    message: format!("申请单不存在: {}", e),
                },
            };
            results.push(result);
        }

        Ok(results)
    }

    pub fn get_statistics(&self, user: &User, acting_role_opt: Option<String>) -> Result<Statistics, Box<dyn std::error::Error>> {
        let acting_role = self.resolve_acting_role(user, &acting_role_opt);
        let mut conditions: Vec<String> = Vec::new();
        let mut params_vec: Vec<String> = Vec::new();

        match acting_role.as_str() {
            "register" => {
                conditions.push("(created_by = ? OR current_handler = ?)".to_string());
                params_vec.push(user.id.clone());
                params_vec.push(user.id.clone());
            }
            "auditor" => {
                conditions.push("(current_handler = ? OR current_node IN ('register_done', 'verify_rejected'))".to_string());
                params_vec.push(user.id.clone());
            }
            "reviewer" => {
                conditions.push("(current_handler = ? OR current_node = 'verify_done')".to_string());
                params_vec.push(user.id.clone());
            }
            _ => {}
        }

        let where_clause = if conditions.is_empty() {
            String::from("")
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let sql = format!(
            "SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending_verify' THEN 1 ELSE 0 END) as pending_verify,
                SUM(CASE WHEN invoice_verify_status = 'failed' 
                          OR status = 'verify_failed' THEN 1 ELSE 0 END) as verify_failed,
                SUM(CASE WHEN status IN ('verify_passed', 'archived') THEN 1 ELSE 0 END) as verify_completed,
                SUM(CASE WHEN status = 'verify_passed' THEN 1 ELSE 0 END) as pending_review,
                SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
                SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
                SUM(CASE WHEN status = 'pending_correction' THEN 1 ELSE 0 END) as pending_correction
             FROM finance_applications
             {}",
            where_clause
        );

        let mut stmt = self.conn.prepare(&sql)?;
        let stats = stmt.query_row(rusqlite::params_from_iter(params_vec.iter()), |row| {
            Ok(Statistics {
                total: row.get(0).unwrap_or(0),
                pending_verify: row.get(1).unwrap_or(0),
                verify_failed: row.get(2).unwrap_or(0),
                verify_completed: row.get(3).unwrap_or(0),
                pending_review: row.get(4).unwrap_or(0),
                archived: row.get(5).unwrap_or(0),
                overdue: row.get(6).unwrap_or(0),
                pending_correction: row.get(7).unwrap_or(0),
            })
        })?;

        Ok(stats)
    }
}
