use rocket::request::{FromRequest, Outcome, Request};
use rocket::http::Status;
use serde::Serialize;

use crate::auth::AuthenticatedUser;
use crate::models::UserRole;

#[derive(Debug, Serialize)]
struct RoleCheckError {
    error: &'static str,
    required_role: &'static str,
}

macro_rules! impl_role_guard {
    ($guard_name:ident, $role:expr, $role_str:expr) => {
        pub struct $guard_name {
            pub user_id: i64,
            pub username: String,
        }

        #[rocket::async_trait]
        impl<'r> FromRequest<'r> for $guard_name {
            type Error = RoleCheckError;

            async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
                let auth_outcome = request.guard::<AuthenticatedUser>().await;

                match auth_outcome {
                    Outcome::Success(auth_user) => {
                        if auth_user.claims.role == $role_str {
                            Outcome::Success($guard_name {
                                user_id: auth_user.claims.user_id,
                                username: auth_user.claims.username,
                            })
                        } else {
                            Outcome::Error((
                                Status::Forbidden,
                                RoleCheckError {
                                    error: "权限不足，需要特定角色",
                                    required_role: $role_str,
                                },
                            ))
                        }
                    }
                    Outcome::Error(_) => Outcome::Error((
                        Status::Unauthorized,
                        RoleCheckError {
                            error: "未授权，请先登录",
                            required_role: $role_str,
                        },
                    )),
                    Outcome::Forward(()) => Outcome::Forward(()),
                }
            }
        }
    };
}

impl_role_guard!(RegistrarGuard, UserRole::Registrar, "registrar");
impl_role_guard!(SupervisorGuard, UserRole::Supervisor, "supervisor");
impl_role_guard!(ReviewerGuard, UserRole::Reviewer, "reviewer");
impl_role_guard!(DirectorGuard, UserRole::Director, "director");
impl_role_guard!(AssistantGuard, UserRole::Assistant, "assistant");
impl_role_guard!(LawyerGuard, UserRole::Lawyer, "lawyer");

pub struct AnyRoleGuard {
    pub user_id: i64,
    pub username: String,
    pub role: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AnyRoleGuard {
    type Error = RoleCheckError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth_outcome = request.guard::<AuthenticatedUser>().await;

        match auth_outcome {
            Outcome::Success(auth_user) => {
                let valid_roles = ["registrar", "supervisor", "reviewer", "director", "assistant", "lawyer"];
                if valid_roles.contains(&auth_user.claims.role.as_str()) {
                    Outcome::Success(AnyRoleGuard {
                        user_id: auth_user.claims.user_id,
                        username: auth_user.claims.username,
                        role: auth_user.claims.role,
                    })
                } else {
                    Outcome::Error((
                        Status::Forbidden,
                        RoleCheckError {
                            error: "角色无效",
                            required_role: "any valid role",
                        },
                    ))
                }
            }
            Outcome::Error(_) => Outcome::Error((
                Status::Unauthorized,
                RoleCheckError {
                    error: "未授权，请先登录",
                    required_role: "any valid role",
                },
            )),
            Outcome::Forward(()) => Outcome::Forward(()),
        }
    }
}

pub struct AdminOrDirectorGuard {
    pub user_id: i64,
    pub username: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AdminOrDirectorGuard {
    type Error = RoleCheckError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth_outcome = request.guard::<AuthenticatedUser>().await;

        match auth_outcome {
            Outcome::Success(auth_user) => {
                let allowed_roles = ["director", "supervisor", "reviewer"];
                if allowed_roles.contains(&auth_user.claims.role.as_str()) {
                    Outcome::Success(AdminOrDirectorGuard {
                        user_id: auth_user.claims.user_id,
                        username: auth_user.claims.username,
                    })
                } else {
                    Outcome::Error((
                        Status::Forbidden,
                        RoleCheckError {
                            error: "权限不足，需要管理角色",
                            required_role: "director, supervisor, or reviewer",
                        },
                    ))
                }
            }
            Outcome::Error(_) => Outcome::Error((
                Status::Unauthorized,
                RoleCheckError {
                    error: "未授权，请先登录",
                    required_role: "director, supervisor, or reviewer",
                },
            )),
            Outcome::Forward(()) => Outcome::Forward(()),
        }
    }
}

pub struct CaseHandlerGuard {
    pub user_id: i64,
    pub username: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for CaseHandlerGuard {
    type Error = RoleCheckError;

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth_outcome = request.guard::<AuthenticatedUser>().await;

        match auth_outcome {
            Outcome::Success(auth_user) => {
                let allowed_roles = ["lawyer", "assistant", "supervisor"];
                if allowed_roles.contains(&auth_user.claims.role.as_str()) {
                    Outcome::Success(CaseHandlerGuard {
                        user_id: auth_user.claims.user_id,
                        username: auth_user.claims.username,
                    })
                } else {
                    Outcome::Error((
                        Status::Forbidden,
                        RoleCheckError {
                            error: "权限不足，需要案件处理角色",
                            required_role: "lawyer, assistant, or supervisor",
                        },
                    ))
                }
            }
            Outcome::Error(_) => Outcome::Error((
                Status::Unauthorized,
                RoleCheckError {
                    error: "未授权，请先登录",
                    required_role: "lawyer, assistant, or supervisor",
                },
            )),
            Outcome::Forward(()) => Outcome::Forward(()),
        }
    }
}
