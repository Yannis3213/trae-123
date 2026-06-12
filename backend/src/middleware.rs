use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use poem::http::StatusCode;
use poem::{Error as PoemError, FromRequest, Request, RequestBody};

use crate::error::AppError;

pub struct AuthInfo {
    pub user_id: String,
    pub role: String,
}

pub fn encode_token(user_id: &str, role: &str) -> String {
    let raw = format!("{}:{}", user_id, role);
    BASE64.encode(raw.as_bytes())
}

pub fn decode_token(token: &str) -> Result<(String, String), AppError> {
    let bytes = BASE64.decode(token).map_err(|_| AppError::Unauthorized)?;
    let raw = String::from_utf8(bytes).map_err(|_| AppError::Unauthorized)?;
    let parts: Vec<&str> = raw.splitn(2, ':').collect();
    if parts.len() != 2 {
        return Err(AppError::Unauthorized);
    }
    Ok((parts[0].to_string(), parts[1].to_string()))
}

impl<'a> FromRequest<'a> for AuthInfo {
    async fn from_request(req: &'a Request, _body: &mut RequestBody) -> Result<Self, PoemError> {
        let auth_header = req
            .headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok());

        match auth_header {
            Some(header) if header.starts_with("Bearer ") => {
                let token = &header[7..];
                match decode_token(token) {
                    Ok((user_id, role)) => Ok(AuthInfo { user_id, role }),
                    Err(_) => Err(PoemError::from_status(StatusCode::UNAUTHORIZED)),
                }
            }
            _ => Err(PoemError::from_status(StatusCode::UNAUTHORIZED)),
        }
    }
}
