pub fn check_version(current: i64, expected: i64) -> Result<(), crate::error::AppError> {
    if current != expected {
        Err(crate::error::AppError::conflict(format!(
            "版本冲突: 期望版本 {}, 当前版本 {}",
            expected, current
        )))
    } else {
        Ok(())
    }
}

pub struct UserContext {
    pub user_id: i64,
    pub user_role: String,
}

impl UserContext {
    pub fn new(user_id: i64, user_role: String) -> Self {
        Self { user_id, user_role }
    }

    pub fn require_role(&self, roles: &[&str]) -> Result<(), crate::error::AppError> {
        if roles.iter().any(|r| *r == self.user_role) {
            Ok(())
        } else {
            Err(crate::error::AppError::forbidden(format!(
                "需要角色之一: {:?}, 当前角色: {}",
                roles, self.user_role
            )))
        }
    }

    pub fn require_inspector(&self) -> Result<(), crate::error::AppError> {
        self.require_role(&["inspector", "admin"])
    }

    pub fn require_engineer(&self) -> Result<(), crate::error::AppError> {
        self.require_role(&["engineer", "admin"])
    }

    pub fn require_manager(&self) -> Result<(), crate::error::AppError> {
        self.require_role(&["manager", "admin"])
    }

    pub fn is_handler(&self, handler_id: Option<i64>) -> bool {
        match handler_id {
            Some(id) => id == self.user_id,
            None => false,
        }
    }
}
