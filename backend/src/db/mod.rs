use rusqlite::{Connection, params};
use std::sync::Mutex;
use uuid::Uuid;
use chrono::Utc;
use crate::models::*;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Self {
        let conn = Connection::open("nursing_home.db").expect("Failed to open database");
        let db = Database { conn: Mutex::new(conn) };
        db.init_tables();
        db.seed_data();
        db
    }

    fn init_tables(&self) {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL,
                display_name TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS care_plans (
                id TEXT PRIMARY KEY,
                plan_no TEXT UNIQUE NOT NULL,
                elder_name TEXT NOT NULL,
                elder_id_card TEXT NOT NULL,
                room_no TEXT NOT NULL,
                admission_date TEXT NOT NULL,
                status TEXT NOT NULL,
                current_handler TEXT NOT NULL,
                responsible_person TEXT NOT NULL,
                deadline TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                assessment_done INTEGER NOT NULL DEFAULT 0,
                assessment_note TEXT,
                plan_done INTEGER NOT NULL DEFAULT 0,
                plan_note TEXT,
                family_confirmed INTEGER NOT NULL DEFAULT 0,
                family_note TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                care_plan_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                uploaded_by TEXT NOT NULL,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY (care_plan_id) REFERENCES care_plans(id)
            );

            CREATE TABLE IF NOT EXISTS processing_records (
                id TEXT PRIMARY KEY,
                care_plan_id TEXT NOT NULL,
                action TEXT NOT NULL,
                operator TEXT NOT NULL,
                operator_role TEXT NOT NULL,
                prev_status TEXT NOT NULL,
                new_status TEXT NOT NULL,
                remark TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (care_plan_id) REFERENCES care_plans(id)
            );

            CREATE TABLE IF NOT EXISTS audit_notes (
                id TEXT PRIMARY KEY,
                care_plan_id TEXT NOT NULL,
                operator TEXT NOT NULL,
                operator_role TEXT NOT NULL,
                action TEXT NOT NULL,
                prev_status TEXT NOT NULL,
                new_status TEXT NOT NULL,
                success INTEGER NOT NULL,
                failure_reason TEXT,
                remark TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (care_plan_id) REFERENCES care_plans(id)
            );

            CREATE TABLE IF NOT EXISTS exception_reasons (
                id TEXT PRIMARY KEY,
                care_plan_id TEXT NOT NULL,
                exception_type TEXT NOT NULL,
                description TEXT NOT NULL,
                operator TEXT NOT NULL,
                resolved INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                resolved_at TEXT,
                FOREIGN KEY (care_plan_id) REFERENCES care_plans(id)
            );
            "#
        ).expect("Failed to create tables");
    }

    fn seed_data(&self) {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0)).unwrap_or(0);
        if count > 0 {
            return;
        }

        let now = Utc::now().to_rfc3339();
        let users = vec![
            (Uuid::new_v4().to_string(), "registrar", "registrar", "李登记", "token-registrar-001"),
            (Uuid::new_v4().to_string(), "supervisor", "supervisor", "王主管", "token-supervisor-002"),
            (Uuid::new_v4().to_string(), "director", "director", "张主任", "token-director-003"),
        ];
        for (id, username, role, display_name, token) in &users {
            conn.execute(
                "INSERT INTO users (id, username, role, display_name, token) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![id, username, role, display_name, token],
            ).unwrap();
        }

        let today = chrono::Local::now();
        let fmt_date = |d: chrono::DateTime<chrono::Local>| d.format("%Y-%m-%d").to_string();

        let plans = vec![
            (
                Uuid::new_v4().to_string(),
                "HLJH-2026-0001",
                "陈婆婆",
                "110101194501011234",
                "A栋301",
                "2025-06-15",
                "待派发",
                "李登记",
                "李登记",
                fmt_date(today + chrono::Duration::days(5)),
                false, None, false, None, false, None,
            ),
            (
                Uuid::new_v4().to_string(),
                "HLJH-2026-0002",
                "刘爷爷",
                "110101194002025678",
                "B栋205",
                "2025-08-20",
                "处理中",
                "王主管",
                "王主管",
                fmt_date(today + chrono::Duration::days(2)),
                true, Some("完成入住评估，ADL评分65分".to_string()), true, Some("制定基础护理方案".to_string()), false, None,
            ),
            (
                Uuid::new_v4().to_string(),
                "HLJH-2026-0003",
                "赵奶奶",
                "110101193803039012",
                "A栋108",
                "2025-03-10",
                "处理中",
                "张主任",
                "张主任",
                fmt_date(today + chrono::Duration::days(7)),
                true, Some("入住评估完成，需特级护理".to_string()), true, Some("特级护理方案已制定".to_string()), true, Some("家属已签字确认".to_string()),
            ),
            (
                Uuid::new_v4().to_string(),
                "HLJH-2026-0004",
                "孙爷爷",
                "110101194204043456",
                "C栋402",
                "2025-09-01",
                "处理中",
                "王主管",
                "王主管",
                fmt_date(today - chrono::Duration::days(1)),
                true, Some("评估完成".to_string()), false, None, false, None,
            ),
            (
                Uuid::new_v4().to_string(),
                "HLJH-2026-0005",
                "周奶奶",
                "110101195005057890",
                "B栋303",
                "2026-01-15",
                "已关闭",
                "张主任",
                "张主任",
                fmt_date(today - chrono::Duration::days(10)),
                true, Some("评估完成".to_string()), true, Some("方案制定完成".to_string()), true, Some("家属确认完成".to_string()),
            ),
            (
                Uuid::new_v4().to_string(),
                "HLJH-2026-0006",
                "吴爷爷",
                "110101194806061234",
                "A栋201",
                "2026-02-01",
                "处理中",
                "李登记",
                "王主管",
                fmt_date(today + chrono::Duration::days(1)),
                true, Some("评估完成，材料需补充".to_string()), true, None, false, None,
            ),
        ];

        for (id, plan_no, elder_name, elder_id_card, room_no, admission_date, status,
             current_handler, responsible_person, deadline,
             assessment_done, assessment_note, plan_done, plan_note, family_confirmed, family_note) in &plans {
            conn.execute(
                r#"INSERT INTO care_plans (
                    id, plan_no, elder_name, elder_id_card, room_no, admission_date,
                    status, current_handler, responsible_person, deadline,
                    version, assessment_done, assessment_note, plan_done, plan_note,
                    family_confirmed, family_note, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17)"#,
                params![
                    id, plan_no, elder_name, elder_id_card, room_no, admission_date,
                    status, current_handler, responsible_person, deadline,
                    *assessment_done as i32, assessment_note, *plan_done as i32, plan_note,
                    *family_confirmed as i32, family_note, now
                ],
            ).unwrap();
        }
    }

    pub fn get_user_by_token(&self, token: &str) -> Option<User> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, username, role, display_name, token FROM users WHERE token = ?1").unwrap();
        let user = stmt.query_row(params![token], |row| {
            Ok(User {
                id: Uuid::parse_str(&row.get::<_, String>(0).unwrap()).unwrap(),
                username: row.get(1).unwrap(),
                role: Role::from_str(&row.get::<_, String>(2).unwrap()).unwrap(),
                display_name: row.get(3).unwrap(),
                token: row.get(4).unwrap(),
            })
        }).ok();
        user
    }
}
