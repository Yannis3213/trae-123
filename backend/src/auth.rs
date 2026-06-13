use poem::http::HeaderMap;
use serde::{Deserialize, Serialize};
use crate::models::{UserRole, AppError};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthClaims {
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub display_name: String,
    pub exp: i64,
}

impl AuthClaims {
    pub fn role_enum(&self) -> Option<UserRole> {
        self.role.parse::<UserRole>().ok()
    }
    pub fn require_role(&self, allowed: &[UserRole]) -> Result<(), AppError> {
        let r = self.role_enum().ok_or_else(|| AppError::Forbidden("无效的角色信息".into()))?;
        if allowed.iter().any(|a| a == &r) {
            Ok(())
        } else {
            Err(AppError::Forbidden(format!(
                "当前角色 {} 无权限执行此操作，需要角色: {:?}",
                self.role,
                allowed.iter().map(|r| r.as_str()).collect::<Vec<_>>()
            )))
        }
    }
    pub fn is_registrar(&self) -> bool { self.role == UserRole::Registrar.as_str() }
    pub fn is_auditor(&self) -> bool { self.role == UserRole::Auditor.as_str() }
    pub fn is_reviewer(&self) -> bool { self.role == UserRole::Reviewer.as_str() }
}

pub fn encode_token(claims: &AuthClaims) -> String {
    let json = serde_json::to_string(claims).unwrap();
    BASE64.encode(json.as_bytes())
}

pub fn decode_token(token: &str) -> Option<AuthClaims> {
    let bytes = BASE64.decode(token).ok()?;
    let json = String::from_utf8(bytes).ok()?;
    serde_json::from_str(&json).ok()
}

pub fn extract_claims(headers: &HeaderMap) -> Result<AuthClaims, AppError> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("缺少 Authorization 头".into()))?;

    let token = if let Some(stripped) = auth_header.strip_prefix("Bearer ") {
        stripped
    } else if let Some(stripped) = auth_header.strip_prefix("bearer ") {
        stripped
    } else {
        auth_header
    };

    let claims = decode_token(token)
        .ok_or_else(|| AppError::Unauthorized("无效的 Token".into()))?;

    let now = chrono::Utc::now().timestamp();
    if claims.exp < now {
        return Err(AppError::Unauthorized("Token 已过期".into()));
    }

    Ok(claims)
}

pub fn extract_claims_from_query_or_header(headers: &HeaderMap, query_token: Option<&str>) -> Result<AuthClaims, AppError> {
    if let Some(token) = query_token {
        return decode_token(token)
            .ok_or_else(|| AppError::Unauthorized("无效的 Token".into()));
    }
    extract_claims(headers)
}
