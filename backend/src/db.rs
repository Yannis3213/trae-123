use sqlx::{SqlitePool, sqlite::SqlitePoolOptions, migrate};
use chrono::{Utc, Duration};
use crate::models::{UserRole, TopicStatus};

pub async fn init_pool(database_url: &str) -> anyhow::Result<SqlitePool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;
    Ok(pool)
}

pub async fn run_migrations(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS topics (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            source TEXT NOT NULL,
            priority TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL,
            applicant_id TEXT,
            applicant_name TEXT NOT NULL,
            current_handler_id TEXT,
            current_handler_name TEXT,
            interview_deadline TEXT,
            submission_deadline TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            attachment_type TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_url TEXT NOT NULL,
            description TEXT NOT NULL,
            uploaded_by TEXT NOT NULL,
            uploaded_by_name TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS process_records (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            handler_id TEXT NOT NULL,
            handler_name TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            opinion TEXT NOT NULL,
            remark TEXT,
            created_at TEXT NOT NULL,
            version_after INTEGER NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            topic_id TEXT,
            user_id TEXT NOT NULL,
            user_name TEXT NOT NULL,
            user_role TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT NOT NULL,
            ip_address TEXT,
            created_at TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_topics_handler ON topics(current_handler_id);")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_attachments_topic ON attachments(topic_id);")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_records_topic ON process_records(topic_id);")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_audits_topic ON audit_logs(topic_id);")
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn seed_data(pool: &SqlitePool) -> anyhow::Result<()> {
    let user_count: Option<i64> = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    if user_count.unwrap_or(0) > 0 {
        return Ok(());
    }

    let now = Utc::now();

    let registrar_id = uuid::Uuid::new_v4().to_string();
    let auditor_id = uuid::Uuid::new_v4().to_string();
    let reviewer_id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO users (id, username, password, role, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)"
    )
    .bind(&registrar_id).bind("zhuli").bind("zhuli123").bind(UserRole::Registrar.as_str()).bind("采编助理-张明").bind(now.to_rfc3339())
    .bind(&auditor_id).bind("bianji").bind("bianji123").bind(UserRole::Auditor.as_str()).bind("责任编辑-李华").bind(now.to_rfc3339())
    .bind(&reviewer_id).bind("zongbian").bind("zongbian123").bind(UserRole::Reviewer.as_str()).bind("总编室-王芳").bind(now.to_rfc3339())
    .execute(pool)
    .await?;

    let mut topics = Vec::new();

    let topic1_id = uuid::Uuid::new_v4().to_string();
    topics.push((
        topic1_id,
        "城市地铁四号线开通一周年专题报道".to_string(),
        "地铁四号线开通一年来的运营数据、市民出行变化、沿线商业发展等综合报道".to_string(),
        "市政宣传部".to_string(),
        "high".to_string(),
        "城市建设".to_string(),
        TopicStatus::PendingDispatch.slug().to_string(),
        registrar_id.clone(),
        "采编助理-张明".to_string(),
        None::<String>,
        None::<String>,
        Some(now + Duration::days(7)),
        Some(now + Duration::days(14)),
    ));

    let topic2_id = uuid::Uuid::new_v4().to_string();
    topics.push((
        topic2_id.clone(),
        "乡村振兴示范村采访系列".to_string(),
        "选取三个典型示范村，从产业、人才、文化、生态、组织五个维度进行深入报道".to_string(),
        "农业农村局".to_string(),
        "medium".to_string(),
        "乡村振兴".to_string(),
        TopicStatus::Processing.slug().to_string(),
        registrar_id.clone(),
        "采编助理-张明".to_string(),
        Some(auditor_id.clone()),
        Some("责任编辑-李华".to_string()),
        Some(now - Duration::days(1)),
        Some(now + Duration::days(5)),
    ));

    let topic3_id = uuid::Uuid::new_v4().to_string();
    topics.push((
        topic3_id.clone(),
        "智慧教育平台推广应用报道".to_string(),
        "市教育局推出的智慧教育平台在各校的应用情况，教师、学生、家长三方反馈".to_string(),
        "教育局".to_string(),
        "medium".to_string(),
        "教育科技".to_string(),
        TopicStatus::Returned.slug().to_string(),
        registrar_id.clone(),
        "采编助理-张明".to_string(),
        Some(registrar_id.clone()),
        Some("采编助理-张明".to_string()),
        Some(now + Duration::days(3)),
        Some(now + Duration::days(10)),
    ));

    let topic4_id = uuid::Uuid::new_v4().to_string();
    topics.push((
        topic4_id.clone(),
        "2024年度经济发展成就回顾".to_string(),
        "全年GDP增速、重点项目落地、民生改善、营商环境优化等方面的成就梳理".to_string(),
        "发改委".to_string(),
        "high".to_string(),
        "经济发展".to_string(),
        TopicStatus::Processing.slug().to_string(),
        registrar_id.clone(),
        "采编助理-张明".to_string(),
        Some(reviewer_id.clone()),
        Some("总编室-王芳".to_string()),
        Some(now - Duration::days(5)),
        Some(now - Duration::days(1)),
    ));

    let topic5_id = uuid::Uuid::new_v4().to_string();
    topics.push((
        topic5_id,
        "文化遗产保护与活化利用".to_string(),
        "辖区内三处省级文保单位的保护现状及活化利用探索".to_string(),
        "文旅局".to_string(),
        "low".to_string(),
        "文化传承".to_string(),
        TopicStatus::Closed.slug().to_string(),
        registrar_id.clone(),
        "采编助理-张明".to_string(),
        None::<String>,
        None::<String>,
        Some(now - Duration::days(30)),
        Some(now - Duration::days(20)),
    ));

    for (id, title, desc, source, priority, category, status, app_id, app_name, handler_id, handler_name, interview_dl, submission_dl) in &topics {
        sqlx::query(
            "INSERT INTO topics (id, title, description, source, priority, category, status, applicant_id, applicant_name, current_handler_id, current_handler_name, interview_deadline, submission_deadline, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)"
        )
        .bind(id).bind(title).bind(desc).bind(source).bind(priority).bind(category).bind(status)
        .bind(app_id).bind(app_name)
        .bind(handler_id.as_ref()).bind(handler_name)
        .bind(interview_dl.map(|d| d.to_rfc3339())).bind(submission_dl.map(|d| d.to_rfc3339()))
        .bind(now.to_rfc3339()).bind(now.to_rfc3339())
        .execute(pool)
        .await?;
    }

    let attach1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '选题申报', '选题申报表.pdf', '/uploads/form1.pdf', '选题正式申报表，含领导批示', ?, '采编助理-张明', ?)"
    )
    .bind(&attach1).bind(&topic2_id).bind(&registrar_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let attach2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '采访安排', '采访行程表.xlsx', '/uploads/schedule2.xlsx', '三个村庄的采访路线及联系人', ?, '责任编辑-李华', ?)"
    )
    .bind(&attach2).bind(&topic2_id).bind(&auditor_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let attach3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '选题申报', '选题申报表.pdf', '/uploads/form4.pdf', '经济成就选题申报表，含统计局数据', ?, '采编助理-张明', ?)"
    )
    .bind(&attach3).bind(&topic4_id).bind(&registrar_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let attach4 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '采访安排', '采访安排.docx', '/uploads/interview4.docx', '发改委、统计局采访安排', ?, '责任编辑-李华', ?)"
    )
    .bind(&attach4).bind(&topic4_id).bind(&auditor_id).bind((now - Duration::days(3)).to_rfc3339())
    .execute(pool).await?;

    let attach5 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '稿件提交', '初稿.docx', '/uploads/manu4_v1.docx', '第一版稿件初稿', ?, '责任编辑-李华', ?)"
    )
    .bind(&attach5).bind(&topic4_id).bind(&auditor_id).bind((now - Duration::days(2)).to_rfc3339())
    .execute(pool).await?;

    sqlx::query(
        "UPDATE topics SET version = 2 WHERE id = ?"
    )
    .bind(&topic4_id)
    .execute(pool).await?;

    let rec1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '创建', NULL, ?, ?, '采编助理-张明', 'registrar', '选题申报材料齐全，建议立项', NULL, ?, 1)"
    )
    .bind(&rec1).bind(&topic2_id).bind(TopicStatus::PendingDispatch.slug()).bind(&registrar_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let rec2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '派发', ?, ?, ?, '责任编辑-李华', 'auditor', '同意立项，由本组负责采访推进', '注意进度', ?, 1)"
    )
    .bind(&rec2).bind(&topic2_id).bind(TopicStatus::PendingDispatch.slug()).bind(TopicStatus::Processing.slug()).bind(&auditor_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let rec3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '创建', NULL, ?, ?, '采编助理-张明', 'registrar', '选题申报', NULL, ?, 1)"
    )
    .bind(&rec3).bind(&topic3_id).bind(TopicStatus::PendingDispatch.slug()).bind(&registrar_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let rec4 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '派发', ?, ?, ?, '责任编辑-李华', 'auditor', '同意立项', NULL, ?, 1)"
    )
    .bind(&rec4).bind(&topic3_id).bind(TopicStatus::PendingDispatch.slug()).bind(TopicStatus::Processing.slug()).bind(&auditor_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let rec5 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '退回补正', ?, ?, ?, '责任编辑-李华', 'auditor', '选题材料不完整，缺少具体学校名单和预期采访对象', '补充3所试点学校详细名单及联系方式', ?, 1)"
    )
    .bind(&rec5).bind(&topic3_id).bind(TopicStatus::Processing.slug()).bind(TopicStatus::Returned.slug()).bind(&auditor_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let rec6 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '创建', NULL, ?, ?, '采编助理-张明', 'registrar', '年度重点选题，建议加急', NULL, ?, 1)"
    )
    .bind(&rec6).bind(&topic4_id).bind(TopicStatus::PendingDispatch.slug()).bind(&registrar_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let rec7 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '派发', ?, ?, ?, '责任编辑-李华', 'auditor', '同意，本周内完成采访', '注意数据准确性', ?, 1)"
    )
    .bind(&rec7).bind(&topic4_id).bind(TopicStatus::PendingDispatch.slug()).bind(TopicStatus::Processing.slug()).bind(&auditor_id).bind(now.to_rfc3339())
    .execute(pool).await?;

    let rec8 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '提交复核', ?, ?, ?, '责任编辑-李华', 'auditor', '稿件已完成，采访证据齐全，提请复核', '附采访录音转写3份', ?, 2)"
    )
    .bind(&rec8).bind(&topic4_id).bind(TopicStatus::Processing.slug()).bind(TopicStatus::Processing.slug()).bind(&auditor_id).bind((now - Duration::days(1)).to_rfc3339())
    .execute(pool).await?;

    Ok(())
}
