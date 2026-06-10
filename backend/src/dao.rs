use crate::db::DbPool;
use crate::models::*;
use crate::errors::AppResult;
use chrono::{DateTime, Utc};
use rusqlite::params;
use uuid::Uuid;

pub struct UserDao;

impl UserDao {
    pub fn get_by_username(pool: &DbPool, username: &str) -> AppResult<Option<User>> {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, username, display_name, role, created_at FROM users WHERE username = ?1"
        )?;
        let result = stmt.query_row(params![username], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                role: UserRole::from_str(&row.get::<_, String>(3)?).unwrap(),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map(|d| d.with_timezone(&Utc))
                    .unwrap(),
            })
        });
        match result {
            Ok(user) => Ok(Some(user)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Option<User>> {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, username, display_name, role, created_at FROM users WHERE id = ?1"
        )?;
        let result = stmt.query_row(params![id], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                role: UserRole::from_str(&row.get::<_, String>(3)?).unwrap(),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map(|d| d.with_timezone(&Utc))
                    .unwrap(),
            })
        });
        match result {
            Ok(user) => Ok(Some(user)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn list_all(pool: &DbPool) -> AppResult<Vec<User>> {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                role: UserRole::from_str(&row.get::<_, String>(3)?).unwrap(),
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                    .map(|d| d.with_timezone(&Utc))
                    .unwrap(),
            })
        })?;
        let mut users = Vec::new();
        for row in rows {
            users.push(row?);
        }
        Ok(users)
    }
}

pub struct ApplicationDao;

impl ApplicationDao {
    pub fn list(pool: &DbPool, filter: &ApplicationFilter, handler_id: Option<&str>) -> AppResult<Vec<ReplenishmentApplication>> {
        let conn = pool.get()?;
        let mut sql = String::from(
            "SELECT id, application_no, store_id, store_name, title, description, status, priority, \
             responsible_person, current_handler, deadline, version, created_by, created_at, updated_at, exception_tags \
             FROM replenishment_applications WHERE 1=1"
        );
        let mut params_list: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(status) = &filter.status {
            sql.push_str(" AND status = ?");
            params_list.push(Box::new(status.as_str().to_string()));
        }
        if let Some(priority) = &filter.priority {
            sql.push_str(" AND priority = ?");
            params_list.push(Box::new(priority.as_str().to_string()));
        }
        if let Some(store_id) = &filter.store_id {
            sql.push_str(" AND store_id = ?");
            params_list.push(Box::new(store_id.clone()));
        }
        if let Some(responsible) = &filter.responsible_person {
            sql.push_str(" AND responsible_person = ?");
            params_list.push(Box::new(responsible.clone()));
        }
        if let Some(handler) = handler_id {
            sql.push_str(" AND current_handler = ?");
            params_list.push(Box::new(handler.to_string()));
        }
        if let Some(kw) = &filter.keyword {
            sql.push_str(" AND (title LIKE ? OR application_no LIKE ? OR description LIKE ?)");
            let like = format!("%{}%", kw);
            params_list.push(Box::new(like.clone()));
            params_list.push(Box::new(like.clone()));
            params_list.push(Box::new(like));
        }
        sql.push_str(" ORDER BY created_at DESC");

        let params_refs: Vec<&dyn rusqlite::ToSql> = params_list.iter().map(|b| b.as_ref()).collect();
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map(params_refs.as_slice(), |row| {
            let id: String = row.get(0)?;
            let exception_tags_str: String = row.get(15)?;
            let exception_tags: Vec<String> = serde_json::from_str(&exception_tags_str).unwrap_or_default();
            let deadline_str: String = row.get(10)?;
            let deadline = DateTime::parse_from_rfc3339(&deadline_str)
                .map(|d| d.with_timezone(&Utc)).unwrap();
            let now = Utc::now();
            let is_overdue = deadline < now;
            let diff = deadline.signed_duration_since(now);
            let is_near_deadline = !is_overdue && diff.num_hours() < 24;
            Ok(ReplenishmentApplication {
                id,
                application_no: row.get(1)?,
                store_id: row.get(2)?,
                store_name: row.get(3)?,
                title: row.get(4)?,
                description: row.get(5)?,
                status: ApplicationStatus::from_str(&row.get::<_, String>(6)?).unwrap(),
                priority: Priority::from_str(&row.get::<_, String>(7)?).unwrap(),
                responsible_person: row.get(8)?,
                current_handler: row.get(9)?,
                deadline,
                version: row.get(11)?,
                created_by: row.get(12)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(13)?)
                    .map(|d| d.with_timezone(&Utc)).unwrap(),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(14)?)
                    .map(|d| d.with_timezone(&Utc)).unwrap(),
                exception_tags,
                is_overdue,
                is_near_deadline,
            })
        })?;
        let mut apps = Vec::new();
        for row in rows {
            apps.push(row?);
        }
        Ok(apps)
    }

    pub fn get_by_id(pool: &DbPool, id: &str) -> AppResult<Option<ReplenishmentApplication>> {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, application_no, store_id, store_name, title, description, status, priority, \
             responsible_person, current_handler, deadline, version, created_by, created_at, updated_at, exception_tags \
             FROM replenishment_applications WHERE id = ?1"
        )?;
        let result = stmt.query_row(params![id], |row| {
            let id: String = row.get(0)?;
            let exception_tags_str: String = row.get(15)?;
            let exception_tags: Vec<String> = serde_json::from_str(&exception_tags_str).unwrap_or_default();
            let deadline_str: String = row.get(10)?;
            let deadline = DateTime::parse_from_rfc3339(&deadline_str)
                .map(|d| d.with_timezone(&Utc)).unwrap();
            let now = Utc::now();
            let is_overdue = deadline < now;
            let diff = deadline.signed_duration_since(now);
            let is_near_deadline = !is_overdue && diff.num_hours() < 24;
            Ok(ReplenishmentApplication {
                id,
                application_no: row.get(1)?,
                store_id: row.get(2)?,
                store_name: row.get(3)?,
                title: row.get(4)?,
                description: row.get(5)?,
                status: ApplicationStatus::from_str(&row.get::<_, String>(6)?).unwrap(),
                priority: Priority::from_str(&row.get::<_, String>(7)?).unwrap(),
                responsible_person: row.get(8)?,
                current_handler: row.get(9)?,
                deadline,
                version: row.get(11)?,
                created_by: row.get(12)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(13)?)
                    .map(|d| d.with_timezone(&Utc)).unwrap(),
                updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(14)?)
                    .map(|d| d.with_timezone(&Utc)).unwrap(),
                exception_tags,
                is_overdue,
                is_near_deadline,
            })
        });
        match result {
            Ok(app) => Ok(Some(app)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn create(pool: &DbPool, app: &ReplenishmentApplication) -> AppResult<()> {
        let conn = pool.get()?;
        conn.execute(
            "INSERT INTO replenishment_applications \
             (id, application_no, store_id, store_name, title, description, status, priority, \
              responsible_person, current_handler, deadline, version, created_by, created_at, updated_at, exception_tags) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                app.id,
                app.application_no,
                app.store_id,
                app.store_name,
                app.title,
                app.description,
                app.status.as_str(),
                app.priority.as_str(),
                app.responsible_person,
                app.current_handler,
                app.deadline.to_rfc3339(),
                app.version,
                app.created_by,
                app.created_at.to_rfc3339(),
                app.updated_at.to_rfc3339(),
                serde_json::to_string(&app.exception_tags).unwrap(),
            ],
        )?;
        Ok(())
    }

    pub fn update_status_and_version(
        pool: &DbPool,
        id: &str,
        new_status: ApplicationStatus,
        new_handler: &str,
        expected_version: i64,
        new_exception_tags: Option<Vec<String>>,
    ) -> AppResult<i64> {
        let conn = pool.get()?;
        let current = Self::get_by_id(pool, id)?
            .ok_or_else(|| crate::errors::AppError::NotFound(format!("Application {}", id)))?;
        if current.version != expected_version {
            return Err(crate::errors::AppError::VersionConflict(expected_version, current.version));
        }
        let new_version = expected_version + 1;
        let now = Utc::now().to_rfc3339();
        let tags = new_exception_tags.unwrap_or(current.exception_tags);
        conn.execute(
            "UPDATE replenishment_applications SET status = ?1, current_handler = ?2, version = ?3, \
             updated_at = ?4, exception_tags = ?5 WHERE id = ?6 AND version = ?7",
            params![
                new_status.as_str(),
                new_handler,
                new_version,
                now,
                serde_json::to_string(&tags).unwrap(),
                id,
                expected_version,
            ],
        )?;
        Ok(new_version)
    }
}

pub struct ProcessingRecordDao;

impl ProcessingRecordDao {
    pub fn create(pool: &DbPool, record: &ProcessingRecord) -> AppResult<()> {
        let conn = pool.get()?;
        conn.execute(
            "INSERT INTO processing_records \
             (id, application_id, from_status, to_status, action, operator_id, operator_name, result, return_reason, processed_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                record.id,
                record.application_id,
                record.from_status.as_ref().map(|s| s.as_str()),
                record.to_status.as_str(),
                record.action,
                record.operator_id,
                record.operator_name,
                record.result,
                record.return_reason,
                record.processed_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn list_by_application(pool: &DbPool, app_id: &str) -> AppResult<Vec<ProcessingRecord>> {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, application_id, from_status, to_status, action, operator_id, operator_name, \
             result, return_reason, processed_at FROM processing_records WHERE application_id = ?1 ORDER BY processed_at ASC"
        )?;
        let rows = stmt.query_map(params![app_id], |row| {
            Ok(ProcessingRecord {
                id: row.get(0)?,
                application_id: row.get(1)?,
                from_status: row.get::<_, Option<String>>(2)?.and_then(|s| ApplicationStatus::from_str(&s)),
                to_status: ApplicationStatus::from_str(&row.get::<_, String>(3)?).unwrap(),
                action: row.get(4)?,
                operator_id: row.get(5)?,
                operator_name: row.get(6)?,
                result: row.get(7)?,
                return_reason: row.get(8)?,
                processed_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                    .map(|d| d.with_timezone(&Utc)).unwrap(),
            })
        })?;
        let mut records = Vec::new();
        for row in rows {
            records.push(row?);
        }
        Ok(records)
    }
}

pub struct AttachmentDao;

impl AttachmentDao {
    pub fn create(pool: &DbPool, att: &Attachment) -> AppResult<()> {
        let conn = pool.get()?;
        conn.execute(
            "INSERT INTO attachments (id, application_id, file_name, file_type, uploaded_by, uploaded_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                att.id,
                att.application_id,
                att.file_name,
                att.file_type,
                att.uploaded_by,
                att.uploaded_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn list_by_application(pool: &DbPool, app_id: &str) -> AppResult<Vec<Attachment>> {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, application_id, file_name, file_type, uploaded_by, uploaded_at \
             FROM attachments WHERE application_id = ?1 ORDER BY uploaded_at ASC"
        )?;
        let rows = stmt.query_map(params![app_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                application_id: row.get(1)?,
                file_name: row.get(2)?,
                file_type: row.get(3)?,
                uploaded_by: row.get(4)?,
                uploaded_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .map(|d| d.with_timezone(&Utc)).unwrap(),
            })
        })?;
        let mut atts = Vec::new();
        for row in rows {
            atts.push(row?);
        }
        Ok(atts)
    }
}

pub struct AuditNoteDao;

impl AuditNoteDao {
    pub fn create(pool: &DbPool, note: &AuditNote) -> AppResult<()> {
        let conn = pool.get()?;
        conn.execute(
            "INSERT INTO audit_notes (id, application_id, author_id, author_name, note, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                note.id,
                note.application_id,
                note.author_id,
                note.author_name,
                note.note,
                note.created_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn list_by_application(pool: &DbPool, app_id: &str) -> AppResult<Vec<AuditNote>> {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, application_id, author_id, author_name, note, created_at \
             FROM audit_notes WHERE application_id = ?1 ORDER BY created_at ASC"
        )?;
        let rows = stmt.query_map(params![app_id], |row| {
            Ok(AuditNote {
                id: row.get(0)?,
                application_id: row.get(1)?,
                author_id: row.get(2)?,
                author_name: row.get(3)?,
                note: row.get(4)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .map(|d| d.with_timezone(&Utc)).unwrap(),
            })
        })?;
        let mut notes = Vec::new();
        for row in rows {
            notes.push(row?);
        }
        Ok(notes)
    }
}

pub struct ExceptionLogDao;

impl ExceptionLogDao {
    pub fn create(pool: &DbPool, log: &ExceptionLog) -> AppResult<()> {
        let conn = pool.get()?;
        conn.execute(
            "INSERT INTO exception_logs (id, application_id, exception_type, description, operator_id, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                log.id,
                log.application_id,
                log.exception_type,
                log.description,
                log.operator_id,
                log.created_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn list_by_application(pool: &DbPool, app_id: &str) -> AppResult<Vec<ExceptionLog>> {
        let conn = pool.get()?;
        let mut stmt = conn.prepare(
            "SELECT id, application_id, exception_type, description, operator_id, created_at \
             FROM exception_logs WHERE application_id = ?1 ORDER BY created_at ASC"
        )?;
        let rows = stmt.query_map(params![app_id], |row| {
            Ok(ExceptionLog {
                id: row.get(0)?,
                application_id: row.get(1)?,
                exception_type: row.get(2)?,
                description: row.get(3)?,
                operator_id: row.get(4)?,
                created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                    .map(|d| d.with_timezone(&Utc)).unwrap(),
            })
        })?;
        let mut logs = Vec::new();
        for row in rows {
            logs.push(row?);
        }
        Ok(logs)
    }
}

pub fn new_uuid() -> String {
    Uuid::new_v4().to_string()
}

pub fn next_application_no(pool: &DbPool) -> AppResult<String> {
    use chrono::Datelike;
    let now = Utc::now();
    let prefix = format!("RP-{}-{:02}", now.year(), now.month());
    let conn = pool.get()?;
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM replenishment_applications WHERE application_no LIKE ?1",
            params![format!("{}%", prefix)],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(format!("{}-{:03}", prefix, count + 1))
}

impl ApplicationDao {
    pub fn update_handler_only(
        pool: &DbPool,
        id: &str,
        new_handler: &str,
        expected_version: i64,
    ) -> AppResult<i64> {
        let conn = pool.get()?;
        let current = Self::get_by_id(pool, id)?
            .ok_or_else(|| crate::errors::AppError::NotFound(format!("Application {}", id)))?;
        if current.version != expected_version {
            return Err(crate::errors::AppError::VersionConflict(expected_version, current.version));
        }
        let new_version = expected_version + 1;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE replenishment_applications SET current_handler = ?1, version = ?2, updated_at = ?3 WHERE id = ?4 AND version = ?5",
            params![new_handler, new_version, now, id, expected_version],
        )?;
        Ok(new_version)
    }
}
