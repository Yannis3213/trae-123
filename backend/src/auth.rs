use crate::models::*;
use anyhow::{Result, anyhow};

pub fn check_permission(
    record: &BorrowRecord,
    operator_role: Role,
    target_status: &BorrowStatus,
) -> Result<()> {
    match (operator_role, record.status, target_status) {
        (Role::RegistrationClerk, BorrowStatus::ReturnedForCorrection, BorrowStatus::PendingAssignment) => Ok(()),
        (Role::RegistrationClerk, _, _) => {
            Err(anyhow!("借阅登记员仅可处理退回补正状态的记录"))
        }

        (Role::CirculationLibrarian, BorrowStatus::PendingAssignment, BorrowStatus::Transferred) => Ok(()),
        (Role::CirculationLibrarian, BorrowStatus::PendingAssignment, BorrowStatus::ReturnedForCorrection) => Ok(()),
        (Role::CirculationLibrarian, BorrowStatus::PendingAssignment, BorrowStatus::Overdue) => Ok(()),
        (Role::CirculationLibrarian, _, _) => {
            Err(anyhow!("流通馆员仅可处理待分派状态的记录"))
        }

        (Role::CatalogingLibrarian, BorrowStatus::Transferred, BorrowStatus::Revisited) => Ok(()),
        (Role::CatalogingLibrarian, BorrowStatus::Transferred, BorrowStatus::ReturnedForCorrection) => Ok(()),
        (Role::CatalogingLibrarian, _, _) => {
            Err(anyhow!("采编馆员仅可处理已转办状态的记录"))
        }

        (Role::AuditSupervisor, BorrowStatus::Revisited, BorrowStatus::ReviewedArchived) => Ok(()),
        (Role::AuditSupervisor, BorrowStatus::Revisited, BorrowStatus::ReturnedForCorrection) => Ok(()),
        (Role::AuditSupervisor, _, _) => {
            Err(anyhow!("借阅审核主管仅可处理已回访状态的记录"))
        }

        (Role::LibraryDirector, _, _) => Ok(()),
    }
}

pub fn can_access_record(record: &BorrowRecord, role: Role) -> bool {
    match role {
        Role::RegistrationClerk => {
            record.status == BorrowStatus::ReturnedForCorrection ||
            record.created_by_role == Role::RegistrationClerk
        }
        Role::CirculationLibrarian => record.status == BorrowStatus::PendingAssignment,
        Role::CatalogingLibrarian => {
            record.status == BorrowStatus::Transferred ||
            record.current_handler_role == Some(Role::CatalogingLibrarian)
        }
        Role::AuditSupervisor => {
            record.status == BorrowStatus::Revisited ||
            record.current_handler_role == Some(Role::AuditSupervisor)
        }
        Role::LibraryDirector => true,
    }
}

pub fn allowed_transitions(role: Role, current_status: BorrowStatus) -> Vec<BorrowStatus> {
    match (role, current_status) {
        (Role::RegistrationClerk, BorrowStatus::ReturnedForCorrection) => {
            vec![BorrowStatus::PendingAssignment]
        }
        (Role::CirculationLibrarian, BorrowStatus::PendingAssignment) => {
            vec![BorrowStatus::Transferred, BorrowStatus::ReturnedForCorrection, BorrowStatus::Overdue]
        }
        (Role::CatalogingLibrarian, BorrowStatus::Transferred) => {
            vec![BorrowStatus::Revisited, BorrowStatus::ReturnedForCorrection]
        }
        (Role::AuditSupervisor, BorrowStatus::Revisited) => {
            vec![BorrowStatus::ReviewedArchived, BorrowStatus::ReturnedForCorrection]
        }
        (Role::LibraryDirector, _) => BorrowStatus::all(),
        _ => vec![],
    }
}
