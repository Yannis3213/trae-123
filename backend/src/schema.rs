use crate::auth::hash_password;
use crate::models::{CaseStatus, ProcessingStage, Role};
use chrono::{Duration, Utc};
use log::info;
use sqlx::{SqlitePool, sqlite::SqliteQueryResult};
use uuid::Uuid;

pub async fn init_database(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            real_name TEXT NOT NULL,
            role TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            case_number TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            case_type TEXT NOT NULL,
            location TEXT NOT NULL,
            reporter_name TEXT NOT NULL,
            reporter_phone TEXT NOT NULL,
            status TEXT NOT NULL,
            current_stage TEXT NOT NULL,
            current_handler_id TEXT,
            current_handler_name TEXT,
            registration_materials_complete INTEGER NOT NULL DEFAULT 0,
            dispatch_timeline_met INTEGER NOT NULL DEFAULT 1,
            followup_evidence_complete INTEGER NOT NULL DEFAULT 0,
            deadline TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            created_by TEXT NOT NULL,
            created_by_name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT
        )"#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            category TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_by_name TEXT NOT NULL,
            uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        )"#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS processing_records (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            stage TEXT NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            handler_id TEXT NOT NULL,
            handler_name TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            remarks TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        )"#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS audit_notes (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            note TEXT NOT NULL,
            anomaly_reason TEXT,
            noted_by TEXT NOT NULL,
            noted_by_name TEXT NOT NULL,
            noted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        )"#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_cases_stage ON cases(current_stage)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_cases_deadline ON cases(deadline)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_attachments_case ON attachments(case_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_records_case ON processing_records(case_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notes_case ON audit_notes(case_id)")
        .execute(pool)
        .await?;

    info!("数据库表初始化完成");
    Ok(())
}

pub async fn seed_demo_data(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        info!("演示数据已存在，跳过初始化");
        return Ok(());
    }

    let dispatcher_pw = hash_password("123456").await?;
    let officer_pw = hash_password("123456").await?;
    let reviewer_pw = hash_password("123456").await?;

    let dispatcher_id = Uuid::new_v4();
    let officer_id = Uuid::new_v4();
    let reviewer_id = Uuid::new_v4();

    sqlx::query(
        r#"INSERT INTO users (id, username, real_name, role, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
    )
    .bind(dispatcher_id.to_string())
    .bind("dispatcher")
    .bind("张登记")
    .bind(Role::Dispatcher.as_str())
    .bind(&dispatcher_pw)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"INSERT INTO users (id, username, real_name, role, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
    )
    .bind(officer_id.to_string())
    .bind("officer")
    .bind("李主管")
    .bind(Role::PoliceOfficer.as_str())
    .bind(&officer_pw)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"INSERT INTO users (id, username, real_name, role, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
    )
    .bind(reviewer_id.to_string())
    .bind("reviewer")
    .bind("王所长")
    .bind(Role::Reviewer.as_str())
    .bind(&reviewer_pw)
    .execute(pool)
    .await?;

    info!("用户数据初始化完成");

    let now = Utc::now();
    let cases = vec![
        (
            "JQ202606001",
            "正常流转案件-邻里纠纷调解",
            "某小区A栋302与402居民因噪音问题发生争执，已报警。",
            "民事纠纷",
            "阳光花园A栋",
            "张三",
            "13800138001",
            CaseStatus::Completed,
            ProcessingStage::Review,
            false,
            true,
            true,
            now + Duration::days(10),
            4,
            dispatcher_id,
            "张登记",
            Some(officer_id),
            Some("李主管".to_string()),
        ),
        (
            "JQ202606002",
            "待补正案件-盗窃案缺少报案笔录",
            "某便利店被盗现金5000元，监控模糊。",
            "刑事案件",
            "幸福路便利店",
            "李四",
            "13800138002",
            CaseStatus::PendingCorrection,
            ProcessingStage::Registration,
            false,
            true,
            false,
            now + Duration::days(5),
            2,
            dispatcher_id,
            "张登记",
            None,
            None,
        ),
        (
            "JQ202606003",
            "临期案件-交通事故理赔未跟进",
            "两车追尾，无人员伤亡，责任认定已出。",
            "交通事故",
            "人民路与建设路交叉口",
            "王五",
            "13800138003",
            CaseStatus::UnderReview,
            ProcessingStage::Dispatch,
            true,
            true,
            true,
            now + Duration::days(1),
            3,
            dispatcher_id,
            "张登记",
            Some(officer_id),
            Some("李主管".to_string()),
        ),
        (
            "JQ202606004",
            "逾期案件-打架斗殴案未办结",
            "某酒吧门口发生群殴事件，3人受伤。",
            "治安案件",
            "夜色酒吧门口",
            "赵六",
            "13800138004",
            CaseStatus::UnderReview,
            ProcessingStage::Dispatch,
            true,
            false,
            false,
            now - Duration::days(3),
            3,
            dispatcher_id,
            "张登记",
            Some(officer_id),
            Some("李主管".to_string()),
        ),
        (
            "JQ202606005",
            "退回补正-诈骗案证据不足",
            "受害人被电信诈骗2万元，已止付。",
            "刑事案件",
            "线上/电话诈骗",
            "孙七",
            "13800138005",
            CaseStatus::PendingCorrection,
            ProcessingStage::Registration,
            false,
            true,
            false,
            now + Duration::days(7),
            3,
            dispatcher_id,
            "张登记",
            None,
            None,
        ),
        (
            "JQ202606006",
            "复核中案件-寻衅滋事待所领导审批",
            "某工地工人因工资问题围堵项目部。",
            "治安案件",
            "城东工地项目部",
            "周八",
            "13800138006",
            CaseStatus::UnderReview,
            ProcessingStage::Review,
            true,
            true,
            true,
            now + Duration::days(3),
            4,
            dispatcher_id,
            "张登记",
            Some(reviewer_id),
            Some("王所长".to_string()),
        ),
        (
            "JQ202606007",
            "状态冲突测试-已办结但材料不全",
            "遗失物品求助。",
            "求助",
            "人民公园",
            "吴九",
            "13800138007",
            CaseStatus::UnderReview,
            ProcessingStage::Dispatch,
            false,
            true,
            false,
            now + Duration::days(4),
            2,
            dispatcher_id,
            "张登记",
            Some(officer_id),
            Some("李主管".to_string()),
        ),
        (
            "JQ202606008",
            "批量处理测试1-纠纷调解",
            "楼上楼下漏水纠纷。",
            "民事纠纷",
            "和谐小区5栋",
            "郑十",
            "13800138008",
            CaseStatus::UnderReview,
            ProcessingStage::Dispatch,
            true,
            true,
            true,
            now + Duration::days(6),
            3,
            dispatcher_id,
            "张登记",
            Some(officer_id),
            Some("李主管".to_string()),
        ),
        (
            "JQ202606009",
            "批量处理测试2-超时未处理",
            "噪音扰民投诉。",
            "求助",
            "美食街烧烤摊",
            "冯十一",
            "13800138009",
            CaseStatus::UnderReview,
            ProcessingStage::Dispatch,
            true,
            false,
            false,
            now - Duration::days(5),
            2,
            dispatcher_id,
            "张登记",
            Some(officer_id),
            Some("李主管".to_string()),
        ),
        (
            "JQ202606010",
            "批量处理测试3-材料完整待复核",
            "宠物伤人事件。",
            "民事纠纷",
            "宠物医院门口",
            "陈十二",
            "13800138010",
            CaseStatus::UnderReview,
            ProcessingStage::Review,
            true,
            true,
            true,
            now + Duration::days(2),
            4,
            dispatcher_id,
            "张登记",
            Some(reviewer_id),
            Some("王所长".to_string()),
        ),
    ];

    for (
        case_number,
        title,
        description,
        case_type,
        location,
        reporter_name,
        reporter_phone,
        status,
        current_stage,
        reg_complete,
        dispatch_met,
        followup_complete,
        deadline,
        version,
        created_by,
        created_by_name,
        handler_id,
        handler_name,
    ) in cases
    {
        let case_id = Uuid::new_v4();
        let completed_at = if status == CaseStatus::Completed {
            Some((now - Duration::hours(2)).to_rfc3339())
        } else {
            None
        };

        sqlx::query!(
            r#"INSERT INTO cases (
                id, case_number, title, description, case_type, location,
                reporter_name, reporter_phone, status, current_stage,
                current_handler_id, current_handler_name,
                registration_materials_complete, dispatch_timeline_met, followup_evidence_complete,
                deadline, version, created_by, created_by_name, created_at, updated_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)"#,
            case_id.to_string(),
            case_number,
            title,
            description,
            case_type,
            location,
            reporter_name,
            reporter_phone,
            status.as_str(),
            current_stage.as_str(),
            handler_id.map(|id| id.to_string()),
            handler_name,
            reg_complete as i32,
            dispatch_met as i32,
            followup_complete as i32,
            deadline.to_rfc3339(),
            version,
            created_by.to_string(),
            created_by_name,
            completed_at
        )
        .execute(pool)
        .await?;

        if status != CaseStatus::PendingCorrection || case_number == "JQ202606002" || case_number == "JQ202606005" {
            seed_processing_records(
                pool,
                case_id,
                case_number,
                status,
                current_stage,
                dispatcher_id,
                "张登记",
                officer_id,
                "李主管",
                reviewer_id,
                "王所长",
            )
            .await?;
        }

        if reg_complete {
            let attach_id = Uuid::new_v4();
            sqlx::query!(
                r#"INSERT INTO attachments (id, case_id, file_name, file_type, file_size, category, uploaded_by, uploaded_by_name, uploaded_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
                attach_id.to_string(),
                case_id.to_string(),
                format!("{}_报案笔录.pdf", case_number),
                "application/pdf",
                204800i64,
                "registration",
                dispatcher_id.to_string(),
                "张登记"
            )
            .execute(pool)
            .await?;

            if case_number != "JQ202606007" {
                let attach2_id = Uuid::new_v4();
                sqlx::query!(
                    r#"INSERT INTO attachments (id, case_id, file_name, file_type, file_size, category, uploaded_by, uploaded_by_name, uploaded_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
                    attach2_id.to_string(),
                    case_id.to_string(),
                    format!("{}_现场照片.jpg", case_number),
                    "image/jpeg",
                    1024000i64,
                    "evidence",
                    officer_id.to_string(),
                    "李主管"
                )
                .execute(pool)
                .await?;
            }
        }

        if followup_complete && case_number != "JQ202606007" {
            let attach3_id = Uuid::new_v4();
            sqlx::query!(
                r#"INSERT INTO attachments (id, case_id, file_name, file_type, file_size, category, uploaded_by, uploaded_by_name, uploaded_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
                attach3_id.to_string(),
                case_id.to_string(),
                format!("{}_回访录音.mp3", case_number),
                "audio/mpeg",
                5120000i64,
                "followup",
                officer_id.to_string(),
                "李主管"
            )
            .execute(pool)
            .await?;
        }

        if case_number == "JQ202606002" || case_number == "JQ202606005" {
            let note_id = Uuid::new_v4();
            let reason = if case_number == "JQ202606002" {
                "缺少报案人签字笔录和现场勘验记录"
            } else {
                "银行转账凭证未上传，通话录音不完整"
            };
            sqlx::query!(
                r#"INSERT INTO audit_notes (id, case_id, note, anomaly_reason, noted_by, noted_by_name, noted_at)
                   VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
                note_id.to_string(),
                case_id.to_string(),
                format!("退回补正：{}", reason),
                reason,
                reviewer_id.to_string(),
                "王所长"
            )
            .execute(pool)
            .await?;
        }

        if case_number == "JQ202606004" || case_number == "JQ202606009" {
            let note_id = Uuid::new_v4();
            let reason = "已超过办理期限3天，请民警说明原因并加快处理";
            sqlx::query!(
                r#"INSERT INTO audit_notes (id, case_id, note, anomaly_reason, noted_by, noted_by_name, noted_at)
                   VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
                note_id.to_string(),
                case_id.to_string(),
                format!("逾期预警：{}", reason),
                reason,
                reviewer_id.to_string(),
                "王所长"
            )
            .execute(pool)
            .await?;
        }
    }

    info!("演示警情数据初始化完成，共10条记录");
    Ok(())
}

async fn seed_processing_records(
    pool: &SqlitePool,
    case_id: Uuid,
    case_number: &str,
    status: CaseStatus,
    stage: ProcessingStage,
    dispatcher_id: Uuid,
    dispatcher_name: &str,
    officer_id: Uuid,
    officer_name: &str,
    reviewer_id: Uuid,
    reviewer_name: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let records: Vec<(
        ProcessingStage,
        &str,
        Option<CaseStatus>,
        CaseStatus,
        Uuid,
        &str,
        Role,
        &str,
    )> = match (case_number, status, stage) {
        (_, CaseStatus::Completed, _) => vec![
            (
                ProcessingStage::Registration,
                "接警登记",
                None,
                CaseStatus::UnderReview,
                dispatcher_id,
                dispatcher_name,
                Role::Dispatcher,
                "警情登记完成，材料齐全，移交民警处理",
            ),
            (
                ProcessingStage::Dispatch,
                "民警处置",
                Some(CaseStatus::UnderReview),
                CaseStatus::UnderReview,
                officer_id,
                officer_name,
                Role::PoliceOfficer,
                "已完成现场处置，派警及时，回访确认证据齐全",
            ),
            (
                ProcessingStage::Review,
                "所领导复核",
                Some(CaseStatus::UnderReview),
                CaseStatus::Completed,
                reviewer_id,
                reviewer_name,
                Role::Reviewer,
                "材料完整、处置及时、回访到位，予以办结",
            ),
        ],
        (c, CaseStatus::PendingCorrection, _) if c == "JQ202606002" || c == "JQ202606005" => vec![
            (
                ProcessingStage::Registration,
                "接警登记",
                None,
                CaseStatus::UnderReview,
                dispatcher_id,
                dispatcher_name,
                Role::Dispatcher,
                "初步登记完成，等待审核",
            ),
            (
                ProcessingStage::Registration,
                "退回补正",
                Some(CaseStatus::UnderReview),
                CaseStatus::PendingCorrection,
                reviewer_id,
                reviewer_name,
                Role::Reviewer,
                "材料不齐全，退回登记员补充",
            ),
        ],
        (_, CaseStatus::UnderReview, ProcessingStage::Dispatch) => vec![
            (
                ProcessingStage::Registration,
                "接警登记",
                None,
                CaseStatus::UnderReview,
                dispatcher_id,
                dispatcher_name,
                Role::Dispatcher,
                "警情登记完成，移交民警处理",
            ),
            (
                ProcessingStage::Dispatch,
                "民警处置中",
                Some(CaseStatus::UnderReview),
                CaseStatus::UnderReview,
                officer_id,
                officer_name,
                Role::PoliceOfficer,
                "正在开展调查取证工作",
            ),
        ],
        (_, CaseStatus::UnderReview, ProcessingStage::Review) => vec![
            (
                ProcessingStage::Registration,
                "接警登记",
                None,
                CaseStatus::UnderReview,
                dispatcher_id,
                dispatcher_name,
                Role::Dispatcher,
                "警情登记完成，材料齐全",
            ),
            (
                ProcessingStage::Dispatch,
                "民警处置",
                Some(CaseStatus::UnderReview),
                CaseStatus::UnderReview,
                officer_id,
                officer_name,
                Role::PoliceOfficer,
                "处置完成，派警及时，证据齐全，移交复核",
            ),
        ],
        _ => vec![],
    };

    for (stage, action, from_status, to_status, handler_id, handler_name, handler_role, remarks) in records {
        let record_id = Uuid::new_v4();
        sqlx::query!(
            r#"INSERT INTO processing_records (
                id, case_id, stage, action, from_status, to_status,
                handler_id, handler_name, handler_role, remarks, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
            record_id.to_string(),
            case_id.to_string(),
            stage.as_str(),
            action,
            from_status.map(|s| s.as_str()),
            to_status.as_str(),
            handler_id.to_string(),
            handler_name,
            handler_role.as_str(),
            remarks
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}
