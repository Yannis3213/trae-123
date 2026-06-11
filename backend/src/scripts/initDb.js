const db = require('../db');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS side_records (
      id TEXT PRIMARY KEY,
      record_no TEXT UNIQUE NOT NULL,
      project_name TEXT NOT NULL,
      project_code TEXT,
      location TEXT,
      work_content TEXT NOT NULL,
      side_record_clue TEXT,
      weather TEXT,
      record_date TEXT NOT NULL,
      deadline TEXT,
      site_photo TEXT,
      inspection_record TEXT,
      signatures TEXT,
      attachments TEXT,
      status TEXT NOT NULL DEFAULT 'pending_review',
      version INTEGER NOT NULL DEFAULT 1,
      registrar_id TEXT NOT NULL,
      current_handler_id TEXT,
      reviewer_id TEXT,
      final_archiver_id TEXT,
      problem_notice_status TEXT,
      rectification_review_status TEXT,
      abnormal_reason TEXT,
      abnormal_type TEXT,
      warning_group TEXT DEFAULT 'normal',
      last_reminder_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (registrar_id) REFERENCES users(id),
      FOREIGN KEY (current_handler_id) REFERENCES users(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      FOREIGN KEY (final_archiver_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_side_records_status ON side_records(status);
    CREATE INDEX IF NOT EXISTS idx_side_records_clue ON side_records(side_record_clue);
    CREATE INDEX IF NOT EXISTS idx_side_records_handler ON side_records(current_handler_id);
    CREATE INDEX IF NOT EXISTS idx_side_records_deadline ON side_records(deadline);
    CREATE INDEX IF NOT EXISTS idx_side_records_warning ON side_records(warning_group);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      side_record_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      file_path TEXT,
      file_url TEXT,
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (side_record_id) REFERENCES side_records(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS process_records (
      id TEXT PRIMARY KEY,
      side_record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      operator_id TEXT NOT NULL,
      handler_id TEXT,
      evidence_submitted TEXT,
      evidence_missing TEXT,
      abnormal_reason TEXT,
      abnormal_type TEXT,
      remark TEXT,
      version INTEGER,
      status_snapshot TEXT,
      processed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (side_record_id) REFERENCES side_records(id) ON DELETE CASCADE,
      FOREIGN KEY (operator_id) REFERENCES users(id),
      FOREIGN KEY (handler_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_process_records_side ON process_records(side_record_id);

    CREATE TABLE IF NOT EXISTS audit_notes (
      id TEXT PRIMARY KEY,
      side_record_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (side_record_id) REFERENCES side_records(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS abnormal_reasons (
      id TEXT PRIMARY KEY,
      side_record_id TEXT NOT NULL,
      reason_type TEXT NOT NULL,
      reason_detail TEXT NOT NULL,
      related_field TEXT,
      reported_by TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (side_record_id) REFERENCES side_records(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_by) REFERENCES users(id),
      FOREIGN KEY (resolved_by) REFERENCES users(id)
    );
  `);

  console.log('数据库初始化完成，表结构已创建');
}

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
