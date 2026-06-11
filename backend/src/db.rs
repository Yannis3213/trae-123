use rusqlite::{Connection, params};
use std::sync::Mutex;
use crate::models::*;
use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;
use sha2::{Sha256, Digest};

pub struct Database {
    pub conn: Mutex<Connection>,
}

fn hash_password(pwd: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(pwd.as_bytes());
    format!("{:x}", hasher.finalize())
}

impl Database {
    pub fn new(path: &str) -> Self {
        let conn = Connection::open(path).expect("Failed to open database");
        Database { conn: Mutex::new(conn) }
    }

    pub fn init_schema(&self) {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(r#"
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS inbound_orders (
                id TEXT PRIMARY KEY,
                order_no TEXT UNIQUE NOT NULL,
                supplier_name TEXT NOT NULL,
                material_name TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                status TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                current_handler_role TEXT NOT NULL,
                current_handler_id TEXT,
                current_handler_name TEXT,
                deadline TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                appointment_evidence TEXT,
                appointment_complete INTEGER NOT NULL DEFAULT 0,
                inspection_evidence TEXT,
                inspection_complete INTEGER NOT NULL DEFAULT 0,
                registration_evidence TEXT,
                registration_complete INTEGER NOT NULL DEFAULT 0,
                last_opinion TEXT,
                last_attachment_id TEXT,
                last_audit_note TEXT
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                filename TEXT NOT NULL,
                uploaded_by TEXT NOT NULL,
                uploaded_at TEXT NOT NULL,
                uploader_role TEXT NOT NULL,
                module TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS processing_records (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                handler_id TEXT NOT NULL,
                handler_name TEXT NOT NULL,
                handler_role TEXT NOT NULL,
                action TEXT NOT NULL,
                opinion TEXT NOT NULL,
                from_status TEXT NOT NULL,
                to_status TEXT NOT NULL,
                processed_at TEXT NOT NULL,
                attachment_id TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_notes (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                note TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                creator_role TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS exception_reasons (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                module TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        "#).expect("Failed to init schema");
    }

    pub fn seed_data(&self) {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM users").unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap_or(0);
        if count > 0 { return; }

        let users = vec![
            ("u1", "keeper1", "库管员张三", Role::WarehouseKeeper, "123456"),
            ("u2", "keeper2", "库管员李四", Role::WarehouseKeeper, "123456"),
            ("u3", "super1", "仓储主管王五", Role::WarehouseSupervisor, "123456"),
            ("u4", "manager1", "运营经理赵六", Role::OperationsManager, "123456"),
        ];
        for (id, uname, name, role, pwd) in &users {
            conn.execute(
                "INSERT INTO users (id, username, name, role, password_hash) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, uname, name, role.to_str(), hash_password(pwd)]
            ).unwrap();
        }

        let now = Utc::now();
        type OptStr = Option<&'static str>;
        let orders: Vec<(
            &str, &str, &str, &str, i64,
            OrderStatus, Role,
            OptStr, OptStr, Option<DateTime<Utc>>,
            bool, bool, bool, OptStr, OptStr, OptStr,
            OptStr, OptStr, OptStr
        )> = vec![
            (
                "o1", "RK20260601001", "供应商A公司", "电子元器件A", 1000i64,
                OrderStatus::PendingConfirmation, Role::WarehouseSupervisor,
                Some("u3"), Some("仓储主管王五"), Some(now + Duration::hours(24)),
                true, true, true, Some("预约单扫描件.pdf"), Some("质检报告.pdf"), Some("入库登记表.pdf"),
                Some("库管员张三已完成三项登记，等待主管确认"),
                None, Some("系统自动流转至主管")
            ),
            (
                "o2", "RK20260601002", "供应商B公司", "包装材料B", 500i64,
                OrderStatus::Exception, Role::WarehouseKeeper,
                Some("u1"), Some("库管员张三"), Some(now - Duration::hours(2)),
                false, true, false, None, Some("质检报告B.pdf"), None,
                Some("仓储主管王五退回：入库预约材料缺失，请补充"),
                None, Some("退回补正，等待库管员补充预约材料")
            ),
            (
                "o3", "RK20260601003", "供应商C公司", "机械设备C", 50i64,
                OrderStatus::PendingConfirmation, Role::OperationsManager,
                Some("u4"), Some("运营经理赵六"), Some(now - Duration::hours(48)),
                true, true, true, Some("预约单C.pdf"), Some("质检报告C.pdf"), Some("登记单C.pdf"),
                Some("仓储主管王五已确认，等待运营经理最终确认"),
                None, None
            ),
            (
                "o4", "RK20260601004", "供应商D公司", "办公用品D", 200i64,
                OrderStatus::Rechecked, Role::OperationsManager,
                Some("u4"), Some("运营经理赵六"), None,
                true, true, true, Some("预约单D.pdf"), Some("质检报告D.pdf"), Some("登记单D.pdf"),
                Some("运营经理赵六已完成最终复查"),
                None, Some("流程结束，入库完成")
            ),
            (
                "o5", "RK20260601005", "供应商E公司", "化工原料E", 300i64,
                OrderStatus::Exception, Role::WarehouseKeeper,
                Some("u2"), Some("库管员李四"), Some(now - Duration::hours(12)),
                true, false, false, Some("预约单E.pdf"), None, None,
                Some("仓储主管王五退回：质检材料缺失"),
                None, Some("退回补正，质检上架缺项")
            ),
            (
                "o6", "RK20260601006", "供应商F公司", "劳保用品F", 800i64,
                OrderStatus::PendingConfirmation, Role::WarehouseKeeper,
                Some("u1"), Some("库管员张三"), Some(now + Duration::hours(6)),
                false, false, false, None, None, None,
                None, None, Some("库管员新建，尚未提交")
            ),
        ];
        for (
            id, order_no, supplier, material, qty, status, handler_role,
            handler_id, handler_name, deadline,
            appt_complete, insp_complete, reg_complete,
            appt_ev, insp_ev, reg_ev,
            last_opinion, last_att, last_audit
        ) in orders {
            conn.execute(
                "INSERT INTO inbound_orders (
                    id, order_no, supplier_name, material_name, quantity, status, version,
                    current_handler_role, current_handler_id, current_handler_name, deadline,
                    created_at, updated_at,
                    appointment_evidence, appointment_complete,
                    inspection_evidence, inspection_complete,
                    registration_evidence, registration_complete,
                    last_opinion, last_attachment_id, last_audit_note
                ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22)",
                params![
                    id, order_no, supplier, material, qty, status.to_str(), 1i64,
                    handler_role.to_str(), handler_id, handler_name,
                    deadline.map(|d| d.to_rfc3339()),
                    now.to_rfc3339(), now.to_rfc3339(),
                    appt_ev, if appt_complete { 1 } else { 0 },
                    insp_ev, if insp_complete { 1 } else { 0 },
                    reg_ev, if reg_complete { 1 } else { 0 },
                    last_opinion, last_att, last_audit
                ]
            ).unwrap();
        }

        type RecOpt = Option<&'static str>;
        let records: Vec<(
            &str, &str, &str, &str, Role, &str, &str, &str, &str, chrono::DateTime<Utc>, RecOpt
        )> = vec![
            ("r1", "o1", "u1", "库管员张三", Role::WarehouseKeeper, "提交", "已完成入库预约、质检上架、入库单登记三项工作，申请主管确认", "", "pending_confirmation", now - Duration::hours(2), None),
            ("r2", "o2", "u1", "库管员张三", Role::WarehouseKeeper, "提交", "已完成部分工作，申请主管确认", "", "pending_confirmation", now - Duration::hours(6), None),
            ("r3", "o2", "u3", "仓储主管王五", Role::WarehouseSupervisor, "退回补正", "入库预约材料缺失，请补充完整后重新提交", "pending_confirmation", "exception", now - Duration::hours(2), None),
            ("r4", "o3", "u1", "库管员张三", Role::WarehouseKeeper, "提交", "三项工作均已完成，证据齐全", "", "pending_confirmation", now - Duration::hours(72), None),
            ("r5", "o3", "u3", "仓储主管王五", Role::WarehouseSupervisor, "确认通过", "审核无误，提交运营经理最终确认", "pending_confirmation", "pending_confirmation", now - Duration::hours(48), None),
            ("r6", "o4", "u2", "库管员李四", Role::WarehouseKeeper, "提交", "完成三项工作", "", "pending_confirmation", now - Duration::hours(120), None),
            ("r7", "o4", "u3", "仓储主管王五", Role::WarehouseSupervisor, "确认通过", "已审核", "pending_confirmation", "pending_confirmation", now - Duration::hours(96), None),
            ("r8", "o4", "u4", "运营经理赵六", Role::OperationsManager, "最终确认", "复查完成，入库单已确认", "pending_confirmation", "rechecked", now - Duration::hours(72), None),
            ("r9", "o5", "u2", "库管员李四", Role::WarehouseKeeper, "提交", "已完成预约，等待质检", "", "pending_confirmation", now - Duration::hours(24), None),
            ("r10", "o5", "u3", "仓储主管王五", Role::WarehouseSupervisor, "退回补正", "质检上架材料缺失，请补充质检报告", "pending_confirmation", "exception", now - Duration::hours(12), None),
        ];
        for (id, oid, hid, hname, hrole, action, opinion, from, to, at, att) in records {
            conn.execute(
                "INSERT INTO processing_records VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
                params![id, oid, hid, hname, hrole.to_str(), action, opinion, from, to, at.to_rfc3339(), att]
            ).unwrap();
        }

        let exceptions = vec![
            ("e1", "o2", "入库预约模块缺少供应商盖章的预约确认单扫描件", "appointment", "u3", now - Duration::hours(2)),
            ("e2", "o5", "质检上架模块缺少第三方质检报告，无法确认货物质量", "inspection", "u3", now - Duration::hours(12)),
        ];
        for (id, oid, reason, module, by, at) in exceptions {
            conn.execute(
                "INSERT INTO exception_reasons VALUES (?1,?2,?3,?4,?5,?6)",
                params![id, oid, reason, module, by, at.to_rfc3339()]
            ).unwrap();
        }

        let audits = vec![
            ("a1", "o1", "重点关注此批次电子元器件的质量情况，需核对质检报告编号", "u3", now - Duration::hours(1), Role::WarehouseSupervisor),
            ("a2", "o2", "退回补正后请库管员优先补充预约材料，避免再次逾期", "u3", now - Duration::hours(2), Role::WarehouseSupervisor),
            ("a4", "o4", "已完成最终复查，流程正常归档", "u4", now - Duration::hours(72), Role::OperationsManager),
        ];
        for (id, oid, note, by, at, role) in audits {
            conn.execute(
                "INSERT INTO audit_notes VALUES (?1,?2,?3,?4,?5,?6)",
                params![id, oid, note, by, at.to_rfc3339(), role.to_str()]
            ).unwrap();
        }
    }

    pub fn verify_user(&self, username: &str, password: &str) -> Option<User> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, username, name, role, password_hash FROM users WHERE username = ?1").unwrap();
        let pwd_hash = hash_password(password);
        stmt.query_row(params![username], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                name: row.get(2)?,
                role: Role::from_str(&row.get::<_, String>(3)?).unwrap(),
                password_hash: row.get(4)?,
            })
        }).ok().filter(|u| u.password_hash == pwd_hash)
    }

    pub fn get_user(&self, user_id: &str) -> Option<User> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, username, name, role, password_hash FROM users WHERE id = ?1").unwrap();
        stmt.query_row(params![user_id], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                name: row.get(2)?,
                role: Role::from_str(&row.get::<_, String>(3)?).unwrap(),
                password_hash: row.get(4)?,
            })
        }).ok()
    }

    pub fn list_orders(&self) -> Vec<InboundOrder> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM inbound_orders ORDER BY created_at DESC").unwrap();
        let rows = stmt.query_map([], row_to_order).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn get_order(&self, order_id: &str) -> Option<InboundOrder> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM inbound_orders WHERE id = ?1").unwrap();
        stmt.query_row(params![order_id], row_to_order).ok()
    }

    pub fn list_attachments(&self, order_id: &str) -> Vec<Attachment> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM attachments WHERE order_id = ?1 ORDER BY uploaded_at DESC").unwrap();
        let rows = stmt.query_map(params![order_id], row_to_attachment).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn list_records(&self, order_id: &str) -> Vec<ProcessingRecord> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM processing_records WHERE order_id = ?1 ORDER BY processed_at ASC").unwrap();
        let rows = stmt.query_map(params![order_id], row_to_record).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn list_audit_notes(&self, order_id: &str) -> Vec<AuditNote> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM audit_notes WHERE order_id = ?1 ORDER BY created_at DESC").unwrap();
        let rows = stmt.query_map(params![order_id], row_to_audit).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn list_exceptions(&self, order_id: &str) -> Vec<ExceptionReason> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM exception_reasons WHERE order_id = ?1 ORDER BY created_at DESC").unwrap();
        let rows = stmt.query_map(params![order_id], row_to_exception).unwrap();
        rows.filter_map(|r| r.ok()).collect()
    }

    pub fn update_order(&self, order: &InboundOrder) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE inbound_orders SET
                status=?1, version=?2, current_handler_role=?3, current_handler_id=?4,
                current_handler_name=?5, deadline=?6, updated_at=?7,
                appointment_evidence=?8, appointment_complete=?9,
                inspection_evidence=?10, inspection_complete=?11,
                registration_evidence=?12, registration_complete=?13,
                last_opinion=?14, last_attachment_id=?15, last_audit_note=?16
            WHERE id=?17",
            params![
                order.status.to_str(), order.version, order.current_handler_role,
                order.current_handler_id, order.current_handler_name,
                order.deadline.map(|d| d.to_rfc3339()),
                Utc::now().to_rfc3339(),
                order.appointment_evidence, if order.appointment_complete { 1 } else { 0 },
                order.inspection_evidence, if order.inspection_complete { 1 } else { 0 },
                order.registration_evidence, if order.registration_complete { 1 } else { 0 },
                order.last_opinion, order.last_attachment_id, order.last_audit_note,
                order.id
            ]
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn add_record(&self, rec: &ProcessingRecord) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO processing_records VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![rec.id, rec.order_id, rec.handler_id, rec.handler_name, rec.handler_role,
                rec.action, rec.opinion, rec.from_status, rec.to_status, rec.processed_at.to_rfc3339(), rec.attachment_id]
        ).unwrap();
    }

    pub fn add_audit_note(&self, note: &AuditNote) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO audit_notes VALUES (?1,?2,?3,?4,?5,?6)",
            params![note.id, note.order_id, note.note, note.created_by, note.created_at.to_rfc3339(), note.creator_role]
        ).unwrap();
    }

    pub fn add_exception(&self, exc: &ExceptionReason) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO exception_reasons VALUES (?1,?2,?3,?4,?5,?6)",
            params![exc.id, exc.order_id, exc.reason, exc.module, exc.created_by, exc.created_at.to_rfc3339()]
        ).unwrap();
    }

    pub fn add_attachment(&self, att: &Attachment) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO attachments VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![att.id, att.order_id, att.filename, att.uploaded_by, att.uploaded_at.to_rfc3339(), att.uploader_role, att.module]
        ).unwrap();
    }
}

fn row_to_order(row: &rusqlite::Row) -> rusqlite::Result<InboundOrder> {
    Ok(InboundOrder {
        id: row.get("id")?,
        order_no: row.get("order_no")?,
        supplier_name: row.get("supplier_name")?,
        material_name: row.get("material_name")?,
        quantity: row.get("quantity")?,
        status: OrderStatus::from_str(&row.get::<_, String>("status")?).unwrap(),
        version: row.get("version")?,
        current_handler_role: row.get("current_handler_role")?,
        current_handler_id: row.get("current_handler_id")?,
        current_handler_name: row.get("current_handler_name")?,
        deadline: row.get::<_, Option<String>>("deadline")?.and_then(|s| DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc))),
        created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>("created_at")?).unwrap().with_timezone(&Utc),
        updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>("updated_at")?).unwrap().with_timezone(&Utc),
        appointment_evidence: row.get("appointment_evidence")?,
        appointment_complete: row.get::<_, i64>("appointment_complete")? == 1,
        inspection_evidence: row.get("inspection_evidence")?,
        inspection_complete: row.get::<_, i64>("inspection_complete")? == 1,
        registration_evidence: row.get("registration_evidence")?,
        registration_complete: row.get::<_, i64>("registration_complete")? == 1,
        last_opinion: row.get("last_opinion")?,
        last_attachment_id: row.get("last_attachment_id")?,
        last_audit_note: row.get("last_audit_note")?,
    })
}

fn row_to_attachment(row: &rusqlite::Row) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        id: row.get("id")?,
        order_id: row.get("order_id")?,
        filename: row.get("filename")?,
        uploaded_by: row.get("uploaded_by")?,
        uploaded_at: DateTime::parse_from_rfc3339(&row.get::<_, String>("uploaded_at")?).unwrap().with_timezone(&Utc),
        uploader_role: row.get("uploader_role")?,
        module: row.get("module")?,
    })
}

fn row_to_record(row: &rusqlite::Row) -> rusqlite::Result<ProcessingRecord> {
    Ok(ProcessingRecord {
        id: row.get("id")?,
        order_id: row.get("order_id")?,
        handler_id: row.get("handler_id")?,
        handler_name: row.get("handler_name")?,
        handler_role: row.get("handler_role")?,
        action: row.get("action")?,
        opinion: row.get("opinion")?,
        from_status: row.get("from_status")?,
        to_status: row.get("to_status")?,
        processed_at: DateTime::parse_from_rfc3339(&row.get::<_, String>("processed_at")?).unwrap().with_timezone(&Utc),
        attachment_id: row.get("attachment_id")?,
    })
}

fn row_to_audit(row: &rusqlite::Row) -> rusqlite::Result<AuditNote> {
    Ok(AuditNote {
        id: row.get("id")?,
        order_id: row.get("order_id")?,
        note: row.get("note")?,
        created_by: row.get("created_by")?,
        created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>("created_at")?).unwrap().with_timezone(&Utc),
        creator_role: row.get::<_, Option<String>>("creator_role")?.unwrap_or_default(),
    })
}

fn row_to_exception(row: &rusqlite::Row) -> rusqlite::Result<ExceptionReason> {
    Ok(ExceptionReason {
        id: row.get("id")?,
        order_id: row.get("order_id")?,
        reason: row.get("reason")?,
        module: row.get("module")?,
        created_by: row.get("created_by")?,
        created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>("created_at")?).unwrap().with_timezone(&Utc),
    })
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}
