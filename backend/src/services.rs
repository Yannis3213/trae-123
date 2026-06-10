use crate::db::DbPool;
use crate::dao::*;
use crate::errors::*;
use crate::models::*;
use chrono::{DateTime, Duration, Utc};

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
    pub fn can_create(role: UserRole) -> bool {
        matches!(
            role,
            UserRole::StoreManager | UserRole::ReplenishmentRegistrar
        )
    }

    pub fn can_process(role: UserRole) -> bool {
        matches!(
            role,
            UserRole::StoreManager
                | UserRole::OperationsSupervisor
                | UserRole::HeadquartersOperations
                | UserRole::ReplenishmentRegistrar
                | UserRole::ReplenishmentAuditor
                | UserRole::ChainReviewLead
        )
    }

    pub fn can_view_all(role: UserRole) -> bool {
        matches!(
            role,
            UserRole::HeadquartersOperations | UserRole::ReplenishmentAuditor | UserRole::ChainReviewLead
        )
    }

    pub fn allowed_actions_for_role(role: UserRole) -> Vec<String> {
        let mut actions: Vec<String> = Vec::new();
        match role {
            UserRole::StoreManager | UserRole::ReplenishmentRegistrar => {
                actions.push("submit".into());
                actions.push("correct".into());
                actions.push("create".into());
                actions.push("上传附件".into());
            }
            UserRole::OperationsSupervisor => {
                actions.push("sign".into());
                actions.push("return".into());
                actions.push("recheck".into());
                actions.push("上传附件".into());
            }
            UserRole::ReplenishmentAuditor => {
                actions.push("sign".into());
                actions.push("return".into());
                actions.push("recheck".into());
                actions.push("上传附件".into());
            }
            UserRole::HeadquartersOperations => {
                actions.push("complete".into());
                actions.push("return".into());
                actions.push("archive".into());
                actions.push("上传附件".into());
            }
            UserRole::ChainReviewLead => {
                actions.push("recheck".into());
                actions.push("return".into());
                actions.push("archive".into());
                actions.push("上传附件".into());
            }
        }
        actions
    }

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
        if !Self::allowed_actions_for_role(user.role).iter().any(|a| a == action) && action != "上传附件" {
            return false;
        }
        let is_related = user.id == app.current_handler
            || user.id == app.created_by
            || user.id == app.responsible_person;
        match action {
            "submit" | "correct" => {
                if !is_related {
                    return false;
                }
            }
            "archive" => {
                if user.id != app.current_handler {
                    return false;
                }
            }
            _ => {
                if user.id != app.current_handler && app.status != ApplicationStatus::Draft {
                    return false;
                }
            }
        }
        match (user.role, app.status, action) {
            (UserRole::StoreManager, ApplicationStatus::Draft, "submit") => true,
            (UserRole::ReplenishmentRegistrar, ApplicationStatus::Draft, "submit") => true,
            (UserRole::OperationsSupervisor, ApplicationStatus::PendingSignature, "sign") => true,
            (UserRole::OperationsSupervisor, ApplicationStatus::PendingSignature, "return") => true,
            (UserRole::ReplenishmentAuditor, ApplicationStatus::PendingSignature, "sign") => true,
            (UserRole::ReplenishmentAuditor, ApplicationStatus::PendingSignature, "return") => true,
            (UserRole::HeadquartersOperations, ApplicationStatus::PendingSignature, "complete") => true,
            (UserRole::HeadquartersOperations, ApplicationStatus::PendingSignature, "return") => true,
            (UserRole::StoreManager, ApplicationStatus::ExceptionReturned, "correct") => true,
            (UserRole::ReplenishmentRegistrar, ApplicationStatus::ExceptionReturned, "correct") => true,
            (UserRole::OperationsSupervisor, ApplicationStatus::CorrectionPending, "recheck") => true,
            (UserRole::ReplenishmentAuditor, ApplicationStatus::CorrectionPending, "recheck") => true,
            (UserRole::ChainReviewLead, ApplicationStatus::CorrectionPending, "recheck") => true,
            (UserRole::ChainReviewLead, ApplicationStatus::CorrectionPending, "return") => true,
            (UserRole::HeadquartersOperations, ApplicationStatus::SignatureComplete, "archive") => true,
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
                let evidence_atts: Vec<&Attachment> = attachments.iter().filter(|a| a.is_evidence).collect();
                if evidence_atts.is_empty() {
                    return Err(AppError::MissingEvidence(
                        "补正必须上传 is_evidence=true 的有效附件（需在异常回传或待补正状态下上传的附件）".into()
                    ));
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
            TraceService::log_exception(
                pool,
                &app.id,
                "越权尝试",
                &format!(
                    "用户 {}({:?}) 尝试在状态 {:?} 下执行 {}，被权限规则拦截",
                    current_user.display_name, current_user.role, app.status, req.action
                ),
                Some(&current_user.id),
            );
            return Err(AppError::Forbidden(format!(
                "用户 {}({:?}) 无权在状态 {:?} 下执行 {}",
                current_user.display_name, current_user.role, app.status, req.action
            )));
        }

        if app.status == ApplicationStatus::Archived {
            TraceService::log_exception(
                pool,
                &app.id,
                "状态冲突-已归档",
                &format!(
                    "用户 {} 尝试对已归档单据执行 {}",
                    current_user.display_name, req.action
                ),
                Some(&current_user.id),
            );
            return Err(AppError::StatusConflict("已归档的申请不能再操作".into()));
        }

        let attachments = AttachmentDao::list_by_application(pool, &app.id)?;
        if let Err(e) = WorkflowService::validate_evidence_for_action(&req.action, &req, &attachments)
        {
            TraceService::log_exception(
                pool,
                &app.id,
                "缺证据/缺材料",
                &format!("动作 {} 校验失败：{}", req.action, e),
                Some(&current_user.id),
            );
            return Err(e);
        }

        let transition = WorkflowService::next_handler_for_transition(
            pool,
            app.status,
            &req.action,
            &app,
        );
        let (new_status, new_handler) = match transition {
            Ok(t) => t,
            Err(e) => {
                TraceService::log_exception(
                    pool,
                    &app.id,
                    "状态流转冲突",
                    &format!(
                        "从 {:?} 执行 {} 不被允许：{}",
                        app.status, req.action, e
                    ),
                    Some(&current_user.id),
                );
                return Err(e);
            }
        };

        let mut new_tags = app.exception_tags.clone();
        if req.action == "return" {
            new_tags.push("异常退回".to_string());
        }
        if req.action == "correct" {
            new_tags.retain(|t| t != "异常退回");
            new_tags.push("已补正".to_string());
        }

        let update_result = ApplicationDao::update_status_and_version(
            pool,
            &app.id,
            new_status,
            &new_handler,
            req.current_version,
            Some(new_tags),
        );
        let new_version = match update_result {
            Ok(v) => v,
            Err(AppError::VersionConflict(given, expected)) => {
                TraceService::log_exception(
                    pool,
                    &app.id,
                    "版本冲突(乐观锁)",
                    &format!(
                        "用户 {} 提交旧版本 {}，DB 已到版本 {}，拦截避免静默覆盖",
                        current_user.display_name, given, expected
                    ),
                    Some(&current_user.id),
                );
                return Err(AppError::VersionConflict(given, expected));
            }
            Err(e) => return Err(e),
        };

        if app.is_overdue && req.action != "correct" {
            TraceService::log_exception(
                pool,
                &app.id,
                "逾期操作",
                &format!(
                    "用户 {} 在截止时间已过的情况下执行 {}（仍允许，但已留痕）",
                    current_user.display_name, req.action
                ),
                Some(&current_user.id),
            );
        }

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
                    let msg = "已逾期，禁止批量推进，请逐条处理并留下补正记录";
                    results.push(BatchResultItem {
                        application_id: app_id.clone(),
                        application_no: app_no.clone(),
                        success: false,
                        message: msg.into(),
                    });
                    TraceService::log_exception(
                        pool,
                        &item.application_id,
                        "批量拦截-逾期",
                        &format!(
                            "用户 {} 在批量 {} 时拦截单据 {}（{}），已逾期需逐条补正",
                            current_user.display_name, item.action, app_no, app.title
                        ),
                        Some(&current_user.id),
                    );
                    let _ = TraceService::record_timeline(
                        pool,
                        &item.application_id,
                        Some(app.status),
                        app.status,
                        "批量拦截",
                        current_user,
                        Some(format!("批量 {} 被拦截：{}", item.action, msg)),
                        None,
                    );
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

    pub fn get_detail(pool: &DbPool, id: &str, user: &User) -> AppResult<ApplicationDetail> {
        let application = ApplicationDao::get_by_id(pool, id)?
            .ok_or_else(|| AppError::NotFound(format!("申请单 {} 不存在", id)))?;

        let can_view = WorkflowService::can_view_all(user.role)
            || application.current_handler == user.id
            || application.created_by == user.id
            || application.responsible_person == user.id;
        if !can_view {
            return Err(AppError::Forbidden(format!(
                "用户 {} 无权查看申请单 {}（非处理人/创建人/责任人，且角色无全局查看权限）",
                user.display_name, application.application_no
            )));
        }

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
            (
                "app5", "RP-2026-06-005", "store005", "丰台便利店",
                "已补正-待复核", "冷饮缺货退回补正后待复核",
                ApplicationStatus::CorrectionPending, Priority::High, "u4", "u2",
                now + Duration::hours(18), false,
            ),
        ];

        for (id, no, store_id, store_name, title, desc, status, priority, resp, handler, deadline, overdue) in &applications {
            let tags: Vec<String> = if *overdue {
                vec!["已逾期".into()]
            } else if *status == ApplicationStatus::ExceptionReturned {
                vec!["异常退回".into()]
            } else if *status == ApplicationStatus::CorrectionPending {
                vec!["异常退回".into(), "已补正附件".into()]
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

            if id == "app5" {
                for (aid, fname, ftype, by, is_ev, content) in vec![
                    ("att1-app5", "补货清单.xlsx", "application/vnd.ms-excel", "u4", false, None),
                    ("att2-app5", "库存明细补正.jpg", "image/jpeg", "u4", true, Some("SGVsbG8gV29ybGQgQmFzZTY0IENvbnRlbnQgZm9yIEFwcDU=".into())),
                ] {
                    AttachmentDao::create(pool, &Attachment {
                        id: aid.into(),
                        application_id: "app5".into(),
                        file_name: fname.into(),
                        file_type: ftype.into(),
                        uploaded_by: by.into(),
                        uploaded_at: now - Duration::hours(1),
                        is_evidence: is_ev,
                        file_content_base64: content,
                    })?;
                }
            } else {
                for (aid, fname, ftype, by) in vec![
                    ("att1-".to_string() + id, "补货清单.xlsx", "application/vnd.ms-excel", resp),
                    ("att2-".to_string() + id, "库存照片.jpg", "image/jpeg", resp),
                ] {
                    AttachmentDao::create(pool, &Attachment {
                        id: aid.clone(),
                        application_id: (*id).into(),
                        file_name: fname.into(),
                        file_type: ftype.into(),
                        uploaded_by: (*by).into(),
                        uploaded_at: now - Duration::hours(5),
                        is_evidence: false,
                        file_content_base64: None,
                    })?;
                }
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

            if *status == ApplicationStatus::CorrectionPending {
                let ret_record = ProcessingRecord {
                    id: "rec2-".to_string() + id,
                    application_id: (*id).into(),
                    from_status: Some(ApplicationStatus::PendingSignature),
                    to_status: ApplicationStatus::ExceptionReturned,
                    action: "return".into(),
                    operator_id: "u2".into(),
                    operator_name: "李督导".into(),
                    result: None,
                    return_reason: Some("库存明细不完整，需补正".into()),
                    processed_at: now - Duration::hours(5),
                };
                ProcessingRecordDao::create(pool, &ret_record)?;
                let exc_log_ret = ExceptionLog {
                    id: "exc1-".to_string() + id,
                    application_id: (*id).into(),
                    exception_type: "材料缺失".into(),
                    description: "李督导退回：库存明细不完整，需补正".into(),
                    operator_id: Some("u2".into()),
                    created_at: now - Duration::hours(5),
                };
                ExceptionLogDao::create(pool, &exc_log_ret)?;
                let cor_record = ProcessingRecord {
                    id: "rec3-".to_string() + id,
                    application_id: (*id).into(),
                    from_status: Some(ApplicationStatus::ExceptionReturned),
                    to_status: ApplicationStatus::CorrectionPending,
                    action: "correct".into(),
                    operator_id: "u4".into(),
                    operator_name: "陈登记员".into(),
                    result: Some("已上传补正附件库存明细补正.jpg".into()),
                    return_reason: None,
                    processed_at: now - Duration::hours(1),
                };
                ProcessingRecordDao::create(pool, &cor_record)?;
                let exc_log_cor = ExceptionLog {
                    id: "exc2-".to_string() + id,
                    application_id: (*id).into(),
                    exception_type: "补正附件上传".into(),
                    description: "陈登记员上传了补正附件 库存明细补正.jpg（is_evidence=true，已持久化 file_content_base64 至 SQLite）".into(),
                    operator_id: Some("u4".into()),
                    created_at: now - Duration::hours(1),
                };
                ExceptionLogDao::create(pool, &exc_log_cor)?;
            }
        }

        Ok(())
    }
}

pub struct ScopeService;

impl ScopeService {
    pub fn get_visible_scope(user: &User) -> VisibleScope {
        VisibleScope {
            can_create: WorkflowService::can_create(user.role),
            can_process: WorkflowService::can_process(user.role),
            can_view_all: WorkflowService::can_view_all(user.role),
            allowed_actions: WorkflowService::allowed_actions_for_role(user.role),
        }
    }
}

pub struct TraceService;

impl TraceService {
    pub fn log_exception(
        pool: &DbPool,
        application_id: &str,
        exception_type: &str,
        description: &str,
        operator_id: Option<&str>,
    ) {
        let log = ExceptionLog {
            id: new_uuid(),
            application_id: application_id.into(),
            exception_type: exception_type.into(),
            description: description.into(),
            operator_id: operator_id.map(|s| s.into()),
            created_at: Utc::now(),
        };
        let _ = ExceptionLogDao::create(pool, &log);
    }

    pub fn record_timeline(
        pool: &DbPool,
        application_id: &str,
        from_status: Option<ApplicationStatus>,
        to_status: ApplicationStatus,
        action: &str,
        operator: &User,
        result: Option<String>,
        return_reason: Option<String>,
    ) -> AppResult<()> {
        let record = ProcessingRecord {
            id: new_uuid(),
            application_id: application_id.into(),
            from_status,
            to_status,
            action: action.into(),
            operator_id: operator.id.clone(),
            operator_name: operator.display_name.clone(),
            result,
            return_reason,
            processed_at: Utc::now(),
        };
        ProcessingRecordDao::create(pool, &record)
    }
}

impl ApplicationService {
    pub fn create_application(
        pool: &DbPool,
        current_user: &User,
        req: CreateApplicationRequest,
    ) -> AppResult<ReplenishmentApplication> {
        if !WorkflowService::can_create(current_user.role) {
            return Err(AppError::Forbidden(format!(
                "角色 {:?} 无权创建补货申请",
                current_user.role
            )));
        }
        if req.title.trim().is_empty() {
            return Err(AppError::Validation("标题不能为空".into()));
        }
        if req.store_id.trim().is_empty() || req.store_name.trim().is_empty() {
            return Err(AppError::Validation("门店信息不能为空".into()));
        }
        let deadline = DateTime::parse_from_rfc3339(&req.deadline)
            .map(|d| d.with_timezone(&Utc))
            .map_err(|_| AppError::Validation("截止时间格式错误，请使用 RFC3339".into()))?;
        if deadline <= Utc::now() {
            return Err(AppError::Validation("截止时间必须晚于当前时间".into()));
        }

        let application_no = next_application_no(pool)?;
        let now = Utc::now();
        let id = new_uuid();
        let app = ReplenishmentApplication {
            id: id.clone(),
            application_no,
            store_id: req.store_id,
            store_name: req.store_name,
            title: req.title,
            description: req.description,
            status: ApplicationStatus::Draft,
            priority: req.priority,
            responsible_person: current_user.id.clone(),
            current_handler: current_user.id.clone(),
            deadline,
            version: 1,
            created_by: current_user.id.clone(),
            created_at: now,
            updated_at: now,
            exception_tags: vec![],
            is_overdue: false,
            is_near_deadline: false,
        };
        ApplicationDao::create(pool, &app)?;

        TraceService::record_timeline(
            pool,
            &id,
            None,
            ApplicationStatus::Draft,
            "创建",
            current_user,
            Some("已创建新补货申请".into()),
            None,
        )?;

        ApplicationDao::get_by_id(pool, &id)?
            .ok_or_else(|| AppError::NotFound("创建后读取失败".into()))
    }

    pub fn upload_attachment(
        pool: &DbPool,
        current_user: &User,
        req: AttachmentUploadRequest,
    ) -> AppResult<Attachment> {
        let app = ApplicationDao::get_by_id(pool, &req.application_id)?
            .ok_or_else(|| AppError::NotFound(format!("申请单 {} 不存在", req.application_id)))?;
        if app.current_handler != current_user.id {
            TraceService::log_exception(
                pool,
                &req.application_id,
                "越权-上传附件",
                &format!(
                    "用户 {} 尝试上传附件，但当前处理人为 {}",
                    current_user.display_name, app.current_handler
                ),
                Some(&current_user.id),
            );
            return Err(AppError::Forbidden(format!(
                "只有当前处理人可以上传附件"
            )));
        }
        if app.status == ApplicationStatus::Archived {
            return Err(AppError::StatusConflict("已归档单据不能再上传附件".into()));
        }
        if req.file_name.trim().is_empty() {
            return Err(AppError::Validation("文件名不能为空".into()));
        }
        let is_evidence = matches!(
            app.status,
            ApplicationStatus::ExceptionReturned | ApplicationStatus::CorrectionPending
        );
        if is_evidence && req.file_content_base64.is_none() {
            TraceService::log_exception(
                pool,
                &req.application_id,
                "缺补正证据",
                &format!(
                    "用户 {} 在 {:?} 状态上传附件但未提供 base64 内容",
                    current_user.display_name, app.status
                ),
                Some(&current_user.id),
            );
            return Err(AppError::MissingEvidence(
                "补正/异常状态下必须提供文件内容作为补正证据".into(),
            ));
        }

        let att = Attachment {
            id: new_uuid(),
            application_id: req.application_id.clone(),
            file_name: req.file_name,
            file_type: req.file_type,
            uploaded_by: current_user.id.clone(),
            uploaded_at: Utc::now(),
            is_evidence,
            file_content_base64: req.file_content_base64.clone(),
        };
        AttachmentDao::create(pool, &att)?;

        TraceService::record_timeline(
            pool,
            &req.application_id,
            Some(app.status),
            app.status,
            if is_evidence { "补正附件上传" } else { "上传附件" },
            current_user,
            Some(format!(
                "上传附件：{}{}",
                att.file_name,
                if is_evidence { "（作为补正证据已入SQLite可追溯）" } else { "" }
            )),
            None,
        )?;

        if is_evidence {
            let mut tags = app.exception_tags.clone();
            tags.retain(|t| t != "异常退回");
            if !tags.iter().any(|t| t == "已补正附件") {
                tags.push("已补正附件".into());
            }
            let _ = ApplicationDao::update_status_and_version(
                pool,
                &app.id,
                app.status,
                &app.current_handler,
                app.version,
                Some(tags),
            );
            TraceService::log_exception(
                pool,
                &app.id,
                "补正附件上传",
                &format!(
                    "{} 上传了补正附件 {}（is_evidence=true，已持久化 file_content_base64 至 SQLite）",
                    current_user.display_name, att.file_name
                ),
                Some(&current_user.id),
            );
        }

        Ok(att)
    }
}
