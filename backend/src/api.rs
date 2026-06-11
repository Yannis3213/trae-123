use poem_openapi::param::{Header, Path, Query};
use poem_openapi::payload::Json;
use poem_openapi::{OpenApi};
use sqlx::Pool;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::db;
use crate::error::{ApiError, ApiResult};
use crate::models::*;

fn extract_user(
    x_user_id: &Option<String>,
    x_username: &Option<String>,
    x_role: &Option<String>,
    x_name: &Option<String>,
) -> Result<User, ApiError> {
    let id = x_user_id.clone().ok_or_else(|| {
        ApiError::Unauthorized(Json(crate::error::ErrorResponse {
            code: 401,
            message: "缺少 X-User-Id 头".to_string(),
            details: None,
        }))
    })?;
    let username = x_username.clone().ok_or_else(|| {
        ApiError::Unauthorized(Json(crate::error::ErrorResponse {
            code: 401,
            message: "缺少 X-Username 头".to_string(),
            details: None,
        }))
    })?;
    let role = x_role.clone().unwrap_or_else(|| "agent".to_string());
    let name = x_name.clone().unwrap_or_else(|| username.clone());

    let r = Role::from_str(&role).unwrap_or(Role::Agent);
    Ok(User {
        id,
        username,
        role: role.clone(),
        role_display: r.display_name().to_string(),
        name,
    })
}

pub struct Api {
    pub pool: Arc<RwLock<Pool<sqlx::Sqlite>>>,
}

#[OpenApi]
impl Api {
    #[oai(path = "/api/auth/login", method = "post", tag = "认证")]
    async fn login(&self, req: Json<LoginRequest>) -> ApiResult<Json<LoginResponse>> {
        let pool = self.pool.read().await;
        let user = db::verify_user(&pool, &req.username, &req.password)
            .await
            .map_err(ApiError::from)?
            .ok_or_else(|| {
                ApiError::Unauthorized(Json(crate::error::ErrorResponse {
                    code: 401,
                    message: "用户名或密码错误".to_string(),
                    details: None,
                }))
            })?;

        let token = format!("token_{}_{}", user.id, user.username);
        Ok(Json(LoginResponse { user, token }))
    }

    #[oai(path = "/api/users", method = "get", tag = "用户")]
    async fn list_users(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
    ) -> ApiResult<Json<Vec<User>>> {
        let _user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let users = db::list_users(&pool).await.map_err(ApiError::from)?;
        Ok(Json(users))
    }

    #[oai(path = "/api/tickets", method = "get", tag = "客服工单")]
    async fn list_tickets(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
        status: Query<Option<String>>,
        priority: Query<Option<String>>,
        keyword: Query<Option<String>>,
        only_my: Query<Option<bool>>,
        page: Query<Option<i64>>,
        page_size: Query<Option<i64>>,
    ) -> ApiResult<Json<TicketListResponse>> {
        let user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let resp = db::list_tickets(
            &pool,
            &user,
            status.0.as_deref(),
            priority.0.as_deref(),
            keyword.0.as_deref(),
            only_my.0.unwrap_or(false),
            page.0.unwrap_or(1),
            page_size.0.unwrap_or(20),
        )
        .await
        .map_err(ApiError::from)?;
        Ok(Json(resp))
    }

    #[oai(path = "/api/tickets/statistics", method = "get", tag = "客服工单")]
    async fn get_statistics(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
    ) -> ApiResult<Json<TicketStatistics>> {
        let user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let stats = db::get_statistics(&pool, &user)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(stats))
    }

    #[oai(path = "/api/tickets", method = "post", tag = "客服工单")]
    async fn create_ticket(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
        req: Json<CreateTicketRequest>,
    ) -> ApiResult<Json<Ticket>> {
        let user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let ticket = db::create_ticket(&pool, &user, &req.0)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(ticket))
    }

    #[oai(path = "/api/tickets/:id", method = "get", tag = "客服工单")]
    async fn get_ticket(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
        id: Path<String>,
    ) -> ApiResult<Json<TicketDetail>> {
        let _user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let detail = db::get_ticket_detail(&pool, &id.0)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(detail))
    }

    #[oai(path = "/api/tickets/:id/process", method = "post", tag = "客服工单")]
    async fn process_ticket(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
        id: Path<String>,
        req: Json<ProcessTicketRequest>,
    ) -> ApiResult<Json<TicketDetail>> {
        let user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let detail = db::process_ticket(&pool, &user, &id.0, &req.0)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(detail))
    }

    #[oai(path = "/api/tickets/batch-process", method = "post", tag = "客服工单")]
    async fn batch_process(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
        req: Json<BatchProcessRequest>,
    ) -> ApiResult<Json<BatchProcessResponse>> {
        let user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let resp = db::batch_process_tickets(&pool, &user, &req.0)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(resp))
    }

    #[oai(path = "/api/tickets/:id/attachments", method = "post", tag = "客服工单-附件")]
    async fn add_attachment(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
        id: Path<String>,
        req: Json<AddAttachmentRequest>,
    ) -> ApiResult<Json<Attachment>> {
        let user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let att = db::add_attachment(&pool, &user, &id.0, &req.0)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(att))
    }

    #[oai(path = "/api/tickets/:id/audit-remarks", method = "post", tag = "客服工单-审计")]
    async fn add_audit_remark(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
        id: Path<String>,
        req: Json<AddAuditRemarkRequest>,
    ) -> ApiResult<Json<AuditRemark>> {
        let user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let remark = db::add_audit_remark(&pool, &user, &id.0, &req.0)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(remark))
    }

    #[oai(path = "/api/tickets/:id/exception-reasons", method = "post", tag = "客服工单-异常")]
    async fn add_exception_reason(
        &self,
        x_user_id: Header<Option<String>>,
        x_username: Header<Option<String>>,
        x_role: Header<Option<String>>,
        x_name: Header<Option<String>>,
        id: Path<String>,
        req: Json<AddExceptionReasonRequest>,
    ) -> ApiResult<Json<ExceptionReason>> {
        let user = extract_user(&x_user_id.0, &x_username.0, &x_role.0, &x_name.0)?;
        let pool = self.pool.read().await;
        let reason = db::add_exception_reason(&pool, &user, &id.0, &req.0)
            .await
            .map_err(ApiError::from)?;
        Ok(Json(reason))
    }
}
