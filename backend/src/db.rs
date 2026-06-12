use rusqlite::{Connection, params};
use uuid::Uuid;
use chrono::{Utc, NaiveDateTime, Duration};
use crate::models::*;
use std::collections::HashMap;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
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

    pub fn list_applications(&self, query: &ApplicationListQuery, current_user: &User) 
        -> Result<PaginatedResponse<FinanceApplication>, Box<dyn std::error::Error>> 
    {
        let page = query.page.unwrap_or(1);
        let page_size = query.page_size.unwrap_or(20);
        let offset = (page - 1) * page_size;

        let mut conditions: Vec<String> = Vec::new();
        let mut params_vec: Vec<String> = Vec::new();

        if let Some(status) = &query.status {
            conditions.push("status = ?".to_string());
            params_vec.push(status.clone());
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

        if !current_user.roles.contains(&"reviewer".to_string()) 
           && !current_user.roles.contains(&"auditor".to_string())
           && current_user.roles.contains(&"register".to_string()) {
            conditions.push("created_by = ?".to_string());
            params_vec.push(current_user.id.clone());
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
                    created_at, updated_at, invoice_verify_status, loan_confirm_status, remark
             FROM finance_applications 
             {} 
             ORDER BY created_at DESC 
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
                remark: row.get(16)?,
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

    pub fn get_application_detail(&self, id: &str, current_user: &User) 
        -> Result<ApplicationDetail, Box<dyn std::error::Error>> 
    {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_no, clue_no, customer_name, finance_amount, invoice_count, 
                    status, current_handler, current_node, node_deadline, version, created_by, 
                    created_at, updated_at, invoice_verify_status, loan_confirm_status, remark
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
                remark: row.get(16)?,
            })
        })?;

        let attachments = self.get_attachments(id)?;
        let records = self.get_processing_records(id)?;
        let exceptions = self.get_exception_reasons(id)?;
        let audit_notes = self.get_audit_notes(id)?;

        let (can_process, allowed_actions) = self.get_allowed_actions(&row, current_user);

        Ok(ApplicationDetail {
            application: row,
            attachments,
            records,
            exceptions,
            audit_notes,
            can_process,
            allowed_actions,
        })
    }

    fn get_allowed_actions(&self, app: &FinanceApplication, user: &User) -> (bool, Vec<String>) {
        let mut actions: Vec<String> = Vec::new();
        let mut can_process = false;

        let is_register = user.roles.contains(&"register".to_string());
        let is_auditor = user.roles.contains(&"auditor".to_string());
        let is_reviewer = user.roles.contains(&"reviewer".to_string());

        match app.status.as_str() {
            "draft" => {
                if is_register && app.created_by == user.id {
                    can_process = true;
                    actions.push("submit".to_string());
                    actions.push("edit".to_string());
                }
            }
            "pending_verify" => {
                if is_auditor && app.current_handler.as_deref() == Some(&user.id) {
                    can_process = true;
                    actions.push("pass".to_string());
                    actions.push("reject".to_string());
                    actions.push("note".to_string());
                }
            }
            "pending_correction" => {
                if is_register && app.created_by == user.id {
                    can_process = true;
                    actions.push("resubmit".to_string());
                    actions.push("note".to_string());
                }
            }
            "verify_passed" => {
                if is_reviewer && app.current_handler.as_deref() == Some(&user.id) {
                    can_process = true;
                    actions.push("archive".to_string());
                    actions.push("return".to_string());
                    actions.push("note".to_string());
                }
            }
            "overdue" => {
                if is_auditor && app.current_handler.as_deref() == Some(&user.id) {
                    can_process = true;
                    actions.push("pass".to_string());
                    actions.push("reject".to_string());
                    actions.push("note".to_string());
                }
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
                    handler, handler_role, comment, version_before, version_after, created_at
             FROM processing_records WHERE application_id = ?1 ORDER BY created_at ASC, id ASC"
        )?;

        let action_names: HashMap<&str, &str> = [
            ("create", "创建"),
            ("submit", "提交核验"),
            ("pass", "核验通过"),
            ("reject", "退回补正"),
            ("resubmit", "重新提交"),
            ("archive", "复核归档"),
            ("return", "退回"),
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
                handler_role_name: role_names.get(handler_role.as_str()).map(|s| s.to_string()),
                comment: row.get(9)?,
                version_before: row.get(10)?,
                version_after: row.get(11)?,
                created_at: row.get(12)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_exception_reasons(&self, app_id: &str) -> Result<Vec<ExceptionReason>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_id, record_id, exception_type, reason, severity, 
                    resolved, resolved_by, resolved_at, created_at
             FROM exception_reasons WHERE application_id = ?1 ORDER BY created_at DESC"
        )?;

        let type_names: HashMap<&str, &str> = [
            ("missing_material", "材料缺失"),
            ("reject_correction", "退回补正"),
            ("overdue", "逾期"),
            ("invoice_verify_pending", "发票核验待完成"),
            ("status_conflict", "状态冲突"),
            ("permission_denied", "权限不足"),
            ("version_conflict", "版本冲突"),
            ("duplicate_submit", "重复提交"),
        ].iter().cloned().collect();

        let rows = stmt.query_map(params![app_id], |row| {
            let exc_type: String = row.get(3)?;
            let resolved_int: i64 = row.get(6)?;
            Ok(ExceptionReason {
                id: row.get(0)?,
                application_id: row.get(1)?,
                record_id: row.get(2)?,
                exception_type: exc_type.clone(),
                exception_type_name: type_names.get(exc_type.as_str()).map(|s| s.to_string()),
                reason: row.get(4)?,
                severity: row.get(5)?,
                resolved: resolved_int != 0,
                resolved_by: row.get(7)?,
                resolved_at: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_audit_notes(&self, app_id: &str) -> Result<Vec<AuditNote>, Box<dyn std::error::Error>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, application_id, note, created_by, created_at
             FROM audit_notes WHERE application_id = ?1 ORDER BY created_at DESC"
        )?;

        let rows = stmt.query_map(params![app_id], |row| {
            let created_by: String = row.get(3)?;
            Ok(AuditNote {
                id: row.get(0)?,
                application_id: row.get(1)?,
                note: row.get(2)?,
                created_by: created_by.clone(),
                created_by_name: self.get_user_real_name(&created_by),
                created_at: row.get(4)?,
            })
        })?;

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn create_application(&self, req: &CreateApplicationRequest, user: &User) 
        -> Result<FinanceApplication, Box<dyn std::error::Error>> 
    {
        if !user.roles.contains(&"register".to_string()) {
            return Err("权限不足：只有融资申请登记员可以创建申请单".into());
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

        self.conn.execute(
            "INSERT INTO finance_applications 
             (id, application_no, clue_no, customer_name, finance_amount, invoice_count, 
              status, current_handler, current_node, node_deadline, version, created_by, 
              created_at, updated_at, invoice_verify_status, loan_confirm_status, remark)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                id, application_no, req.clue_no, req.customer_name, req.finance_amount,
                req.invoice_count, "pending_verify", "u2", "register_done",
                deadline, 1, user.id, now, now, "pending", "pending", req.remark
            ]
        )?;

        let record_id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO processing_records 
             (id, application_id, from_status, to_status, from_node, to_node, action, 
              handler, handler_role, comment, version_before, version_after, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                record_id, id, None::<String>, "pending_verify", None::<String>, "register_done",
                "create", user.id, "register", "创建融资申请单", None::<i64>, 1, now
            ]
        )?;

        let submit_record_id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO processing_records 
             (id, application_id, from_status, to_status, from_node, to_node, action, 
              handler, handler_role, comment, version_before, version_after, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                submit_record_id, id, "draft", "pending_verify", "register", "register_done",
                "submit", user.id, "register", "提交核验", 1_i64, 2_i64, now
            ]
        )?;

        self.conn.execute(
            "UPDATE finance_applications SET version = 2 WHERE id = ?1",
            params![id]
        )?;

        if req.invoice_count > 0 && req.invoice_count <= 5 {
            let exc_id = Uuid::new_v4().to_string();
            self.conn.execute(
                "INSERT INTO exception_reasons 
                 (id, application_id, exception_type, reason, severity, resolved, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    exc_id, id, "invoice_verify_pending",
                    format!("发票核验尚未完成，当前待核验{}张", req.invoice_count),
                    "warning", 0, now
                ]
            )?;
        }

        let detail = self.get_application_detail(&id, user)?;
        Ok(detail.application)
    }

    pub fn process_application(&self, id: &str, req: &ProcessApplicationRequest, user: &User)
        -> Result<ApplicationDetail, Box<dyn std::error::Error>>
    {
        let detail = self.get_application_detail(id, user)?;
        let app = &detail.application;

        if app.version != req.version {
            return Err("版本冲突：该申请单已被其他人处理，请刷新后重试".into());
        }

        if !detail.can_process {
            return Err("权限不足：您无权处理此申请单".into());
        }

        let is_register = user.roles.contains(&"register".to_string());
        let is_auditor = user.roles.contains(&"auditor".to_string());
        let is_reviewer = user.roles.contains(&"reviewer".to_string());

        let now = Utc::now().naive_utc();
        let new_version = app.version + 1;
        let record_id = Uuid::new_v4().to_string();

        match req.action.as_str() {
            "pass" => {
                if !is_auditor {
                    return Err("权限不足：只有风控审核可以执行核验通过".into());
                }
                if app.status != "pending_verify" && app.status != "overdue" {
                    return Err("状态冲突：当前状态不支持核验通过操作".into());
                }

                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'verify_passed', current_handler = 'u3', 
                         current_node = 'verify_done', version = ?1, 
                         updated_at = ?2, invoice_verify_status = 'passed'
                     WHERE id = ?3 AND version = ?4",
                    params![new_version, now, id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, comment, version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        record_id, id, app.status, "verify_passed", "register_done", "verify_done",
                        "pass", user.id, "auditor", req.comment,
                        app.version, new_version, now
                    ]
                )?;

                if app.status == "overdue" {
                    self.conn.execute(
                        "UPDATE exception_reasons SET resolved = 1, resolved_by = ?1, resolved_at = ?2 
                         WHERE application_id = ?3 AND exception_type = 'overdue' AND resolved = 0",
                        params![user.id, now, id]
                    )?;
                }
            }
            "reject" => {
                if !is_auditor {
                    return Err("权限不足：只有风控审核可以执行退回补正".into());
                }
                if app.status != "pending_verify" && app.status != "overdue" {
                    return Err("状态冲突：当前状态不支持退回补正操作".into());
                }

                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'pending_correction', current_handler = ?1, 
                         current_node = 'verify_rejected', version = ?2, updated_at = ?3
                     WHERE id = ?4 AND version = ?5",
                    params![app.created_by, new_version, now, id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, comment, version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        record_id, id, app.status, "pending_correction", "register_done", "verify_rejected",
                        "reject", user.id, "auditor", req.comment,
                        app.version, new_version, now
                    ]
                )?;

                let exc_id = Uuid::new_v4().to_string();
                let reason = req.exception_reason.clone()
                    .unwrap_or_else(|| "材料不符合要求，请核对后重新提交".to_string());
                self.conn.execute(
                    "INSERT INTO exception_reasons 
                     (id, application_id, record_id, exception_type, reason, severity, resolved, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![exc_id, id, record_id, "reject_correction", reason, "warning", 0, now]
                )?;
            }
            "resubmit" => {
                if !is_register {
                    return Err("权限不足：只有融资申请登记员可以重新提交".into());
                }
                if app.status != "pending_correction" {
                    return Err("状态冲突：当前状态不支持重新提交操作".into());
                }

                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'pending_verify', current_handler = 'u2', 
                         current_node = 'register_done', version = ?1, updated_at = ?2,
                         node_deadline = ?3
                     WHERE id = ?4 AND version = ?5",
                    params![new_version, now, now + Duration::days(3), id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, comment, version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        record_id, id, "pending_correction", "pending_verify", "verify_rejected", "register_done",
                        "resubmit", user.id, "register", req.comment,
                        app.version, new_version, now
                    ]
                )?;

                self.conn.execute(
                    "UPDATE exception_reasons SET resolved = 1, resolved_by = ?1, resolved_at = ?2 
                     WHERE application_id = ?3 AND exception_type = 'reject_correction' AND resolved = 0",
                    params![user.id, now, id]
                )?;
            }
            "archive" => {
                if !is_reviewer {
                    return Err("权限不足：只有复核负责人可以执行归档".into());
                }
                if app.status != "verify_passed" {
                    return Err("状态冲突：当前状态不支持归档操作".into());
                }

                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'archived', current_handler = NULL, 
                         current_node = 'review_done', version = ?1, updated_at = ?2,
                         loan_confirm_status = 'confirmed'
                     WHERE id = ?3 AND version = ?4",
                    params![new_version, now, id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, comment, version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        record_id, id, "verify_passed", "archived", "verify_done", "review_done",
                        "archive", user.id, "reviewer", req.comment,
                        app.version, new_version, now
                    ]
                )?;
            }
            "return" => {
                if !is_reviewer {
                    return Err("权限不足：只有复核负责人可以执行退回".into());
                }
                if app.status != "verify_passed" {
                    return Err("状态冲突：当前状态不支持退回操作".into());
                }

                self.conn.execute(
                    "UPDATE finance_applications 
                     SET status = 'pending_correction', current_handler = ?1, 
                         current_node = 'review_returned', version = ?2, updated_at = ?3
                     WHERE id = ?3 AND version = ?4",
                    params![app.created_by, new_version, now, id, app.version]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, from_node, to_node, action, 
                      handler, handler_role, comment, version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        record_id, id, "verify_passed", "pending_correction", "verify_done", "review_returned",
                        "return", user.id, "reviewer", req.comment,
                        app.version, new_version, now
                    ]
                )?;
            }
            "note" => {
                if !detail.can_process {
                    return Err("权限不足：您无权添加备注".into());
                }

                let role = if is_reviewer { "reviewer" } 
                           else if is_auditor { "auditor" } 
                           else { "register" };

                let note_id = Uuid::new_v4().to_string();
                self.conn.execute(
                    "INSERT INTO audit_notes (id, application_id, note, created_by, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![note_id, id, req.comment.clone().unwrap_or_default(), user.id, now]
                )?;

                self.conn.execute(
                    "INSERT INTO processing_records 
                     (id, application_id, from_status, to_status, action, 
                      handler, handler_role, comment, version_before, version_after, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    params![
                        record_id, id, app.status, app.status,
                        "note", user.id, role, req.comment,
                        app.version, app.version, now
                    ]
                )?;
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
                        evidence_required: None,
                        evidence_provided: None,
                        exception_reason: None,
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

    pub fn get_statistics(&self, user: &User) -> Result<Statistics, Box<dyn std::error::Error>> {
        let mut conditions: Vec<String> = Vec::new();
        let mut params_vec: Vec<String> = Vec::new();

        if !user.roles.contains(&"reviewer".to_string()) 
           && !user.roles.contains(&"auditor".to_string())
           && user.roles.contains(&"register".to_string()) {
            conditions.push("created_by = ?".to_string());
            params_vec.push(user.id.clone());
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
                SUM(CASE WHEN status = 'verify_failed' THEN 1 ELSE 0 END) as verify_failed,
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
