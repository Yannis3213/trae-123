use poem::web::Data;
use poem_openapi::{OpenApi, param::Query, payload::Json};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;

use crate::AppState;
use crate::models::*;
use crate::middleware::*;
use crate::db::calculate_deadline_status;

pub struct UserApi;

#[OpenApi]
impl UserApi {
    #[oai(path = "/user/current", method = "get")]
    async fn get_current_user(&self, state: Data<&Arc<AppState>>) -> Json<UserInfoApiResponse> {
        let role = state.current_role.lock().await.clone();
        let username = state.current_user.lock().await.clone();
        Json(UserInfoApiResponse {
            success: true,
            message: "ok".to_string(),
            data: Some(UserInfo {
                role_label: role_label(&role),
                role,
                username,
            }),
        })
    }

    #[oai(path = "/user/switch", method = "post")]
    async fn switch_role(&self, state: Data<&Arc<AppState>>, body: Json<SwitchRoleRequest>) -> Json<UserInfoApiResponse> {
        let mut role = state.current_role.lock().await;
        let mut user = state.current_user.lock().await;
        *role = body.role.clone();
        *user = body.username.clone();
        Json(UserInfoApiResponse {
            success: true,
            message: "切换成功".to_string(),
            data: Some(UserInfo {
                role_label: role_label(&body.role),
                role: body.role.clone(),
                username: body.username.clone(),
            }),
        })
    }
}

pub struct AppointmentApi;

#[OpenApi]
impl AppointmentApi {
    #[oai(path = "/appointments", method = "get")]
    async fn list_appointments(
        &self,
        state: Data<&Arc<AppState>>,
        status: Query<Option<String>>,
    ) -> Json<AppointmentsApiResponse> {
        let rows = sqlx::query("SELECT * FROM beauty_appointments ORDER BY created_at DESC")
            .fetch_all(&state.pool)
            .await;

        let rows = match rows {
            Ok(r) => r,
            Err(e) => return Json(AppointmentsApiResponse { success: false, message: format!("查询失败: {}", e), data: None }),
        };

        let mut normal = vec![];
        let mut approaching = vec![];
        let mut overdue = vec![];
        let mut stats = AppointmentStats {
            total: 0,
            normal_count: 0,
            approaching_count: 0,
            overdue_count: 0,
            draft_count: 0,
            pending_review_count: 0,
            archived_count: 0,
        };

        let apt_ids: Vec<String> = rows.iter()
            .filter_map(|r| r.try_get::<String, _>("id").ok())
            .collect();

        let mut evidence_map: std::collections::HashMap<String, (i64, i64, i64)> = std::collections::HashMap::new();
        if !apt_ids.is_empty() {
            let placeholders: Vec<String> = apt_ids.iter().map(|_| "?".to_string()).collect();
            let sql = format!(
                "SELECT appointment_id, evidence_type, COUNT(*) as cnt FROM appointment_attachments WHERE appointment_id IN ({}) GROUP BY appointment_id, evidence_type",
                placeholders.join(",")
            );
            let mut query = sqlx::query(&sql);
            for id in &apt_ids {
                query = query.bind(id);
            }
            if let Ok(ev_rows) = query.fetch_all(&state.pool).await {
                for ev_row in ev_rows {
                    let apt_id: String = ev_row.try_get("appointment_id").unwrap_or_default();
                    let ev_type: String = ev_row.try_get("evidence_type").unwrap_or_default();
                    let cnt: i64 = ev_row.try_get("cnt").unwrap_or(0);
                    let entry = evidence_map.entry(apt_id).or_insert((0, 0, 0));
                    match ev_type.as_str() {
                        "customer_appointment" => entry.0 = cnt,
                        "project_confirmation" => entry.1 = cnt,
                        "service_followup" => entry.2 = cnt,
                        _ => {}
                    }
                }
            }
        }

        for row in rows {
            let apt: Appointment = match Appointment::try_from_row(&row) {
                Some(a) => a,
                None => continue,
            };

            if let Some(filter_status) = status.0.as_ref() {
                if &apt.status != filter_status {
                    continue;
                }
            }

            let ev_counts = evidence_map.get(&apt.id).unwrap_or(&(0, 0, 0));
            let evidence_summary = CardEvidenceSummary {
                has_customer_appointment: ev_counts.0 > 0,
                has_project_confirmation: ev_counts.1 > 0,
                has_service_followup: ev_counts.2 > 0,
                customer_appointment_count: ev_counts.0,
                project_confirmation_count: ev_counts.1,
                service_followup_count: ev_counts.2,
            };

            let dl_status = calculate_deadline_status(&apt.deadline);
            let item = AppointmentListItem {
                deadline_status: dl_status.to_string(),
                status_label: status_label(&apt.status),
                exception_type_label: exception_type_label(&apt.exception_type),
                id: apt.id.clone(),
                order_no: apt.order_no.clone(),
                customer_name: apt.customer_name.clone(),
                service_item: apt.service_item.clone(),
                status: apt.status.clone(),
                current_handler: apt.current_handler.clone(),
                current_handler_role: apt.current_handler_role.clone(),
                deadline: apt.deadline.clone(),
                exception_type: apt.exception_type.clone(),
                beautician: apt.beautician.clone(),
                consultant: apt.consultant.clone(),
                version: apt.version,
                evidence_summary,
            };

            stats.total += 1;
            match apt.status.as_str() {
                "draft" => stats.draft_count += 1,
                "pending_review" => stats.pending_review_count += 1,
                "archived" => stats.archived_count += 1,
                _ => {}
            }

            match dl_status {
                DeadlineStatus::Normal => { stats.normal_count += 1; normal.push(item); }
                DeadlineStatus::Approaching => { stats.approaching_count += 1; approaching.push(item); }
                DeadlineStatus::Overdue => { stats.overdue_count += 1; overdue.push(item); }
            }
        }

        Json(AppointmentsApiResponse {
            success: true,
            message: "ok".to_string(),
            data: Some(AppointmentsResponse { normal, approaching, overdue, stats }),
        })
    }

    #[oai(path = "/appointments/:id", method = "get")]
    async fn get_appointment(&self, state: Data<&Arc<AppState>>, id: String) -> Json<AppointmentDetailApiResponse> {
        let apt_row = sqlx::query("SELECT * FROM beauty_appointments WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await;

        let apt_row = match apt_row {
            Ok(Some(r)) => r,
            Ok(None) => return Json(AppointmentDetailApiResponse { success: false, message: "预约单不存在".to_string(), data: None }),
            Err(e) => return Json(AppointmentDetailApiResponse { success: false, message: format!("查询失败: {}", e), data: None }),
        };

        let apt = match Appointment::try_from_row(&apt_row) {
            Some(a) => a,
            None => return Json(AppointmentDetailApiResponse { success: false, message: "数据解析失败".to_string(), data: None }),
        };

        let attachments: Vec<Attachment> = sqlx::query_as::<_, Attachment>(
            "SELECT * FROM appointment_attachments WHERE appointment_id = ? ORDER BY uploaded_at DESC"
        )
        .bind(&id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        let mut evidence_summary = EvidenceSummary {
            customer_appointment: vec![],
            project_confirmation: vec![],
            service_followup: vec![],
        };
        for att in &attachments {
            match att.evidence_type.as_str() {
                "customer_appointment" => evidence_summary.customer_appointment.push(att.clone()),
                "project_confirmation" => evidence_summary.project_confirmation.push(att.clone()),
                "service_followup" => evidence_summary.service_followup.push(att.clone()),
                _ => {}
            }
        }

        let trails_raw = sqlx::query("SELECT * FROM audit_trails WHERE appointment_id = ? ORDER BY created_at DESC")
            .bind(&id)
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default();

        let mut audit_trails = vec![];
        for row in trails_raw {
            let t = AuditTrail {
                id: row.try_get("id").unwrap_or_default(),
                appointment_id: row.try_get("appointment_id").unwrap_or_default(),
                action: row.try_get("action").unwrap_or_default(),
                action_label: action_label(&row.try_get::<String, _>("action").unwrap_or_default()),
                from_status: row.try_get("from_status").ok(),
                to_status: row.try_get("to_status").ok(),
                from_version: row.try_get("from_version").ok(),
                to_version: row.try_get("to_version").ok(),
                operator: row.try_get("operator").unwrap_or_default(),
                operator_role: row.try_get("operator_role").unwrap_or_default(),
                operator_role_label: role_label(&row.try_get::<String, _>("operator_role").unwrap_or_default()),
                remark: row.try_get("remark").ok(),
                created_at: row.try_get("created_at").unwrap_or_default(),
            };
            audit_trails.push(t);
        }

        let processing_records: Vec<ProcessingRecord> = sqlx::query_as::<_, ProcessingRecord>(
            "SELECT * FROM processing_records WHERE appointment_id = ? ORDER BY created_at DESC"
        )
        .bind(&id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        let dl_status = calculate_deadline_status(&apt.deadline);

        Json(AppointmentDetailApiResponse {
            success: true,
            message: "ok".to_string(),
            data: Some(AppointmentDetail {
                deadline_status: dl_status.to_string(),
                status_label: status_label(&apt.status),
                exception_type_label: exception_type_label(&apt.exception_type),
                appointment: apt,
                attachments,
                audit_trails,
                processing_records,
                evidence_summary,
            }),
        })
    }

    #[oai(path = "/appointments", method = "post")]
    async fn create_appointment(
        &self,
        state: Data<&Arc<AppState>>,
        body: Json<CreateAppointmentRequest>,
    ) -> Json<AppointmentApiResponse> {
        let role = state.current_role.lock().await.clone();
        if role != "beautician" {
            return Json(AppointmentApiResponse { success: false, message: "只有护理师可以新建预约单".to_string(), data: None });
        }

        let apt = body.to_appointment();

        let result = sqlx::query(
            r#"
            INSERT INTO beauty_appointments (
                id, order_no, customer_name, customer_phone, service_item,
                beautician, consultant, store_manager, status, current_handler,
                current_handler_role, appointment_time, deadline, exception_type,
                exception_reason, correction_note, version, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&apt.id)
        .bind(&apt.order_no)
        .bind(&apt.customer_name)
        .bind(&apt.customer_phone)
        .bind(&apt.service_item)
        .bind(&apt.beautician)
        .bind(&apt.consultant)
        .bind(&apt.store_manager)
        .bind(&apt.status)
        .bind(&apt.current_handler)
        .bind(&apt.current_handler_role)
        .bind(&apt.appointment_time)
        .bind(&apt.deadline)
        .bind::<Option<String>>(apt.exception_type.clone())
        .bind::<Option<String>>(apt.exception_reason.clone())
        .bind::<Option<String>>(apt.correction_note.clone())
        .bind(apt.version)
        .bind(&apt.created_at)
        .bind(&apt.updated_at)
        .execute(&state.pool)
        .await;

        if let Err(e) = result {
            return Json(AppointmentApiResponse { success: false, message: format!("创建失败: {}", e), data: None });
        }

        let username = state.current_user.lock().await.clone();
        insert_audit(&state.pool, &apt.id, "create", None, Some("draft"), None, Some(1), &username, &role, Some("新建预约单".to_string())).await;

        Json(AppointmentApiResponse { success: true, message: "创建成功".to_string(), data: Some(apt) })
    }

    #[oai(path = "/appointments/:id/process", method = "post")]
    async fn process_appointment(
        &self,
        state: Data<&Arc<AppState>>,
        id: String,
        body: Json<ProcessAppointmentRequest>,
    ) -> Json<AppointmentApiResponse> {
        let role = state.current_role.lock().await.clone();
        let username = state.current_user.lock().await.clone();

        let apt_row = match sqlx::query("SELECT * FROM beauty_appointments WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
        {
            Ok(Some(r)) => r,
            Ok(None) => return Json(AppointmentApiResponse { success: false, message: "预约单不存在".to_string(), data: None }),
            Err(e) => return Json(AppointmentApiResponse { success: false, message: format!("查询失败: {}", e), data: None }),
        };

        let apt = match Appointment::try_from_row(&apt_row) {
            Some(a) => a,
            None => return Json(AppointmentApiResponse { success: false, message: "数据解析失败".to_string(), data: None }),
        };

        if let Err(e) = validate_role_permission(&body.action, &role, &apt.status, &apt.exception_type) {
            return Json(AppointmentApiResponse { success: false, message: e.message, data: None });
        }

        if let Err(e) = validate_handler(&username, &role, &apt, &body.action) {
            return Json(AppointmentApiResponse { success: false, message: e.message, data: None });
        }

        if let Err(e) = validate_version(body.version, apt.version) {
            return Json(AppointmentApiResponse { success: false, message: e.message, data: None });
        }

        let existing_types: Vec<String> = sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT evidence_type FROM appointment_attachments WHERE appointment_id = ?"
        )
        .bind(&id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        let mut combined_types: std::collections::HashSet<String> = existing_types.iter().cloned().collect();
        for att in &body.attachments {
            combined_types.insert(att.evidence_type.clone());
        }
        let combined_types_vec: Vec<String> = combined_types.into_iter().collect();

        let required = get_required_evidence(&body.action, &apt.status);
        if let Err(e) = validate_required_evidence(&body.action, &required, &combined_types_vec) {
            return Json(AppointmentApiResponse { success: false, message: e.message, data: None });
        }

        let (new_status, new_handler, new_handler_role) = get_next_state(&body.action, &apt);
        let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let new_version = apt.version + 1;

        let (exc_type, exc_reason) = match body.action.as_str() {
            "correction_submit" => (None, None),
            "return_to_correct" => (
                Some("returned".to_string()),
                body.exception_reason.clone().or(body.remark.clone()).or(Some("退回补正".to_string())),
            ),
            _ => (
                body.exception_type.clone().or(apt.exception_type.clone()),
                body.exception_reason.clone().or(apt.exception_reason.clone()),
            ),
        };
        let corr_note = body.correction_note.clone().or(apt.correction_note.clone());

        let result = sqlx::query(
            r#"
            UPDATE beauty_appointments SET
                status = ?, current_handler = ?, current_handler_role = ?,
                exception_type = ?, exception_reason = ?, correction_note = ?,
                version = ?, updated_at = ?
            WHERE id = ? AND version = ?
            "#
        )
        .bind(&new_status)
        .bind(&new_handler)
        .bind(&new_handler_role)
        .bind(exc_type.as_ref())
        .bind(exc_reason.as_ref())
        .bind(corr_note.as_ref())
        .bind(new_version)
        .bind(&now)
        .bind(&id)
        .bind(apt.version)
        .execute(&state.pool)
        .await;

        if let Err(e) = result {
            return Json(AppointmentApiResponse { success: false, message: format!("更新失败: {}", e), data: None });
        }

        for att in &body.attachments {
            sqlx::query(
                "INSERT INTO appointment_attachments (id, appointment_id, evidence_type, file_name, file_url, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&id)
            .bind(&att.evidence_type)
            .bind(&att.file_name)
            .bind(&att.file_url)
            .bind(&username)
            .bind(&now)
            .execute(&state.pool)
            .await
            .ok();
        }

        insert_audit(&state.pool, &id, &body.action, Some(&apt.status), Some(&new_status), Some(apt.version), Some(new_version), &username, &role, body.remark.clone()).await;

        if body.action == "correction_submit" || body.action == "return_to_correct" {
            insert_processing_record(
                &state.pool,
                &id,
                &apt.order_no,
                if body.action == "correction_submit" { "correction" } else { &body.action },
                &username,
                &role,
                body.remark.as_deref(),
                exc_reason.as_deref(),
                body.correction_note.as_deref(),
                Some(apt.version),
                Some(new_version),
                None,
                body.remark.as_deref(),
                &now,
            ).await;
        }

        let updated = sqlx::query("SELECT * FROM beauty_appointments WHERE id = ?")
            .bind(&id)
            .fetch_one(&state.pool)
            .await
            .ok()
            .and_then(|r| Appointment::try_from_row(&r));

        Json(AppointmentApiResponse { success: true, message: "操作成功".to_string(), data: updated })
    }

    #[oai(path = "/appointments/batch", method = "post")]
    async fn batch_process(
        &self,
        state: Data<&Arc<AppState>>,
        body: Json<BatchProcessRequest>,
    ) -> Json<BatchProcessApiResponse> {
        let role = state.current_role.lock().await.clone();
        let username = state.current_user.lock().await.clone();

        let mut results = vec![];
        let mut success_count = 0i32;
        let mut fail_count = 0i32;

        let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        for aid in &body.appointment_ids {
            let apt_row = sqlx::query("SELECT id, order_no, status, version, current_handler, current_handler_role, beautician, consultant, store_manager, deadline, exception_type, exception_reason FROM beauty_appointments WHERE id = ?")
                .bind(aid)
                .fetch_optional(&state.pool)
                .await
                .ok()
                .flatten();

            let apt_row = match apt_row {
                Some(r) => r,
                None => {
                    fail_count += 1;
                    let msg = "预约单不存在".to_string();
                    results.push(BatchResultItem {
                        appointment_id: aid.clone(),
                        order_no: "未知".to_string(),
                        success: false,
                        message: msg.clone(),
                    });
                    insert_processing_record(&state.pool, aid, "未知", "batch_fail", &username, &role, Some(&msg), None, None, None, None, Some(&msg), body.remark.as_deref(), &now).await;
                    continue;
                }
            };

            let order_no: String = apt_row.try_get("order_no").unwrap_or_default();
            let status: String = apt_row.try_get("status").unwrap_or_default();
            let version: i64 = apt_row.try_get("version").unwrap_or(0);
            let beautician: String = apt_row.try_get("beautician").unwrap_or_default();
            let consultant: String = apt_row.try_get("consultant").unwrap_or_default();
            let store_manager: String = apt_row.try_get("store_manager").unwrap_or_default();
            let deadline: String = apt_row.try_get("deadline").unwrap_or_default();
            let exception_type: Option<String> = apt_row.try_get("exception_type").ok();
            let exception_reason: Option<String> = apt_row.try_get("exception_reason").ok();

            let dl_status = calculate_deadline_status(&deadline);

            let request_version = body.version_map.as_ref()
                .and_then(|vm| vm.get(aid))
                .and_then(|v| v.as_i64())
                .unwrap_or(version);

            if let Err(e) = validate_version(request_version, version) {
                fail_count += 1;
                results.push(BatchResultItem {
                    appointment_id: aid.clone(),
                    order_no: order_no.clone(),
                    success: false,
                    message: e.message.clone(),
                });
                insert_processing_record(&state.pool, aid, &order_no, "batch_fail", &username, &role, Some(&e.message), exception_reason.as_deref(), None, Some(version), None, Some(&e.message), body.remark.as_deref(), &now).await;
                continue;
            }

            if body.action == "archive" && dl_status == DeadlineStatus::Overdue {
                fail_count += 1;
                let msg = "逾期预约单不允许批量归档，请先处理逾期原因后逐单操作".to_string();
                results.push(BatchResultItem {
                    appointment_id: aid.clone(),
                    order_no: order_no.clone(),
                    success: false,
                    message: msg.clone(),
                });
                insert_processing_record(&state.pool, aid, &order_no, "batch_fail", &username, &role, Some(&msg), exception_reason.as_deref().or(Some("逾期未处理")), None, Some(version), None, Some(&msg), body.remark.as_deref(), &now).await;
                continue;
            }

            match validate_role_permission(&body.action, &role, &status, &exception_type) {
                Err(e) => {
                    fail_count += 1;
                    results.push(BatchResultItem {
                        appointment_id: aid.clone(),
                        order_no: order_no.clone(),
                        success: false,
                        message: e.message.clone(),
                    });
                    insert_processing_record(&state.pool, aid, &order_no, "batch_fail", &username, &role, Some(&e.message), exception_reason.as_deref(), None, Some(version), None, Some(&e.message), body.remark.as_deref(), &now).await;
                    continue;
                }
                _ => {}
            }

            let apt_stub = Appointment {
                id: aid.clone(),
                order_no: order_no.clone(),
                customer_name: String::new(),
                customer_phone: String::new(),
                service_item: String::new(),
                beautician: beautician.clone(),
                consultant: consultant.clone(),
                store_manager: store_manager.clone(),
                status: status.clone(),
                current_handler: apt_row.try_get("current_handler").unwrap_or_default(),
                current_handler_role: apt_row.try_get("current_handler_role").unwrap_or_default(),
                appointment_time: String::new(),
                deadline: deadline.clone(),
                exception_type: exception_type.clone(),
                exception_reason: exception_reason.clone(),
                correction_note: None,
                version,
                created_at: String::new(),
                updated_at: String::new(),
            };

            match validate_handler(&username, &role, &apt_stub, &body.action) {
                Err(e) => {
                    fail_count += 1;
                    results.push(BatchResultItem {
                        appointment_id: aid.clone(),
                        order_no: order_no.clone(),
                        success: false,
                        message: e.message.clone(),
                    });
                    insert_processing_record(&state.pool, aid, &order_no, "batch_fail", &username, &role, Some(&e.message), exception_reason.as_deref(), None, Some(version), None, Some(&e.message), body.remark.as_deref(), &now).await;
                    continue;
                }
                _ => {}
            }

            let existing_types: Vec<String> = sqlx::query_scalar::<_, String>(
                "SELECT DISTINCT evidence_type FROM appointment_attachments WHERE appointment_id = ?"
            )
            .bind(aid)
            .fetch_all(&state.pool)
            .await
            .unwrap_or_default();

            let mut combined_types: std::collections::HashSet<String> = existing_types.iter().cloned().collect();
            if let Some(attachments) = &body.attachments {
                for att in attachments {
                    combined_types.insert(att.evidence_type.clone());
                }
            }
            let combined_types_vec: Vec<String> = combined_types.into_iter().collect();

            let required = get_required_evidence(&body.action, &status);
            if let Err(e) = validate_required_evidence(&body.action, &required, &combined_types_vec) {
                fail_count += 1;
                results.push(BatchResultItem {
                    appointment_id: aid.clone(),
                    order_no: order_no.clone(),
                    success: false,
                    message: e.message.clone(),
                });
                insert_processing_record(&state.pool, aid, &order_no, "batch_fail", &username, &role, Some(&e.message), exception_reason.as_deref(), None, Some(version), None, Some(&e.message), body.remark.as_deref(), &now).await;
                continue;
            }

            let (new_status, new_handler, new_handler_role) = get_next_state(&body.action, &apt_stub);
            let new_version = version + 1;

            let mut new_exception_type = exception_type.clone();
            let mut new_exception_reason = exception_reason.clone();
            if body.action == "correction_submit" {
                new_exception_type = None;
                new_exception_reason = None;
            }
            if body.action == "return_to_correct" {
                new_exception_type = Some("returned".to_string());
                new_exception_reason = body.remark.clone().or(Some("批量退回补正".to_string()));
            }

            let result = sqlx::query(
                r#"
                UPDATE beauty_appointments SET
                    status = ?, current_handler = ?, current_handler_role = ?,
                    exception_type = ?, exception_reason = ?,
                    version = ?, updated_at = ?
                WHERE id = ? AND version = ?
                "#
            )
            .bind(&new_status)
            .bind(&new_handler)
            .bind(&new_handler_role)
            .bind(new_exception_type.as_ref())
            .bind(new_exception_reason.as_ref())
            .bind(new_version)
            .bind(&now)
            .bind(aid)
            .bind(version)
            .execute(&state.pool)
            .await;

            match result {
                Ok(r) => {
                    if r.rows_affected() == 0 {
                        fail_count += 1;
                        let msg = format!("版本冲突：当前版本 v{} 已过期，请刷新后重试", version);
                        results.push(BatchResultItem {
                            appointment_id: aid.clone(),
                            order_no: order_no.clone(),
                            success: false,
                            message: msg.clone(),
                        });
                        insert_processing_record(&state.pool, aid, &order_no, "batch_fail", &username, &role, Some(&msg), exception_reason.as_deref(), None, Some(version), None, Some(&msg), body.remark.as_deref(), &now).await;
                    } else {
                        success_count += 1;
                        insert_audit(&state.pool, aid, &body.action, Some(&status), Some(&new_status), Some(version), Some(new_version), &username, &role, body.remark.clone()).await;
                        if body.action == "return_to_correct" || body.action == "correction_submit" {
                            let corr_note = body.correction_note.clone();
                            insert_processing_record(&state.pool, aid, &order_no, if body.action == "correction_submit" { "correction" } else { &body.action }, &username, &role, body.remark.as_deref(), new_exception_reason.as_deref(), corr_note.as_deref(), Some(version), Some(new_version), None, body.remark.as_deref(), &now).await;
                        }
                        if let Some(attachments) = &body.attachments {
                            for att in attachments {
                                sqlx::query(
                                    r#"
                                    INSERT INTO appointment_attachments (id, appointment_id, evidence_type, file_name, file_url, uploaded_by, uploaded_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)
                                    "#
                                )
                                .bind(Uuid::new_v4().to_string())
                                .bind(aid)
                                .bind(&att.evidence_type)
                                .bind(&att.file_name)
                                .bind(&att.file_url)
                                .bind(&username)
                                .bind(&now)
                                .execute(&state.pool)
                                .await
                                .ok();
                            }
                        }
                        results.push(BatchResultItem {
                            appointment_id: aid.clone(),
                            order_no: order_no.clone(),
                            success: true,
                            message: format!("{} 操作成功", action_label(&body.action)),
                        });
                    }
                }
                Err(e) => {
                    fail_count += 1;
                    let msg = format!("执行失败: {}", e);
                    results.push(BatchResultItem {
                        appointment_id: aid.clone(),
                        order_no: order_no.clone(),
                        success: false,
                        message: msg.clone(),
                    });
                    insert_processing_record(&state.pool, aid, &order_no, "batch_fail", &username, &role, Some(&msg), exception_reason.as_deref(), None, Some(version), None, Some(&msg), body.remark.as_deref(), &now).await;
                }
            }
        }

        Json(BatchProcessApiResponse {
            success: true,
            message: "批量处理完成".to_string(),
            data: Some(BatchProcessResponse {
                total: results.len() as i32,
                success_count,
                fail_count,
                results,
            }),
        })
    }
}

fn get_next_state(action: &str, apt: &Appointment) -> (String, String, String) {
    match action {
        "submit_review" => (
            "pending_review".to_string(),
            apt.consultant.clone(),
            "consultant".to_string(),
        ),
        "review_pass" => (
            "pending_review".to_string(),
            apt.store_manager.clone(),
            "store_manager".to_string(),
        ),
        "review_reject" => (
            "draft".to_string(),
            apt.beautician.clone(),
            "beautician".to_string(),
        ),
        "return_to_correct" => (
            "pending_review".to_string(),
            apt.beautician.clone(),
            "beautician".to_string(),
        ),
        "correction_submit" => (
            "pending_review".to_string(),
            apt.consultant.clone(),
            "consultant".to_string(),
        ),
        "archive" => (
            "archived".to_string(),
            "已归档".to_string(),
            "archived".to_string(),
        ),
        _ => (apt.status.clone(), apt.current_handler.clone(), apt.current_handler_role.clone()),
    }
}

async fn insert_audit(
    pool: &sqlx::SqlitePool,
    apt_id: &str,
    action: &str,
    from_s: Option<&str>,
    to_s: Option<&str>,
    from_v: Option<i64>,
    to_v: Option<i64>,
    operator: &str,
    operator_role: &str,
    remark: Option<String>,
) {
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    sqlx::query(
        r#"
        INSERT INTO audit_trails (id, appointment_id, action, from_status, to_status, from_version, to_version, operator, operator_role, remark, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(Uuid::new_v4().to_string())
    .bind(apt_id)
    .bind(action)
    .bind(from_s)
    .bind(to_s)
    .bind(from_v)
    .bind(to_v)
    .bind(operator)
    .bind(operator_role)
    .bind(remark.as_deref())
    .bind(&now)
    .execute(pool)
    .await
    .ok();
}

async fn insert_processing_record(
    pool: &sqlx::SqlitePool,
    apt_id: &str,
    _order_no: &str,
    action: &str,
    handler: &str,
    handler_role: &str,
    detail: Option<&str>,
    exception_reason: Option<&str>,
    correction_note: Option<&str>,
    from_version: Option<i64>,
    to_version: Option<i64>,
    batch_fail_reason: Option<&str>,
    audit_remark: Option<&str>,
    now: &str,
) {
    sqlx::query(
        r#"
        INSERT INTO processing_records (id, appointment_id, action, handler, handler_role, detail, exception_reason, correction_note, from_version, to_version, batch_fail_reason, audit_remark, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(Uuid::new_v4().to_string())
    .bind(apt_id)
    .bind(action)
    .bind(handler)
    .bind(handler_role)
    .bind(detail)
    .bind(exception_reason)
    .bind(correction_note)
    .bind(from_version)
    .bind(to_version)
    .bind(batch_fail_reason)
    .bind(audit_remark)
    .bind(now)
    .execute(pool)
    .await
    .ok();
}

trait TryFromRow {
    fn try_from_row(row: &sqlx::sqlite::SqliteRow) -> Option<Self> where Self: Sized;
}

impl TryFromRow for Appointment {
    fn try_from_row(row: &sqlx::sqlite::SqliteRow) -> Option<Self> {
        Some(Appointment {
            id: row.try_get("id").ok()?,
            order_no: row.try_get("order_no").ok()?,
            customer_name: row.try_get("customer_name").ok()?,
            customer_phone: row.try_get("customer_phone").ok()?,
            service_item: row.try_get("service_item").ok()?,
            beautician: row.try_get("beautician").ok()?,
            consultant: row.try_get("consultant").ok()?,
            store_manager: row.try_get("store_manager").ok()?,
            status: row.try_get("status").ok()?,
            current_handler: row.try_get("current_handler").ok()?,
            current_handler_role: row.try_get("current_handler_role").ok()?,
            appointment_time: row.try_get("appointment_time").ok()?,
            deadline: row.try_get("deadline").ok()?,
            exception_type: row.try_get("exception_type").ok(),
            exception_reason: row.try_get("exception_reason").ok(),
            correction_note: row.try_get("correction_note").ok(),
            version: row.try_get("version").ok()?,
            created_at: row.try_get("created_at").ok()?,
            updated_at: row.try_get("updated_at").ok()?,
        })
    }
}
