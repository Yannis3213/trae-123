use chrono::{Local, NaiveDate, Utc};
use rusqlite::params;
use std::sync::Arc;
use uuid::Uuid;

use crate::db::Database;
use crate::models::*;

pub struct CarePlanService {
    pub db: Arc<Database>,
}

impl CarePlanService {
    pub fn new(db: Arc<Database>) -> Self {
        CarePlanService { db }
    }

    fn calc_warning_level(&self, deadline: &str) -> WarningLevel {
        if let Ok(d) = NaiveDate::parse_from_str(deadline, "%Y-%m-%d") {
            let today = Local::now().date_naive();
            let diff = (d - today).num_days();
            if diff < 0 {
                WarningLevel::Overdue
            } else if diff <= 3 {
                WarningLevel::Approaching
            } else {
                WarningLevel::Normal
            }
        } else {
            WarningLevel::Normal
        }
    }

    fn row_to_plan(&self, row: &rusqlite::Row) -> Result<CarePlan, rusqlite::Error> {
        let deadline: String = row.get(9)?;
        Ok(CarePlan {
            id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
            plan_no: row.get(1)?,
            elder_name: row.get(2)?,
            elder_id_card: row.get(3)?,
            room_no: row.get(4)?,
            admission_date: row.get(5)?,
            status: PlanStatus::from_str(&row.get::<_, String>(6)?).unwrap_or(PlanStatus::PendingDispatch),
            current_handler: row.get(7)?,
            responsible_person: row.get(8)?,
            deadline: deadline.clone(),
            version: row.get(10)?,
            assessment_done: row.get::<_, i32>(11)? != 0,
            assessment_note: row.get(12)?,
            plan_done: row.get::<_, i32>(13)? != 0,
            plan_note: row.get(14)?,
            family_confirmed: row.get::<_, i32>(15)? != 0,
            family_note: row.get(16)?,
            created_at: row.get(17)?,
            updated_at: row.get(18)?,
            warning_level: Some(self.calc_warning_level(&deadline)),
        })
    }

    pub fn authenticate(&self, token: &str) -> Option<User> {
        self.db.get_user_by_token(token)
    }

    pub fn list_plans(&self, user: &User, query: &PlanListQuery) -> Vec<CarePlan> {
        let conn = self.db.conn.lock().unwrap();
        let mut sql = String::from(
            "SELECT id, plan_no, elder_name, elder_id_card, room_no, admission_date,
             status, current_handler, responsible_person, deadline, version,
             assessment_done, assessment_note, plan_done, plan_note,
             family_confirmed, family_note, created_at, updated_at FROM care_plans WHERE 1=1"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        let mut param_idx = 1i32;

        match user.role {
            Role::Registrar => {
                sql.push_str(&format!(" AND (status IN ('待派发', '处理中') AND current_handler = ?{})", param_idx));
                params.push(Box::new(user.display_name.clone()));
                param_idx += 1;
            }
            Role::Supervisor => {
                sql.push_str(&format!(" AND status = '处理中' AND current_handler = ?{}", param_idx));
                params.push(Box::new(user.display_name.clone()));
                param_idx += 1;
            }
            Role::Director => {
                sql.push_str(&format!(" AND ((status = '处理中' AND current_handler = ?{}) OR status = '已关闭')", param_idx));
                params.push(Box::new(user.display_name.clone()));
                param_idx += 1;
            }
        }

        if let Some(s) = &query.status {
            if !s.is_empty() {
                sql.push_str(&format!(" AND status = ?{}", param_idx));
                params.push(Box::new(s.clone()));
                param_idx += 1;
            }
        }
        if let Some(kw) = &query.keyword {
            if !kw.is_empty() {
                let like_kw = format!("%{}%", kw);
                sql.push_str(&format!(" AND (elder_name LIKE ?{} OR plan_no LIKE ?{} OR room_no LIKE ?{})", param_idx, param_idx + 1, param_idx + 2));
                params.push(Box::new(like_kw.clone()));
                params.push(Box::new(like_kw.clone()));
                params.push(Box::new(like_kw));
                param_idx += 3;
            }
        }

        sql.push_str(" ORDER BY deadline ASC, created_at DESC");

        let mut stmt = conn.prepare(&sql).unwrap();
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let plan_iter = stmt.query_map(param_refs.as_slice(), |row| self.row_to_plan(row)).unwrap();

        let mut plans: Vec<CarePlan> = Vec::new();
        for p in plan_iter {
            if let Ok(mut plan) = p {
                if let Some(w) = &query.warning {
                    if !w.is_empty() {
                        if let Some(level) = &plan.warning_level {
                            let level_str = match level {
                                WarningLevel::Normal => "正常",
                                WarningLevel::Approaching => "临期",
                                WarningLevel::Overdue => "逾期",
                            };
                            if level_str != w.as_str() {
                                continue;
                            }
                        }
                    }
                }
                plans.push(plan);
            }
        }
        plans
    }

    pub fn get_plan(&self, user: &User, plan_id: Uuid) -> Option<CarePlan> {
        let plan: Option<CarePlan> = {
            let conn = self.db.conn.lock().unwrap();
            let mut stmt = conn.prepare(
                "SELECT id, plan_no, elder_name, elder_id_card, room_no, admission_date,
                 status, current_handler, responsible_person, deadline, version,
                 assessment_done, assessment_note, plan_done, plan_note,
                 family_confirmed, family_note, created_at, updated_at
                 FROM care_plans WHERE id = ?1"
            ).unwrap();
            stmt.query_row(params![plan_id.to_string()], |row| self.row_to_plan(row)).ok()
        };

        if let Some(p) = &plan {
            let allowed = match user.role {
                Role::Registrar => {
                    p.current_handler == user.display_name || p.status == PlanStatus::PendingDispatch
                }
                Role::Supervisor => {
                    p.status == PlanStatus::InProgress && p.current_handler == user.display_name
                }
                Role::Director => {
                    (p.status == PlanStatus::InProgress && p.current_handler == user.display_name)
                        || p.status == PlanStatus::Closed
                }
            };
            if !allowed {
                self.write_failure(plan_id, user, "查看计划单详情", p.status.to_str(), "越权操作",
                    &format!("越权访问：角色[{}]非当前处理人不可查看该计划单，当前处理人为{}，状态为{}",
                        user.role.to_str(), p.current_handler, p.status.to_str()), None);
                return None;
            }
        }
        plan
    }

    pub fn get_attachments(&self, plan_id: Uuid) -> Vec<Attachment> {
        let conn = self.db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, care_plan_id, file_name, file_type, uploaded_by, uploaded_at
             FROM attachments WHERE care_plan_id = ?1 ORDER BY uploaded_at DESC"
        ).unwrap();
        let iter = stmt.query_map(params![plan_id.to_string()], |row| {
            Ok(Attachment {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                care_plan_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap(),
                file_name: row.get(2)?,
                file_type: row.get(3)?,
                uploaded_by: row.get(4)?,
                uploaded_at: row.get(5)?,
            })
        }).unwrap();
        iter.filter_map(|r| r.ok()).collect()
    }

    pub fn get_processing_records(&self, plan_id: Uuid) -> Vec<ProcessingRecord> {
        let conn = self.db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, care_plan_id, action, operator, operator_role, prev_status, new_status, remark, created_at
             FROM processing_records WHERE care_plan_id = ?1 ORDER BY created_at DESC"
        ).unwrap();
        let iter = stmt.query_map(params![plan_id.to_string()], |row| {
            Ok(ProcessingRecord {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                care_plan_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap(),
                action: row.get(2)?,
                operator: row.get(3)?,
                operator_role: row.get(4)?,
                prev_status: row.get(5)?,
                new_status: row.get(6)?,
                remark: row.get(7)?,
                created_at: row.get(8)?,
            })
        }).unwrap();
        iter.filter_map(|r| r.ok()).collect()
    }

    pub fn get_audit_notes(&self, plan_id: Uuid) -> Vec<AuditNote> {
        let conn = self.db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, care_plan_id, operator, operator_role, action, prev_status, new_status,
             success, failure_reason, remark, created_at
             FROM audit_notes WHERE care_plan_id = ?1 ORDER BY created_at DESC"
        ).unwrap();
        let iter = stmt.query_map(params![plan_id.to_string()], |row| {
            Ok(AuditNote {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                care_plan_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap(),
                operator: row.get(2)?,
                operator_role: row.get(3)?,
                action: row.get(4)?,
                prev_status: row.get(5)?,
                new_status: row.get(6)?,
                success: row.get::<_, i32>(7)? != 0,
                failure_reason: row.get(8)?,
                remark: row.get(9)?,
                created_at: row.get(10)?,
            })
        }).unwrap();
        iter.filter_map(|r| r.ok()).collect()
    }

    pub fn get_exceptions(&self, plan_id: Uuid) -> Vec<ExceptionReason> {
        let conn = self.db.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, care_plan_id, exception_type, description, operator, resolved, created_at, resolved_at
             FROM exception_reasons WHERE care_plan_id = ?1 ORDER BY created_at DESC"
        ).unwrap();
        let iter = stmt.query_map(params![plan_id.to_string()], |row| {
            Ok(ExceptionReason {
                id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
                care_plan_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap(),
                exception_type: row.get(2)?,
                description: row.get(3)?,
                operator: row.get(4)?,
                resolved: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                resolved_at: row.get(7)?,
            })
        }).unwrap();
        iter.filter_map(|r| r.ok()).collect()
    }

    fn write_audit(&self, plan_id: Uuid, user: &User, action: &str, prev: &str, new: &str, success: bool, failure: Option<&str>, remark: Option<&str>) {
        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO audit_notes (id, care_plan_id, operator, operator_role, action, prev_status, new_status, success, failure_reason, remark, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                Uuid::new_v4().to_string(),
                plan_id.to_string(),
                user.display_name,
                user.role.display_name(),
                action, prev, new,
                success as i32,
                failure, remark, now
            ],
        ).unwrap();
    }

    fn write_processing(&self, plan_id: Uuid, user: &User, action: &str, prev: &str, new: &str, remark: Option<&str>) {
        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO processing_records (id, care_plan_id, action, operator, operator_role, prev_status, new_status, remark, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                Uuid::new_v4().to_string(),
                plan_id.to_string(),
                action,
                user.display_name,
                user.role.display_name(),
                prev, new, remark, now
            ],
        ).unwrap();
    }

    fn write_exception(&self, plan_id: Uuid, ex_type: &str, desc: &str, operator: &str) {
        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO exception_reasons (id, care_plan_id, exception_type, description, operator, resolved, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)",
            params![Uuid::new_v4().to_string(), plan_id.to_string(), ex_type, desc, operator, now],
        ).unwrap();
    }

    fn write_failure(&self, plan_id: Uuid, user: &User, action: &str, prev_status: &str, ex_type: &str, failure: &str, remark: Option<&str>) {
        self.write_processing(plan_id, user, &format!("{}（失败）", action), prev_status, prev_status, Some(failure));
        self.write_audit(plan_id, user, action, prev_status, prev_status, false, Some(failure), remark);
        self.write_exception(plan_id, ex_type, failure, &user.display_name);
    }

    pub fn upload_attachment(&self, user: &User, plan_id: Uuid, req: &UploadAttachmentRequest) -> Result<Attachment, (u16, String)> {
        let plan = match self.get_plan(user, plan_id) {
            Some(p) => p,
            None => return Err((404, "护理计划单不存在".to_string())),
        };
        if plan.status == PlanStatus::Closed {
            self.write_failure(plan_id, user, "上传附件", plan.status.to_str(), "状态冲突", "状态冲突：已关闭计划单不可上传附件", None);
            return Err((409, "计划单已关闭，不可上传附件".to_string()));
        }
        if plan.current_handler != user.display_name && !matches!(user.role, Role::Director) {
            self.write_failure(plan_id, user, "上传附件", plan.status.to_str(), "越权操作", &format!("越权操作：非当前处理人不可上传附件，当前处理人为{}", plan.current_handler), None);
            return Err((403, "当前角色无权限上传附件".to_string()));
        }
        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        let att_id = Uuid::new_v4();
        conn.execute(
            "INSERT INTO attachments (id, care_plan_id, file_name, file_type, uploaded_by, uploaded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![att_id.to_string(), plan_id.to_string(), req.file_name, req.file_type, user.display_name, now],
        ).unwrap();
        drop(conn);
        self.write_audit(plan_id, user, "上传附件", plan.status.to_str(), plan.status.to_str(), true, None, Some(&format!("上传：{}", req.file_name)));
        Ok(Attachment {
            id: att_id,
            care_plan_id: plan_id,
            file_name: req.file_name.clone(),
            file_type: req.file_type.clone(),
            uploaded_by: user.display_name.clone(),
            uploaded_at: now,
        })
    }

    pub fn create_plan(&self, user: &User, req: &CreatePlanRequest) -> Result<CarePlan, (u16, String)> {
        if !matches!(user.role, Role::Registrar) {
            self.write_audit(Uuid::nil(), user, "发起计划单", "", "", false, Some("越权操作：非登记员角色不可发起计划单"), None);
            return Err((403, "当前角色无权限执行该操作".to_string()));
        }

        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        let plan_id = Uuid::new_v4();
        let plan_no = format!("HLJH-{}-{}", Local::now().format("%Y"), rand_4digits());

        conn.execute(
            r#"INSERT INTO care_plans (
                id, plan_no, elder_name, elder_id_card, room_no, admission_date,
                status, current_handler, responsible_person, deadline, version,
                assessment_done, assessment_note, plan_done, plan_note,
                family_confirmed, family_note, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, '待派发', ?7, ?7, ?8, 1, 0, NULL, 0, NULL, 0, NULL, ?9, ?9)"#,
            params![
                plan_id.to_string(), plan_no, req.elder_name, req.elder_id_card,
                req.room_no, req.admission_date, user.display_name, req.deadline, now
            ],
        ).unwrap();

        drop(conn);
        self.write_processing(plan_id, user, "发起计划单", "-", "待派发", None);
        self.write_audit(plan_id, user, "发起计划单", "-", "待派发", true, None, None);
        self.get_plan(user, plan_id).ok_or((500, "创建后查询失败".to_string()))
    }

    pub fn update_plan(&self, user: &User, plan_id: Uuid, req: &UpdatePlanRequest) -> Result<CarePlan, (u16, String)> {
        let plan = match self.get_plan(user, plan_id) {
            Some(p) => p,
            None => return Err((404, "护理计划单不存在".to_string())),
        };

        if plan.version != req.version {
            self.write_failure(plan_id, user, "更新计划单", plan.status.to_str(), "版本冲突",
                &format!("版本冲突：提交版本{}，当前版本{}", req.version, plan.version), req.remark.as_deref());
            return Err((409, "版本冲突，请刷新页面后重试".to_string()));
        }

        if plan.status == PlanStatus::Closed {
            self.write_failure(plan_id, user, "更新计划单", plan.status.to_str(), "状态冲突",
                "状态冲突：计划单已关闭，不可更新", req.remark.as_deref());
            return Err((409, "当前状态不允许该操作，期望状态：待派发或处理中".to_string()));
        }

        if plan.current_handler != user.display_name && !matches!(user.role, Role::Director) {
            self.write_failure(plan_id, user, "更新计划单", plan.status.to_str(), "越权操作",
                &format!("越权操作：非当前处理人不可更新，当前处理人为{}", plan.current_handler), req.remark.as_deref());
            return Err((403, "当前角色无权限执行该操作".to_string()));
        }

        if let Some(fc) = req.family_confirmed {
            if fc {
                let atts = self.get_attachments(plan_id);
                let has_family = atts.iter().any(|a| a.file_type.contains("family") || a.file_name.contains("家属") || a.file_name.contains("签字"));
                if !has_family {
                    self.write_failure(plan_id, user, "更新计划单", plan.status.to_str(), "缺少证据",
                        "缺少必填证据：家属签字确认单", req.remark.as_deref());
                    return Err((400, "缺少必填证据：家属签字确认单".to_string()));
                }
            }
        }

        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        let new_version = plan.version + 1;

        conn.execute(
            r#"UPDATE care_plans SET
                assessment_done = COALESCE(?1, assessment_done),
                assessment_note = COALESCE(?2, assessment_note),
                plan_done = COALESCE(?3, plan_done),
                plan_note = COALESCE(?4, plan_note),
                family_confirmed = COALESCE(?5, family_confirmed),
                family_note = COALESCE(?6, family_note),
                version = ?7,
                updated_at = ?8
                WHERE id = ?9"#,
            params![
                req.assessment_done.map(|v| v as i32),
                req.assessment_note,
                req.plan_done.map(|v| v as i32),
                req.plan_note,
                req.family_confirmed.map(|v| v as i32),
                req.family_note,
                new_version, now, plan_id.to_string()
            ],
        ).unwrap();
        drop(conn);

        self.write_processing(plan_id, user, "更新计划单", plan.status.to_str(), plan.status.to_str(), req.remark.as_deref());
        self.write_audit(plan_id, user, "更新计划单", plan.status.to_str(), plan.status.to_str(), true, None, req.remark.as_deref());
        self.get_plan(user, plan_id).ok_or((500, "更新后查询失败".to_string()))
    }

    pub fn dispatch_plan(&self, user: &User, plan_id: Uuid, req: &ActionRequest) -> Result<CarePlan, (u16, String)> {
        let plan = match self.get_plan(user, plan_id) {
            Some(p) => p,
            None => return Err((404, "护理计划单不存在".to_string())),
        };
        if !matches!(user.role, Role::Registrar) {
            self.write_failure(plan_id, user, "派发计划单", plan.status.to_str(), "越权操作",
                "越权操作：非登记员角色不可派发", req.remark.as_deref());
            return Err((403, "当前角色无权限执行该操作".to_string()));
        }
        if plan.current_handler != user.display_name {
            self.write_failure(plan_id, user, "派发计划单", plan.status.to_str(), "越权操作",
                &format!("越权操作：非当前处理人不可派发，当前处理人为{}", plan.current_handler), req.remark.as_deref());
            return Err((403, "当前角色无权限执行该操作".to_string()));
        }
        if plan.status != PlanStatus::PendingDispatch {
            self.write_failure(plan_id, user, "派发计划单", plan.status.to_str(), "状态冲突",
                &format!("状态冲突：当前状态{}，期望状态：待派发", plan.status.to_str()), req.remark.as_deref());
            return Err((409, "当前状态不允许该操作，期望状态：待派发".to_string()));
        }
        if plan.version != req.version {
            self.write_failure(plan_id, user, "派发计划单", plan.status.to_str(), "版本冲突",
                &format!("版本冲突：提交版本{}，当前版本{}", req.version, plan.version), req.remark.as_deref());
            return Err((409, "版本冲突，请刷新页面后重试".to_string()));
        }

        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE care_plans SET status = '处理中', current_handler = '王主管', responsible_person = '王主管', version = version + 1, updated_at = ?1 WHERE id = ?2",
            params![now, plan_id.to_string()],
        ).unwrap();
        drop(conn);

        self.write_processing(plan_id, user, "派发至审核主管", "待派发", "处理中", req.remark.as_deref());
        self.write_audit(plan_id, user, "派发计划单", "待派发", "处理中", true, None, req.remark.as_deref());
        self.get_plan(user, plan_id).ok_or((500, "派发后查询失败".to_string()))
    }

    pub fn submit_plan(&self, user: &User, plan_id: Uuid, req: &ActionRequest) -> Result<CarePlan, (u16, String)> {
        let plan = match self.get_plan(user, plan_id) {
            Some(p) => p,
            None => return Err((404, "护理计划单不存在".to_string())),
        };
        if !matches!(user.role, Role::Supervisor) {
            self.write_failure(plan_id, user, "提交复核", plan.status.to_str(), "越权操作",
                "越权操作：非主管角色不可提交复核", req.remark.as_deref());
            return Err((403, "当前角色无权限执行该操作".to_string()));
        }
        if plan.current_handler != user.display_name {
            self.write_failure(plan_id, user, "提交复核", plan.status.to_str(), "越权操作",
                &format!("越权操作：非当前处理人不可提交复核，当前处理人为{}", plan.current_handler), req.remark.as_deref());
            return Err((403, "当前角色无权限执行该操作".to_string()));
        }
        if plan.status != PlanStatus::InProgress {
            self.write_failure(plan_id, user, "提交复核", plan.status.to_str(), "状态冲突",
                &format!("状态冲突：当前状态{}，期望状态：处理中", plan.status.to_str()), req.remark.as_deref());
            return Err((409, "当前状态不允许该操作，期望状态：处理中".to_string()));
        }
        if plan.version != req.version {
            self.write_failure(plan_id, user, "提交复核", plan.status.to_str(), "版本冲突",
                &format!("版本冲突：提交版本{}，当前版本{}", req.version, plan.version), req.remark.as_deref());
            return Err((409, "版本冲突，请刷新页面后重试".to_string()));
        }
        if !plan.assessment_done || !plan.plan_done {
            self.write_failure(plan_id, user, "提交复核", plan.status.to_str(), "缺少证据",
                "缺少必填证据：入住评估或护理计划未完成", req.remark.as_deref());
            return Err((400, "缺少必填证据：入住评估和护理计划必须全部完成".to_string()));
        }

        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE care_plans SET current_handler = '张主任', responsible_person = '张主任', version = version + 1, updated_at = ?1 WHERE id = ?2",
            params![now, plan_id.to_string()],
        ).unwrap();
        drop(conn);

        self.write_processing(plan_id, user, "提交至院区主任复核", "处理中", "处理中", req.remark.as_deref());
        self.write_audit(plan_id, user, "提交复核", "处理中", "处理中", true, None, req.remark.as_deref());
        self.get_plan(user, plan_id).ok_or((500, "提交后查询失败".to_string()))
    }

    pub fn review_plan(&self, user: &User, plan_id: Uuid, req: &ActionRequest) -> Result<CarePlan, (u16, String)> {
        let plan = match self.get_plan(user, plan_id) {
            Some(p) => p,
            None => return Err((404, "护理计划单不存在".to_string())),
        };
        if !matches!(user.role, Role::Director) {
            self.write_failure(plan_id, user, "复核归档", plan.status.to_str(), "越权操作",
                "越权操作：非院区主任角色不可复核归档", req.remark.as_deref());
            return Err((403, "当前角色无权限执行该操作".to_string()));
        }
        if plan.current_handler != user.display_name {
            self.write_failure(plan_id, user, "复核归档", plan.status.to_str(), "越权操作",
                &format!("越权操作：非当前处理人不可复核归档，当前处理人为{}", plan.current_handler), req.remark.as_deref());
            return Err((403, "当前角色无权限执行该操作".to_string()));
        }
        if plan.status != PlanStatus::InProgress {
            self.write_failure(plan_id, user, "复核归档", plan.status.to_str(), "状态冲突",
                &format!("状态冲突：当前状态{}，期望状态：处理中", plan.status.to_str()), req.remark.as_deref());
            return Err((409, "当前状态不允许该操作，期望状态：处理中".to_string()));
        }
        if plan.version != req.version {
            self.write_failure(plan_id, user, "复核归档", plan.status.to_str(), "版本冲突",
                &format!("版本冲突：提交版本{}，当前版本{}", req.version, plan.version), req.remark.as_deref());
            return Err((409, "版本冲突，请刷新页面后重试".to_string()));
        }
        if !plan.family_confirmed {
            self.write_failure(plan_id, user, "复核归档", plan.status.to_str(), "缺少证据",
                "缺少必填证据：家属确认未完成", req.remark.as_deref());
            return Err((400, "缺少必填证据：家属确认必须完成".to_string()));
        }

        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE care_plans SET status = '已关闭', version = version + 1, updated_at = ?1 WHERE id = ?2",
            params![now, plan_id.to_string()],
        ).unwrap();
        drop(conn);

        self.write_processing(plan_id, user, "院区主任复核通过，归档关闭", "处理中", "已关闭", req.remark.as_deref());
        self.write_audit(plan_id, user, "复核归档", "处理中", "已关闭", true, None, req.remark.as_deref());
        self.get_plan(user, plan_id).ok_or((500, "归档后查询失败".to_string()))
    }

    pub fn return_plan(&self, user: &User, plan_id: Uuid, req: &ReturnRequest) -> Result<CarePlan, (u16, String)> {
        let plan = match self.get_plan(user, plan_id) {
            Some(p) => p,
            None => return Err((404, "护理计划单不存在".to_string())),
        };
        if plan.status == PlanStatus::Closed {
            self.write_failure(plan_id, user, "退回补正", plan.status.to_str(), "状态冲突",
                "状态冲突：计划单已关闭，不可退回", Some(&req.remark));
            return Err((409, "当前状态不允许该操作".to_string()));
        }
        if plan.version != req.version {
            self.write_failure(plan_id, user, "退回补正", plan.status.to_str(), "版本冲突",
                &format!("版本冲突：提交版本{}，当前版本{}", req.version, plan.version), Some(&req.remark));
            return Err((409, "版本冲突，请刷新页面后重试".to_string()));
        }
        if plan.current_handler != user.display_name {
            self.write_failure(plan_id, user, "退回补正", plan.status.to_str(), "越权操作",
                &format!("越权操作：非当前处理人不可退回，当前处理人为{}", plan.current_handler), Some(&req.remark));
            return Err((403, "当前角色或状态不允许执行退回操作".to_string()));
        }

        let (next_handler, next_resp, allowed) = match user.role {
            Role::Supervisor => {
                if plan.status != PlanStatus::InProgress {
                    (String::new(), String::new(), false)
                } else {
                    ("李登记".to_string(), "李登记".to_string(), true)
                }
            }
            Role::Director => {
                if plan.status != PlanStatus::InProgress {
                    (String::new(), String::new(), false)
                } else {
                    ("王主管".to_string(), "王主管".to_string(), true)
                }
            }
            _ => (String::new(), String::new(), false),
        };

        if !allowed {
            self.write_failure(plan_id, user, "退回补正", plan.status.to_str(), "越权操作",
                "越权操作或状态不允许退回", Some(&req.remark));
            return Err((403, "当前角色或状态不允许执行退回操作".to_string()));
        }

        let conn = self.db.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE care_plans SET current_handler = ?1, responsible_person = ?2, version = version + 1, updated_at = ?3 WHERE id = ?4",
            params![next_handler, next_resp, now, plan_id.to_string()],
        ).unwrap();
        drop(conn);

        let action = match user.role {
            Role::Supervisor => "主管退回登记员补正",
            Role::Director => "主任退回主管补正",
            _ => "退回补正",
        };
        self.write_exception(plan_id, "退回补正", &req.remark, &user.display_name);
        self.write_processing(plan_id, user, action, "处理中", "处理中", Some(&req.remark));
        self.write_audit(plan_id, user, "退回补正", plan.status.to_str(), plan.status.to_str(), true, None, Some(&req.remark));
        self.get_plan(user, plan_id).ok_or((500, "退回后查询失败".to_string()))
    }

    pub fn batch_action(&self, user: &User, req: &BatchRequest) -> Vec<BatchResult> {
        let mut results = Vec::new();
        for pid in &req.plan_ids {
            let plan_opt = self.get_plan(user, *pid);
            let plan_no = plan_opt.as_ref().map(|p| p.plan_no.clone()).unwrap_or("未知".to_string());
            let elder_name = plan_opt.as_ref().map(|p| p.elder_name.clone()).unwrap_or("未知老人".to_string());

            if let Some(plan) = &plan_opt {
                if plan.current_handler != user.display_name && !matches!(user.role, Role::Director) {
                    let failure_msg = format!("越权：当前处理人为{}，非本人操作被拦截", plan.current_handler);
                    self.write_failure(*pid, user, &format!("批量{}", req.action), plan.status.to_str(), "越权操作",
                        &format!("越权操作：非当前处理人，当前处理人为{}", plan.current_handler), req.remark.as_deref());
                    results.push(BatchResult {
                        plan_id: *pid,
                        plan_no: plan_no.clone(),
                        elder_name: elder_name.clone(),
                        success: false,
                        message: failure_msg,
                    });
                    continue;
                }
                if matches!(plan.warning_level, Some(WarningLevel::Overdue)) {
                    let failure_msg = format!("逾期拦截：截止日{}，责任人{}，需先处理逾期原因再推进", plan.deadline, plan.responsible_person);
                    self.write_failure(*pid, user, &format!("批量{}", req.action), plan.status.to_str(), "批量逾期拦截",
                        &format!("逾期拦截：截止日期{}，责任人为{}", plan.deadline, plan.responsible_person), req.remark.as_deref());
                    results.push(BatchResult {
                        plan_id: *pid,
                        plan_no: plan_no.clone(),
                        elder_name: elder_name.clone(),
                        success: false,
                        message: failure_msg,
                    });
                    continue;
                }
            }

            let result = match req.action.as_str() {
                "dispatch" => {
                    let ar = ActionRequest { remark: req.remark.clone(), version: plan_opt.as_ref().map(|p| p.version).unwrap_or(1) };
                    match self.dispatch_plan(user, *pid, &ar) {
                        Ok(_) => BatchResult { plan_id: *pid, plan_no, elder_name, success: true, message: "派发成功".to_string() },
                        Err((_, msg)) => BatchResult { plan_id: *pid, plan_no, elder_name, success: false, message: msg },
                    }
                }
                "submit" => {
                    let ar = ActionRequest { remark: req.remark.clone(), version: plan_opt.as_ref().map(|p| p.version).unwrap_or(1) };
                    match self.submit_plan(user, *pid, &ar) {
                        Ok(_) => BatchResult { plan_id: *pid, plan_no, elder_name, success: true, message: "提交复核成功".to_string() },
                        Err((_, msg)) => BatchResult { plan_id: *pid, plan_no, elder_name, success: false, message: msg },
                    }
                }
                "review" => {
                    let ar = ActionRequest { remark: req.remark.clone(), version: plan_opt.as_ref().map(|p| p.version).unwrap_or(1) };
                    match self.review_plan(user, *pid, &ar) {
                        Ok(_) => BatchResult { plan_id: *pid, plan_no, elder_name, success: true, message: "复核归档成功".to_string() },
                        Err((_, msg)) => BatchResult { plan_id: *pid, plan_no, elder_name, success: false, message: msg },
                    }
                }
                _ => BatchResult { plan_id: *pid, plan_no, elder_name, success: false, message: "不支持的批量操作".to_string() },
            };
            results.push(result);
        }
        results
    }

    pub fn export_csv(&self, user: &User, query: &PlanListQuery) -> String {
        let plans = self.list_plans(user, query);
        let export_time = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let mut wtr = csv::Writer::from_writer(Vec::new());
        wtr.write_record(["导出说明"]).unwrap();
        wtr.write_record([&format!("数据时间：{}，共导出{}条记录", export_time, plans.len())]).unwrap();
        wtr.write_record([""]).unwrap();
        wtr.write_record([
            "计划单号", "老人姓名", "身份证号", "房间号", "入住日期",
            "当前状态", "当前处理人", "责任人", "截止日期", "预警级别",
            "入住评估", "护理计划", "家属确认", "版本号", "创建时间"
        ]).unwrap();

        for p in &plans {
            let warning = match p.warning_level.as_ref() {
                Some(WarningLevel::Normal) => "正常",
                Some(WarningLevel::Approaching) => "临期",
                Some(WarningLevel::Overdue) => "逾期",
                None => "-",
            };
            wtr.write_record([
                &p.plan_no, &p.elder_name, &p.elder_id_card, &p.room_no, &p.admission_date,
                p.status.to_str(), &p.current_handler, &p.responsible_person, &p.deadline, warning,
                if p.assessment_done { "已完成" } else { "未完成" },
                if p.plan_done { "已完成" } else { "未完成" },
                if p.family_confirmed { "已确认" } else { "未确认" },
                &p.version.to_string(), &p.created_at
            ]).unwrap();
        }
        wtr.flush().unwrap();
        String::from_utf8(wtr.into_inner().unwrap()).unwrap_or_default()
    }

    pub fn get_stats(&self, user: &User) -> serde_json::Value {
        let plans = self.list_plans(user, &PlanListQuery { status: None, warning: None, keyword: None });
        let total = plans.len();
        let pending = plans.iter().filter(|p| p.status == PlanStatus::PendingDispatch).count();
        let in_progress = plans.iter().filter(|p| p.status == PlanStatus::InProgress).count();
        let closed = plans.iter().filter(|p| p.status == PlanStatus::Closed).count();
        let normal = plans.iter().filter(|p| matches!(p.warning_level, Some(WarningLevel::Normal))).count();
        let approaching = plans.iter().filter(|p| matches!(p.warning_level, Some(WarningLevel::Approaching))).count();
        let overdue = plans.iter().filter(|p| matches!(p.warning_level, Some(WarningLevel::Overdue))).count();

        serde_json::json!({
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "closed": closed,
            "warning_normal": normal,
            "warning_approaching": approaching,
            "warning_overdue": overdue,
        })
    }
}

fn rand_4digits() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u32;
    format!("{:04}", ts % 10000)
}
