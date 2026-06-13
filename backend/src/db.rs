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
    sqlx::query("DELETE FROM audit_logs").execute(pool).await?;
    sqlx::query("DELETE FROM process_records").execute(pool).await?;
    sqlx::query("DELETE FROM attachments").execute(pool).await?;
    sqlx::query("DELETE FROM topics").execute(pool).await?;
    sqlx::query("DELETE FROM users").execute(pool).await?;

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
        topic1_id.clone(),
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
        topic5_id.clone(),
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

    // ===== A) 新增 attachments =====
    // topic1（地铁四号线：正常流转，PendingDispatch）：新增 1 条「选题申报」
    let attach_t1_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '选题申报', '地铁四号线选题申报表.pdf', '/uploads/form_t1.pdf', '含市政宣传部函件及初步报道方案', ?, '采编助理-张明', ?)"
    )
    .bind(&attach_t1_1).bind(&topic1_id).bind(&registrar_id).bind((now - Duration::hours(2)).to_rfc3339())
    .execute(pool).await?;

    // topic3（智慧教育：退回补正）：新增 1 条「选题申报」，故意缺采访安排和稿件提交
    let attach_t3_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '选题申报', '智慧教育选题申报表.pdf', '/uploads/form_t3.pdf', '教育局函件，缺具体学校名单', ?, '采编助理-张明', ?)"
    )
    .bind(&attach_t3_1).bind(&topic3_id).bind(&registrar_id).bind((now - Duration::days(2)).to_rfc3339())
    .execute(pool).await?;

    // topic5（文化遗产：已关闭闭环）：新增 3 条附件
    let attach_t5_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '选题申报', '文化遗产选题申报表.pdf', '/uploads/form_t5.pdf', '文旅局正式申报函及文保单位清单', ?, '采编助理-张明', ?)"
    )
    .bind(&attach_t5_1).bind(&topic5_id).bind(&registrar_id).bind((now - Duration::days(45)).to_rfc3339())
    .execute(pool).await?;

    let attach_t5_2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '采访安排', '文保单位采访安排.docx', '/uploads/interview_t5.docx', '三处文保单位采访路线及专家名单', ?, '责任编辑-李华', ?)"
    )
    .bind(&attach_t5_2).bind(&topic5_id).bind(&auditor_id).bind((now - Duration::days(40)).to_rfc3339())
    .execute(pool).await?;

    let attach_t5_3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attachments (id, topic_id, attachment_type, file_name, file_url, description, uploaded_by, uploaded_by_name, uploaded_at) VALUES (?, ?, '稿件提交', '文化遗产保护成稿.docx', '/uploads/manu_t5_final.docx', '最终成稿含图文资料，约8000字', ?, '责任编辑-李华', ?)"
    )
    .bind(&attach_t5_3).bind(&topic5_id).bind(&auditor_id).bind((now - Duration::days(25)).to_rfc3339())
    .execute(pool).await?;

    // ===== B) 新增 process_records =====
    // topic1（正常流转）：只需要「创建」一条，不派发，保持 PendingDispatch
    let rec_t1_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '创建', NULL, ?, ?, '采编助理-张明', 'registrar', '重点宣传选题，建议高优先级派发', NULL, ?, 1)"
    )
    .bind(&rec_t1_1).bind(&topic1_id).bind(TopicStatus::PendingDispatch.slug()).bind(&registrar_id).bind((now - Duration::hours(3)).to_rfc3339())
    .execute(pool).await?;

    // topic5（已关闭闭环）：补齐完整 5 步记录
    let rec_t5_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '创建', NULL, ?, ?, '采编助理-张明', 'registrar', '文旅局申报，辖区内三处省级文保单位系列报道', NULL, ?, 1)"
    )
    .bind(&rec_t5_1).bind(&topic5_id).bind(TopicStatus::PendingDispatch.slug()).bind(&registrar_id).bind((now - Duration::days(45)).to_rfc3339())
    .execute(pool).await?;

    let rec_t5_2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '派发', ?, ?, ?, '责任编辑-李华', 'auditor', '同意立项，文化组负责推进', '注意文物保护单位采访合规', ?, 1)"
    )
    .bind(&rec_t5_2).bind(&topic5_id).bind(TopicStatus::PendingDispatch.slug()).bind(TopicStatus::Processing.slug()).bind(&auditor_id).bind((now - Duration::days(42)).to_rfc3339())
    .execute(pool).await?;

    let rec_t5_3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '进度更新', ?, ?, ?, '责任编辑-李华', 'auditor', '已完成三处文保单位现场采访及专家访谈，正在整理素材', '已采集照片200余张、录音15小时', ?, 1)"
    )
    .bind(&rec_t5_3).bind(&topic5_id).bind(TopicStatus::Processing.slug()).bind(TopicStatus::Processing.slug()).bind(&auditor_id).bind((now - Duration::days(30)).to_rfc3339())
    .execute(pool).await?;

    let rec_t5_4 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '提交复核', ?, ?, ?, '责任编辑-李华', 'auditor', '稿件已完成三审三校，采访证据齐全，提请总编室复核', '附专家签字确认材料', ?, 2)"
    )
    .bind(&rec_t5_4).bind(&topic5_id).bind(TopicStatus::Processing.slug()).bind(TopicStatus::Processing.slug()).bind(&auditor_id).bind((now - Duration::days(22)).to_rfc3339())
    .execute(pool).await?;

    sqlx::query("UPDATE topics SET current_handler_id = ?, current_handler_name = ?, version = 2 WHERE id = ?")
        .bind(&reviewer_id).bind("总编室-王芳").bind(&topic5_id)
        .execute(pool).await?;

    let rec_t5_5 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO process_records (id, topic_id, action, from_status, to_status, handler_id, handler_name, handler_role, opinion, remark, created_at, version_after) VALUES (?, ?, '关闭', ?, ?, ?, '总编室-王芳', 'reviewer', '复核通过，稿件质量优良，证据链完整，同意关闭归档', '已推送至下月见报计划', ?, 3)"
    )
    .bind(&rec_t5_5).bind(&topic5_id).bind(TopicStatus::Processing.slug()).bind(TopicStatus::Closed.slug()).bind(&reviewer_id).bind((now - Duration::days(15)).to_rfc3339())
    .execute(pool).await?;

    sqlx::query("UPDATE topics SET current_handler_id = NULL, current_handler_name = NULL, status = ?, version = 3 WHERE id = ?")
        .bind(TopicStatus::Closed.slug()).bind(&topic5_id)
        .execute(pool).await?;

    // ===== C) 新增 audit_logs =====
    // === topic1 审计记录：5条 ===
    let audit_t1_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '采编助理-张明', 'registrar', 'CREATE_TOPIC', '创建选题单「城市地铁四号线开通一周年专题报道」', '192.168.1.101', ?)"
    )
    .bind(&audit_t1_1).bind(&topic1_id).bind(&registrar_id).bind((now - Duration::hours(3)).to_rfc3339())
    .execute(pool).await?;

    let audit_t1_2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '采编助理-张明', 'registrar', 'UPLOAD_ATTACHMENT', '上传附件「选题申报-地铁四号线选题申报表.pdf」', '192.168.1.101', ?)"
    )
    .bind(&audit_t1_2).bind(&topic1_id).bind(&registrar_id).bind((now - Duration::hours(2)).to_rfc3339())
    .execute(pool).await?;

    let audit_t1_3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'VIEW_TOPIC', '查看选题单详情，评估派发优先级', '192.168.1.102', ?)"
    )
    .bind(&audit_t1_3).bind(&topic1_id).bind(&auditor_id).bind((now - Duration::hours(1)).to_rfc3339())
    .execute(pool).await?;

    let audit_t1_4 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '总编室-王芳', 'reviewer', 'VIEW_TOPIC', '浏览选题单列表时查看该高优先级选题', '192.168.1.103', ?)"
    )
    .bind(&audit_t1_4).bind(&topic1_id).bind(&reviewer_id).bind((now - Duration::minutes(30)).to_rfc3339())
    .execute(pool).await?;

    let audit_t1_5 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '采编助理-张明', 'registrar', 'VIEW_TOPIC', '申报人再次查看选题单状态', '192.168.1.101', ?)"
    )
    .bind(&audit_t1_5).bind(&topic1_id).bind(&registrar_id).bind((now - Duration::minutes(10)).to_rfc3339())
    .execute(pool).await?;

    // === topic2 审计记录：5条（乡村振兴：逾期+缺材料）===
    let audit_t2_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '采编助理-张明', 'registrar', 'CREATE_TOPIC', '创建选题单「乡村振兴示范村采访系列」', '192.168.1.101', ?)"
    )
    .bind(&audit_t2_1).bind(&topic2_id).bind(&registrar_id).bind((now - Duration::days(5)).to_rfc3339())
    .execute(pool).await?;

    let audit_t2_2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'DISPATCH', '派发领取选题单，由本组负责采访推进', '192.168.1.102', ?)"
    )
    .bind(&audit_t2_2).bind(&topic2_id).bind(&auditor_id).bind((now - Duration::days(4)).to_rfc3339())
    .execute(pool).await?;

    let audit_t2_3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'UPLOAD_ATTACHMENT', '上传附件「采访安排-采访行程表.xlsx」', '192.168.1.102', ?)"
    )
    .bind(&audit_t2_3).bind(&topic2_id).bind(&auditor_id).bind((now - Duration::days(3)).to_rfc3339())
    .execute(pool).await?;

    let audit_t2_4 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '总编室-王芳', 'reviewer', 'VIEW_TOPIC', '检查逾期题单处理进度，发现采访已逾期', '192.168.1.103', ?)"
    )
    .bind(&audit_t2_4).bind(&topic2_id).bind(&reviewer_id).bind((now - Duration::hours(8)).to_rfc3339())
    .execute(pool).await?;

    let audit_t2_5 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'VIEW_TOPIC', '责任编辑查看并准备补充稿件材料', '192.168.1.102', ?)"
    )
    .bind(&audit_t2_5).bind(&topic2_id).bind(&auditor_id).bind((now - Duration::hours(2)).to_rfc3339())
    .execute(pool).await?;

    // === topic3 审计记录：5条（智慧教育：退回补正）===
    let audit_t3_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '采编助理-张明', 'registrar', 'CREATE_TOPIC', '创建选题单「智慧教育平台推广应用报道」', '192.168.1.101', ?)"
    )
    .bind(&audit_t3_1).bind(&topic3_id).bind(&registrar_id).bind((now - Duration::days(4)).to_rfc3339())
    .execute(pool).await?;

    let audit_t3_2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'DISPATCH', '派发领取选题单进入处理', '192.168.1.102', ?)"
    )
    .bind(&audit_t3_2).bind(&topic3_id).bind(&auditor_id).bind((now - Duration::days(3)).to_rfc3339())
    .execute(pool).await?;

    let audit_t3_3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'VIEW_TOPIC', '审核时发现材料不完整，缺少具体学校名单', '192.168.1.102', ?)"
    )
    .bind(&audit_t3_3).bind(&topic3_id).bind(&auditor_id).bind((now - Duration::days(2)).to_rfc3339())
    .execute(pool).await?;

    let audit_t3_4 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'RETURN', '退回补正：缺少具体学校名单和预期采访对象', '192.168.1.102', ?)"
    )
    .bind(&audit_t3_4).bind(&topic3_id).bind(&auditor_id).bind((now - Duration::days(1)).to_rfc3339())
    .execute(pool).await?;

    let audit_t3_5 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '采编助理-张明', 'registrar', 'VIEW_TOPIC', '申报人查看退回原因，准备补正材料', '192.168.1.101', ?)"
    )
    .bind(&audit_t3_5).bind(&topic3_id).bind(&registrar_id).bind((now - Duration::hours(4)).to_rfc3339())
    .execute(pool).await?;

    // === topic4 审计记录：5条（2024经济成就：提交复核待总编室）===
    let audit_t4_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '采编助理-张明', 'registrar', 'CREATE_TOPIC', '创建年度重点选题「2024年度经济发展成就回顾」', '192.168.1.101', ?)"
    )
    .bind(&audit_t4_1).bind(&topic4_id).bind(&registrar_id).bind((now - Duration::days(10)).to_rfc3339())
    .execute(pool).await?;

    let audit_t4_2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'DISPATCH', '领取年度重点选题，加急处理', '192.168.1.102', ?)"
    )
    .bind(&audit_t4_2).bind(&topic4_id).bind(&auditor_id).bind((now - Duration::days(9)).to_rfc3339())
    .execute(pool).await?;

    let audit_t4_3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'UPLOAD_ATTACHMENT', '批量上传3类附件：选题申报、采访安排、稿件提交', '192.168.1.102', ?)"
    )
    .bind(&audit_t4_3).bind(&topic4_id).bind(&auditor_id).bind((now - Duration::days(2)).to_rfc3339())
    .execute(pool).await?;

    let audit_t4_4 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'SUBMIT_REVIEW', '稿件已完成，采访证据齐全，提请总编室复核（版本升至v2）', '192.168.1.102', ?)"
    )
    .bind(&audit_t4_4).bind(&topic4_id).bind(&auditor_id).bind((now - Duration::days(1)).to_rfc3339())
    .execute(pool).await?;

    let audit_t4_5 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '总编室-王芳', 'reviewer', 'VIEW_TOPIC', '总编室查看复核待办，该选题已进入复核队列', '192.168.1.103', ?)"
    )
    .bind(&audit_t4_5).bind(&topic4_id).bind(&reviewer_id).bind((now - Duration::minutes(45)).to_rfc3339())
    .execute(pool).await?;

    // === topic5 审计记录：5条（文化遗产：已关闭闭环）===
    let audit_t5_1 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '采编助理-张明', 'registrar', 'CREATE_TOPIC', '创建选题单「文化遗产保护与活化利用」', '192.168.1.101', ?)"
    )
    .bind(&audit_t5_1).bind(&topic5_id).bind(&registrar_id).bind((now - Duration::days(45)).to_rfc3339())
    .execute(pool).await?;

    let audit_t5_2 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'DISPATCH', '派发领取，文化组负责，注意文物采访合规', '192.168.1.102', ?)"
    )
    .bind(&audit_t5_2).bind(&topic5_id).bind(&auditor_id).bind((now - Duration::days(42)).to_rfc3339())
    .execute(pool).await?;

    let audit_t5_3 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '责任编辑-李华', 'auditor', 'UPLOAD_ATTACHMENT', '上传完整证据链：选题申报+采访安排+稿件提交', '192.168.1.102', ?)"
    )
    .bind(&audit_t5_3).bind(&topic5_id).bind(&auditor_id).bind((now - Duration::days(25)).to_rfc3339())
    .execute(pool).await?;

    let audit_t5_4 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '总编室-王芳', 'reviewer', 'SUBMIT_REVIEW', '审核责任编辑提交的复核请求，材料齐全', '192.168.1.103', ?)"
    )
    .bind(&audit_t5_4).bind(&topic5_id).bind(&reviewer_id).bind((now - Duration::days(20)).to_rfc3339())
    .execute(pool).await?;

    let audit_t5_5 = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO audit_logs (id, topic_id, user_id, user_name, user_role, action, detail, ip_address, created_at) VALUES (?, ?, ?, '总编室-王芳', 'reviewer', 'CLOSE_TOPIC', '复核通过，关闭归档（版本升至v3），已推送见报计划', '192.168.1.103', ?)"
    )
    .bind(&audit_t5_5).bind(&topic5_id).bind(&reviewer_id).bind((now - Duration::days(15)).to_rfc3339())
    .execute(pool).await?;

    Ok(())
}
