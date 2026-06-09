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
        let hours_ago = |h: i64| (Utc::now() - chrono::Duration::hours(h)).to_rfc3339();

        let plans: Vec<(String, String, String, String, String, String, String, String, String, String, bool, Option<String>, bool, Option<String>, bool, Option<String>)> = vec![
            (Uuid::new_v4().to_string(), "HLJH-2026-0001".into(), "陈婆婆".into(), "110101194501011234".into(), "A栋301".into(), "2025-06-15".into(), "待派发".into(), "李登记".into(), "李登记".into(), fmt_date(today + chrono::Duration::days(5)), false, None, false, None, false, None),
            (Uuid::new_v4().to_string(), "HLJH-2026-0002".into(), "刘爷爷".into(), "110101194002025678".into(), "B栋205".into(), "2025-08-20".into(), "处理中".into(), "王主管".into(), "王主管".into(), fmt_date(today + chrono::Duration::days(2)), true, Some("完成入住评估，ADL评分65分".into()), true, Some("制定基础护理方案".into()), false, None),
            (Uuid::new_v4().to_string(), "HLJH-2026-0003".into(), "赵奶奶".into(), "110101193803039012".into(), "A栋108".into(), "2025-03-10".into(), "处理中".into(), "张主任".into(), "张主任".into(), fmt_date(today + chrono::Duration::days(7)), true, Some("入住评估完成，需特级护理".into()), true, Some("特级护理方案已制定".into()), true, Some("家属已签字确认".into())),
            (Uuid::new_v4().to_string(), "HLJH-2026-0004".into(), "孙爷爷".into(), "110101194204043456".into(), "C栋402".into(), "2025-09-01".into(), "处理中".into(), "王主管".into(), "王主管".into(), fmt_date(today - chrono::Duration::days(1)), true, Some("评估完成".into()), false, None, false, None),
            (Uuid::new_v4().to_string(), "HLJH-2026-0005".into(), "周奶奶".into(), "110101195005057890".into(), "B栋303".into(), "2026-01-15".into(), "已关闭".into(), "张主任".into(), "张主任".into(), fmt_date(today - chrono::Duration::days(10)), true, Some("评估完成".into()), true, Some("方案制定完成".into()), true, Some("家属确认完成".into())),
            (Uuid::new_v4().to_string(), "HLJH-2026-0006".into(), "吴爷爷".into(), "110101194806061234".into(), "A栋201".into(), "2026-02-01".into(), "处理中".into(), "李登记".into(), "王主管".into(), fmt_date(today + chrono::Duration::days(1)), true, Some("评估完成，材料需补充".into()), true, None, false, None),
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

        let plan_p3 = plans[2].0.clone();
        let plan_p2 = plans[1].0.clone();
        let plan_p4 = plans[3].0.clone();
        let plan_p6 = plans[5].0.clone();
        let plan_p5 = plans[4].0.clone();

        let attachments = vec![
            (Uuid::new_v4().to_string(), plan_p3.clone(), "家属签字确认单-赵奶奶.pdf".into(), "family_signature".into(), "王主管".into(), hours_ago(6)),
            (Uuid::new_v4().to_string(), plan_p3.clone(), "入住评估表-赵奶奶.xlsx".into(), "assessment".into(), "李登记".into(), hours_ago(72)),
            (Uuid::new_v4().to_string(), plan_p3.clone(), "特级护理方案-赵奶奶.docx".into(), "care_plan".into(), "王主管".into(), hours_ago(48)),
            (Uuid::new_v4().to_string(), plan_p2.clone(), "入住评估表-刘爷爷.xlsx".into(), "assessment".into(), "李登记".into(), hours_ago(24)),
            (Uuid::new_v4().to_string(), plan_p5.clone(), "家属签字确认单-周奶奶.pdf".into(), "family_signature".into(), "王主管".into(), hours_ago(240)),
        ];
        for (id, pid, fname, ftype, upby, time) in &attachments {
            conn.execute(
                "INSERT INTO attachments (id, care_plan_id, file_name, file_type, uploaded_by, uploaded_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, pid, fname, ftype, upby, time],
            ).unwrap();
        }

        let records = vec![
            (Uuid::new_v4().to_string(), plan_p3.clone(), "发起计划单".into(), "李登记".into(), "护理计划登记员".into(), "-".into(), "待派发".into(), None::<String>, hours_ago(96)),
            (Uuid::new_v4().to_string(), plan_p3.clone(), "派发至审核主管".into(), "李登记".into(), "护理计划登记员".into(), "待派发".into(), "处理中".into(), Some("材料齐全".into()), hours_ago(90)),
            (Uuid::new_v4().to_string(), plan_p3.clone(), "上传家属签字确认单".into(), "王主管".into(), "护理计划审核主管".into(), "处理中".into(), "处理中".into(), Some("家属已到院签字".into()), hours_ago(6)),
            (Uuid::new_v4().to_string(), plan_p3.clone(), "提交至院区主任复核".into(), "王主管".into(), "护理计划审核主管".into(), "处理中".into(), "处理中".into(), Some("所有模块完成".into()), hours_ago(5)),
            (Uuid::new_v4().to_string(), plan_p5.clone(), "院区主任复核通过，归档关闭".into(), "张主任".into(), "养老护理院复核负责人".into(), "处理中".into(), "已关闭".into(), Some("月底集中复核通过".into()), hours_ago(240)),
            (Uuid::new_v4().to_string(), plan_p6.clone(), "主管退回登记员补正".into(), "王主管".into(), "护理计划审核主管".into(), "处理中".into(), "处理中".into(), Some("缺家属签字材料".into()), hours_ago(12)),
        ];
        for (id, pid, action, op, opr, prev, new, remark, time) in &records {
            conn.execute(
                "INSERT INTO processing_records (id, care_plan_id, action, operator, operator_role, prev_status, new_status, remark, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![id, pid, action, op, opr, prev, new, remark, time],
            ).unwrap();
        }

        let audits = vec![
            (Uuid::new_v4().to_string(), plan_p3.clone(), "李登记".into(), "护理计划登记员".into(), "发起计划单".into(), "-".into(), "待派发".into(), true, None::<String>, None::<String>, hours_ago(96)),
            (Uuid::new_v4().to_string(), plan_p3.clone(), "李登记".into(), "护理计划登记员".into(), "派发计划单".into(), "待派发".into(), "处理中".into(), true, None::<String>, None::<String>, hours_ago(90)),
            (Uuid::new_v4().to_string(), plan_p4.clone(), "王主管".into(), "护理计划审核主管".into(), "提交复核".into(), "处理中".into(), "处理中".into(), false, Some("缺少必填证据：护理计划未完成".into()), None::<String>, hours_ago(3)),
            (Uuid::new_v4().to_string(), plan_p6.clone(), "王主管".into(), "护理计划审核主管".into(), "退回补正".into(), "处理中".into(), "处理中".into(), true, None::<String>, Some("缺家属签字材料".into()), hours_ago(12)),
            (Uuid::new_v4().to_string(), plan_p5.clone(), "张主任".into(), "养老护理院复核负责人".into(), "复核归档".into(), "处理中".into(), "已关闭".into(), true, None::<String>, Some("月底集中复核".into()), hours_ago(240)),
        ];
        for (id, pid, op, opr, action, prev, new, success, fail, remark, time) in &audits {
            conn.execute(
                "INSERT INTO audit_notes (id, care_plan_id, operator, operator_role, action, prev_status, new_status, success, failure_reason, remark, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![id, pid, op, opr, action, prev, new, *success as i32, fail, remark, time],
            ).unwrap();
        }

        let exceptions = vec![
            (Uuid::new_v4().to_string(), plan_p4.clone(), "缺少证据".into(), "护理计划模块未完成，无法提交复核".into(), "王主管".into(), false, hours_ago(3), None::<String>),
            (Uuid::new_v4().to_string(), plan_p6.clone(), "退回补正".into(), "缺家属签字材料，请补充后重新提交".into(), "王主管".into(), false, hours_ago(12), None::<String>),
            (Uuid::new_v4().to_string(), plan_p4.clone(), "临期预警".into(), "距截止日不足1天，请尽快完成护理计划模块".into(), "系统自动".into(), false, hours_ago(1), None::<String>),
        ];
        for (id, pid, etype, desc, op, resolved, time, rtime) in &exceptions {
            conn.execute(
                "INSERT INTO exception_reasons (id, care_plan_id, exception_type, description, operator, resolved, created_at, resolved_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![id, pid, etype, desc, op, *resolved as i32, time, rtime],
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
