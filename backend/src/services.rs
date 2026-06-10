use crate::db::DbPool;
use crate::dao::*;
use crate::errors::*;
use crate::models::*;
use chrono::{Duration, Utc};

pub struct AuthService;

impl AuthService {
    pub fn login(pool: &DbPool, username: &str) -> AppResult<LoginResponse> {
        let user = UserDao::get_by_username(pool, username)?
            .ok_or_else(|| AppError::Unauthorized(format!("用户 {} 不存在", username)))?;
        Ok(LoginResponse {
            token: format!("token-{}", user.id),
            user,
        })
    }

    pub fn get_user_from_token(pool: &DbPool, token: &str) -> AppResult<User> {
        let token = token.trim_start_matches("Bearer ").trim_start_matches("token-");
        UserDao::get_by_id(pool, token)?
            .ok_or_else(|| AppError::Unauthorized("无效的 token".into()))
    }
}

pub struct WorkflowService;

impl WorkflowService {
    pub fn next_handler_for_transition(
        pool: &DbPool,
        from_status: ApplicationStatus,
        action: &str,
        current_app: &ReplenishmentApplication,
    ) -> AppResult<(ApplicationStatus, String)> {
        let all_users = UserDao::list_all(pool)?;
        let find_user = |role: UserRole| -> AppResult<String> {
            all_users
                .iter()
                .find(|u| u.role == role)
                .map(|u| u.id.clone())
                .ok_or_else(|| AppError::Database(format!("未找到角色 {:?} 的用户", role)))
        };

        match (from_status, action) {
            (ApplicationStatus::Draft, "submit") => {
                let handler = find_user(UserRole::OperationsSupervisor)?;
                Ok((ApplicationStatus::PendingSignature, handler))
            }
            (ApplicationStatus::PendingSignature, "sign") => {
                let handler = find_user(UserRole::HeadquartersOperations)?;
                Ok((ApplicationStatus::PendingSignature, handler))
            }
            (ApplicationStatus::PendingSignature, "return") => {
                let handler = current_app.created_by.clone();
                Ok((ApplicationStatus::ExceptionReturned, handler))
            }
            (ApplicationStatus::ExceptionReturned, "correct") => {
                let handler = find_user(UserRole::OperationsSupervisor)?;
                Ok((ApplicationStatus::CorrectionPending, handler))
            }
            (ApplicationStatus::CorrectionPending, "recheck") => {
                let handler = find_user(UserRole::HeadquartersOperations)?;
                Ok((ApplicationStatus::PendingSignature, handler))
            }
            (ApplicationStatus::PendingSignature, "complete") => {
                let handler = find_user(UserRole::ChainReviewLead)?;
                Ok((ApplicationStatus::SignatureComplete, handler))
            }
            (ApplicationStatus::SignatureComplete, "archive") => {
                Ok((ApplicationStatus::Archived, current_app.current_handler.clone()))
            }
            _ => Err(AppError::StatusConflict(format!(
                "不支持的状态流转: 从 {:?} 执行 {}",
                from_status, action
            ))),
        }
    }

    pub fn can_user_perform_action(user: &User, app: &ReplenishmentApplication, action: &str) -> bool {
        if user.id != app.current_handler && app.status != ApplicationStatus::Draft {
            return false;
        }
        match (user.role, app.status, action) {
            (UserRole::StoreManager, ApplicationStatus::Draft, "submit") => true,
            (UserRole::ReplenishmentRegistrar, ApplicationStatus::Draft, "submit") => true,
            (UserRole::OperationsSupervisor, ApplicationStatus::PendingSignature, "sign") => true,
            (UserRole::OperationsSupervisor, ApplicationStatus::PendingSignature, "return") => true,
            (UserRole::HeadquartersOperations, ApplicationStatus::PendingSignature, "complete") => true,
            (UserRole::HeadquartersOperations, ApplicationStatus::PendingSignature, "return") => true,
            (UserRole::StoreManager, ApplicationStatus::ExceptionReturned, "correct") => true,
            (UserRole::ReplenishmentRegistrar, ApplicationStatus::ExceptionReturned, "correct") => true,
            (UserRole::OperationsSupervisor, ApplicationStatus::CorrectionPending, "recheck") => true,
            (UserRole::ReplenishmentAuditor, ApplicationStatus::CorrectionPending, "recheck") => true,
            (UserRole::ChainReviewLead, ApplicationStatus::SignatureComplete, "archive") => true,
            _ => false,
        }
    }

    pub fn validate_evidence_for_action(
        action: &str,
        req: &ProcessRequest,
        attachments: &[Attachment],
    ) -> AppResult<()> {
        match action {
            "sign" | "complete" => {
                if req.result.is_none() || req.result.as_ref().unwrap().is_empty() {
                    return Err(AppError::MissingEvidence("办理结果不能为空".into()));
                }
            }
            "return" => {
                if req.return_reason.is_none() || req.return_reason.as_ref().unwrap().is_empty() {
                    return Err(AppError::MissingEvidence("退回原因不能为空".into()));
                }
            }
            "correct" => {
                if attachments.is_empty() {
                    return Err(AppError::MissingEvidence("补正必须上传附件作为证据".into()));
                }
            }
            "archive" => {
                if req.result.is_none() || req.result.as_ref().unwrap().is_empty() {
                    return Err(AppError::MissingEvidence("归档复核意见不能为空".into()));
                }
            }
            _ => {}
        }
        Ok(())
    }
}

pub struct ApplicationService;

impl ApplicationService {
    pub fn process_application(
        pool: &DbPool,
        current_user: &User,
        req: ProcessRequest,
    ) -> AppResult<ReplenishmentApplication> {
        let app = ApplicationDao::get_by_id(pool, &req.application_id)?
            .ok_or_else(|| AppError::NotFound(format!("申请单 {} 不存在", req.application_id)))?;

        if !WorkflowService::can_user_perform_action(current_user, &app, &req.action) {
            return Err(AppError::Forbidden(format!(
                "用户 {}({:?}) 无权在状态 {:?} 下执行 {}",
                current_user.display_name, current_user.role, app.status, req.action
            )));
        }

        if app.status == ApplicationStatus::Archived {
            return Err(AppError::StatusConflict("已归档的申请不能再操作".into()));
        }

        let attachments = AttachmentDao::list_by_application(pool, &app.id)?;
        WorkflowService::validate_evidence_for_action(&req.action, &req, &attachments)?;

        let (new_status, new_handler) = WorkflowService::next_handler_for_transition(
            pool,
            app.status,
            &req.action,
            &app,
        )?;

        let mut new_tags = app.exception_tags.clone();
        if req.action == "return" {
            new_tags.push("异常退回".to_string());
        }
        if req.action == "correct" {
            new_tags.retain(|t| t != "异常退回");
            new_tags.push("已补正".to_string());
        }

        let new_version = ApplicationDao::update_status_and_version(
            pool,
            &app.id,
            new_status,
            &new_handler,
            req.current_version,
            Some(new_tags),
        )?;

        let record = ProcessingRecord {
            id: new_uuid(),
            application_id: app.id.clone(),
            from_status: Some(app.status),
            to_status: new_status,
            action: req.action.clone(),
            operator_id: current_user.id.clone(),
            operator_name: current_user.display_name.clone(),
            result: req.result,
            return_reason: req.return_reason,
            processed_at: Utc::now(),
        };
        ProcessingRecordDao::create(pool, &record)?;

        let mut updated = ApplicationDao::get_by_id(pool, &app.id)?.unwrap();
        updated.version = new_version;
        Ok(updated)
    }

    pub fn batch_process(
        pool: &DbPool,
        current_user: &User,
        batch_req: BatchProcessRequest,
    ) -> AppResult<BatchProcessResponse> {
        let mut results = Vec::new();
        let mut success_count = 0usize;
        let mut fail_count = 0usize;

        for item in batch_req.items {
            let app_result = ApplicationDao::get_by_id(pool, &item.application_id);
            let (app_id, app_no) = match app_result {
                Ok(Some(app)) => (app.id.clone(), app.application_no.clone()),
                Ok(None) => {
                    fail_count += 1;
                    results.push(BatchResultItem {
                        application_id: item.application_id.clone(),
                        application_no: "UNKNOWN".into(),
                        success: false,
                        message: format!("申请单不存在"),
                    });
                    continue;
                }
                Err(e) => {
                    fail_count += 1;
                    results.push(BatchResultItem {
                        application_id: item.application_id.clone(),
                        application_no: "UNKNOWN".into(),
                        success: false,
                        message: format!("系统错误: {}", e),
                    });
                    continue;
                }
            };

            if let Ok(Some(app)) = ApplicationDao::get_by_id(pool, &item.application_id) {
                if app.is_overdue {
                    fail_count += 1;
                    results.push(BatchResultItem {
                        application_id: app_id,
                        application_no: app_no,
                        success: false,
                        message: "已逾期，禁止批量推进，请逐条处理并留下补正记录".into(),
                    });
                    let exc_log = ExceptionLog {
                        id: new_uuid(),
                        application_id: item.application_id.clone(),
                        exception_type: "批量拦截".into(),
                        description: "逾期批量推进被拦截，需手动处理".into(),
                        operator_id: Some(current_user.id.clone()),
                        created_at: Utc::now(),
                    };
                    ExceptionLogDao::create(pool, &exc_log).ok();
                    continue;
                }
            }

            let req = ProcessRequest {
                application_id: item.application_id.clone(),
                action: item.action.clone(),
                result: item.result.clone(),
                return_reason: item.return_reason.clone(),
                evidence_required: vec![],
                current_version: item.current_version,
            };

            match Self::process_application(pool, current_user, req) {
                Ok(_) => {
                    success_count += 1;
                    results.push(BatchResultItem {
                        application_id: app_id,
                        application_no: app_no,
                        success: true,
                        message: "处理成功".into(),
                    });
                }
                Err(e) => {
                    fail_count += 1;
                    results.push(BatchResultItem {
                        application_id: app_id,
                        application_no: app_no,
                        success: false,
                        message: e.to_string(),
                    });
                }
            }
        }

        Ok(BatchProcessResponse {
            results,
            total_success: success_count,
            total_failed: fail_count,
        })
    }

    pub fn get_detail(pool: &DbPool, id: &str, _user: &User) -> AppResult<ApplicationDetail> {
        let application = ApplicationDao::get_by_id(pool, id)?
            .ok_or_else(|| AppError::NotFound(format!("申请单 {} 不存在", id)))?;
        let attachments = AttachmentDao::list_by_application(pool, id)?;
        let processing_records = ProcessingRecordDao::list_by_application(pool, id)?;
        let audit_notes = AuditNoteDao::list_by_application(pool, id)?;
        let exception_logs = ExceptionLogDao::list_by_application(pool, id)?;
        Ok(ApplicationDetail {
            application,
            attachments,
            processing_records,
            audit_notes,
            exception_logs,
        })
    }

    pub fn add_audit_note(
        pool: &DbPool,
        app_id: &str,
        note_text: &str,
        current_user: &User,
    ) -> AppResult<AuditNote> {
        let note = AuditNote {
            id: new_uuid(),
            application_id: app_id.into(),
            author_id: current_user.id.clone(),
            author_name: current_user.display_name.clone(),
            note: note_text.into(),
            created_at: Utc::now(),
        };
        AuditNoteDao::create(pool, &note)?;
        Ok(note)
    }
}

pub struct SeedService;

impl SeedService {
    pub fn seed(pool: &DbPool) -> AppResult<()> {
        let now = Utc::now();

        let users = vec![
            ("u1", "store_manager_wang", "王店长", UserRole::StoreManager),
            ("u2", "operations_supervisor_li", "李督导", UserRole::OperationsSupervisor),
            ("u3", "hq_ops_zhang", "张运营", UserRole::HeadquartersOperations),
            ("u4", "registrar_chen", "陈登记员", UserRole::ReplenishmentRegistrar),
            ("u5", "auditor_zhao", "赵审核", UserRole::ReplenishmentAuditor),
            ("u6", "review_lead_sun", "孙复核", UserRole::ChainReviewLead),
        ];
        for (id, uname, dname, role) in &users {
            crate::db::insert_user(
                &pool.get()?,
                id,
                uname,
                dname,
                role.as_str(),
                &now.to_rfc3339(),
            )?;
        }

        let applications = vec![
            (
                "app1", "RP-2026-06-001", "store001", "朝阳便利店",
                "日常月底补货申请", "饮料、零食类月底常规补货",
                ApplicationStatus::PendingSignature, Priority::High, "u1", "u2",
                now + Duration::hours(20), false,
            ),
            (
                "app2", "RP-2026-06-002", "store002", "海淀便利店",
                "临期饮料促销后紧急补货", "上周促销活动后饮料库存告急",
                ApplicationStatus::ExceptionReturned, Priority::Urgent, "u4", "u1",
                now - Duration::hours(2), true,
            ),
            (
                "app3", "RP-2026-06-003", "store003", "西城便利店",
                "新开门店首月补货", "新开门店月底首批集中补货",
                ApplicationStatus::Draft, Priority::Medium, "u1", "u1",
                now + Duration::hours(48), false,
            ),
            (
                "app4", "RP-2026-06-004", "store004", "东城便利店",
                "夏季冷饮专项补货", "气温升高冷饮销量激增",
                ApplicationStatus::SignatureComplete, Priority::High, "u1", "u6",
                now + Duration::hours(5), false,
            ),
        ];

        for (id, no, store_id, store_name, title, desc, status, priority, resp, handler, deadline, overdue) in &applications {
            let tags: Vec<String> = if *overdue {
                vec!["已逾期".into()]
            } else if *status == ApplicationStatus::ExceptionReturned {
                vec!["异常退回".into()]
            } else if *status == ApplicationStatus::SignatureComplete {
                vec!["待复核归档".into()]
            } else {
                vec![]
            };
            let app = ReplenishmentApplication {
                id: (*id).into(),
                application_no: (*no).into(),
                store_id: (*store_id).into(),
                store_name: (*store_name).into(),
                title: (*title).into(),
                description: (*desc).into(),
                status: *status,
                priority: *priority,
                responsible_person: (*resp).into(),
                current_handler: (*handler).into(),
                deadline: *deadline,
                version: 1,
                created_by: (*resp).into(),
                created_at: now - Duration::hours(6),
                updated_at: now - Duration::hours(2),
                exception_tags: tags,
                is_overdue: *overdue,
                is_near_deadline: deadline.signed_duration_since(now).num_hours() < 24,
            };
            ApplicationDao::create(pool, &app)?;

            let atts = vec![
                ("att1-".to_string() + id, id, "补货清单.xlsx", "application/vnd.ms-excel", resp),
                ("att2-".to_string() + id, id, "库存照片.jpg", "image/jpeg", resp),
            ];
            for (aid, pid, fname, ftype, by) in &atts {
                AttachmentDao::create(pool, &Attachment {
                    id: aid.clone(),
                    application_id: (*pid).into(),
                    file_name: (*fname).into(),
                    file_type: (*ftype).into(),
                    uploaded_by: (*by).into(),
                    uploaded_at: now - Duration::hours(5),
                })?;
            }

            let record = ProcessingRecord {
                id: "rec1-".to_string() + id,
                application_id: (*id).into(),
                from_status: None,
                to_status: *status,
                action: "创建".into(),
                operator_id: (*resp).into(),
                operator_name: if resp == "u1" { "王店长" } else { "陈登记员" }.into(),
                result: Some("已创建申请单".into()),
                return_reason: None,
                processed_at: now - Duration::hours(6),
            };
            ProcessingRecordDao::create(pool, &record)?;

            if *status == ApplicationStatus::ExceptionReturned {
                let ret_record = ProcessingRecord {
                    id: "rec2-".to_string() + id,
                    application_id: (*id).into(),
                    from_status: Some(ApplicationStatus::PendingSignature),
                    to_status: ApplicationStatus::ExceptionReturned,
                    action: "return".into(),
                    operator_id: "u2".into(),
                    operator_name: "李督导".into(),
                    result: None,
                    return_reason: Some("缺少库存明细附件，请补正后重新提交".into()),
                    processed_at: now - Duration::hours(3),
                };
                ProcessingRecordDao::create(pool, &ret_record)?;
                let exc_log = ExceptionLog {
                    id: "exc1-".to_string() + id,
                    application_id: (*id).into(),
                    exception_type: "材料缺失".into(),
                    description: "李督导退回：缺少库存明细附件，请补正后重新提交".into(),
                    operator_id: Some("u2".into()),
                    created_at: now - Duration::hours(3),
                };
                ExceptionLogDao::create(pool, &exc_log)?;
            }
        }

        Ok(())
    }
}
