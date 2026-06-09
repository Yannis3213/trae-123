const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data.db');

function initDatabase() {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE children (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      birth_date TEXT,
      parent_phone TEXT,
      allergies TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE morning_check_records (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      check_date TEXT NOT NULL,
      status TEXT NOT NULL,
      temperature REAL,
      health_status TEXT,
      abnormal_type TEXT,
      abnormal_reason TEXT,
      current_handler TEXT,
      current_handler_role TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      deadline TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (child_id) REFERENCES children(id)
    );

    CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT,
      content TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES morning_check_records(id)
    );

    CREATE TABLE processing_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      action_by TEXT NOT NULL,
      action_by_role TEXT NOT NULL,
      action_by_name TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      remark TEXT,
      correction_reason TEXT,
      reject_reason TEXT,
      evidence_summary TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES morning_check_records(id)
    );

    CREATE TABLE audit_notes (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      note TEXT NOT NULL,
      noted_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES morning_check_records(id)
    );

    CREATE INDEX idx_records_status ON morning_check_records(status);
    CREATE INDEX idx_records_handler ON morning_check_records(current_handler);
    CREATE INDEX idx_records_date ON morning_check_records(check_date);
    CREATE INDEX idx_logs_record ON processing_logs(record_id);
    CREATE INDEX idx_attachments_record ON attachments(record_id);
  `);

  const now = new Date().toISOString();
  const users = [
    {
      id: uuidv4(),
      username: 'registrar',
      password: '123456',
      name: '李登记',
      role: 'registrar',
      department: '保健室',
      created_at: now
    },
    {
      id: uuidv4(),
      username: 'supervisor',
      password: '123456',
      name: '王主管',
      role: 'supervisor',
      department: '保健室',
      created_at: now
    },
    {
      id: uuidv4(),
      username: 'principal',
      password: '123456',
      name: '张园长',
      role: 'principal',
      department: '园办',
      created_at: now
    }
  ];

  const insertUser = db.prepare(
    'INSERT INTO users (id, username, password, name, role, department, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  users.forEach(u => insertUser.run(u.id, u.username, u.password, u.name, u.role, u.department, u.created_at));

  const childrenData = [
    { id: uuidv4(), name: '小明', class_name: '小一班', birth_date: '2020-03-15', parent_phone: '13800138001', allergies: '花生过敏', created_at: now },
    { id: uuidv4(), name: '小红', class_name: '小一班', birth_date: '2020-05-20', parent_phone: '13800138002', allergies: '', created_at: now },
    { id: uuidv4(), name: '小刚', class_name: '小二班', birth_date: '2020-01-10', parent_phone: '13800138003', allergies: '牛奶过敏', created_at: now },
    { id: uuidv4(), name: '小丽', class_name: '小二班', birth_date: '2020-07-08', parent_phone: '13800138004', allergies: '', created_at: now },
    { id: uuidv4(), name: '小强', class_name: '中一班', birth_date: '2019-11-22', parent_phone: '13800138005', allergies: '海鲜过敏', created_at: now }
  ];

  const insertChild = db.prepare(
    'INSERT INTO children (id, name, class_name, birth_date, parent_phone, allergies, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  childrenData.forEach(c => insertChild.run(c.id, c.name, c.class_name, c.birth_date, c.parent_phone, c.allergies, c.created_at));

  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);
  const inThreeDays = new Date(today);
  inThreeDays.setDate(today.getDate() + 3);
  const fiveDaysAgo = new Date(today);
  fiveDaysAgo.setDate(today.getDate() - 5);

  const sampleRecords = [
    {
      id: uuidv4(),
      child_id: childrenData[0].id,
      check_date: threeDaysAgo.toISOString().split('T')[0],
      status: 'pending_review',
      temperature: 36.5,
      health_status: 'normal',
      abnormal_type: null,
      abnormal_reason: null,
      current_handler: users[1].username,
      current_handler_role: users[1].role,
      version: 1,
      deadline: today.toISOString(),
      created_at: threeDaysAgo.toISOString(),
      updated_at: twoDaysAgo.toISOString(),
      archived: 0
    },
    {
      id: uuidv4(),
      child_id: childrenData[1].id,
      check_date: twoDaysAgo.toISOString().split('T')[0],
      status: 'accepted',
      temperature: 36.8,
      health_status: 'normal',
      abnormal_type: null,
      abnormal_reason: null,
      current_handler: users[2].username,
      current_handler_role: users[2].role,
      version: 2,
      deadline: tomorrow.toISOString(),
      created_at: twoDaysAgo.toISOString(),
      updated_at: yesterday.toISOString(),
      archived: 0
    },
    {
      id: uuidv4(),
      child_id: childrenData[2].id,
      check_date: yesterday.toISOString().split('T')[0],
      status: 'pending_registrar_correction',
      temperature: 37.5,
      health_status: 'abnormal',
      abnormal_type: 'fever',
      abnormal_reason: '体温偏高，需补充医院诊断证明',
      current_handler: users[0].username,
      current_handler_role: users[0].role,
      version: 3,
      deadline: dayAfterTomorrow.toISOString(),
      created_at: yesterday.toISOString(),
      updated_at: today.toISOString(),
      archived: 0
    },
    {
      id: uuidv4(),
      child_id: childrenData[3].id,
      check_date: fiveDaysAgo.toISOString().split('T')[0],
      status: 'pending_review',
      temperature: 36.7,
      health_status: 'normal',
      abnormal_type: null,
      abnormal_reason: null,
      current_handler: users[1].username,
      current_handler_role: users[1].role,
      version: 1,
      deadline: yesterday.toISOString(),
      created_at: fiveDaysAgo.toISOString(),
      updated_at: fiveDaysAgo.toISOString(),
      archived: 0
    },
    {
      id: uuidv4(),
      child_id: childrenData[4].id,
      check_date: today.toISOString().split('T')[0],
      status: 'pending_registration',
      temperature: 36.9,
      health_status: 'abnormal',
      abnormal_type: 'cough',
      abnormal_reason: '轻微咳嗽，家长已告知',
      current_handler: users[0].username,
      current_handler_role: users[0].role,
      version: 1,
      deadline: inThreeDays.toISOString(),
      created_at: today.toISOString(),
      updated_at: today.toISOString(),
      archived: 0
    },
    {
      id: uuidv4(),
      child_id: childrenData[0].id,
      check_date: twoDaysAgo.toISOString().split('T')[0],
      status: 'verified',
      temperature: 36.6,
      health_status: 'normal',
      abnormal_type: null,
      abnormal_reason: null,
      current_handler: null,
      current_handler_role: null,
      version: 4,
      deadline: null,
      created_at: twoDaysAgo.toISOString(),
      updated_at: yesterday.toISOString(),
      archived: 1
    }
  ];

  const insertRecord = db.prepare(
    `INSERT INTO morning_check_records
      (id, child_id, check_date, status, temperature, health_status, abnormal_type, abnormal_reason, current_handler, current_handler_role, version, deadline, created_at, updated_at, archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  sampleRecords.forEach(r => insertRecord.run(
    r.id, r.child_id, r.check_date, r.status, r.temperature, r.health_status,
    r.abnormal_type, r.abnormal_reason, r.current_handler, r.current_handler_role,
    r.version, r.deadline, r.created_at, r.updated_at, r.archived
  ));

  const attachments = [
    {
      id: uuidv4(), record_id: sampleRecords[0].id, type: 'registration', name: '晨检登记表', content: '体温36.5℃，精神状态良好，无异常症状', uploaded_by: users[0].username, uploaded_at: threeDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[0].id, type: 'child_profile', name: '幼儿档案卡', content: '小明，小一班，花生过敏史', uploaded_by: users[0].username, uploaded_at: threeDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[1].id, type: 'registration', name: '晨检登记表', content: '体温36.8℃，正常', uploaded_by: users[0].username, uploaded_at: twoDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[1].id, type: 'child_profile', name: '幼儿档案卡', content: '小红，小一班，无过敏史', uploaded_by: users[0].username, uploaded_at: twoDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[1].id, type: 'registration', name: '晨检登记表', content: '体温37.5℃，额头发热', uploaded_by: users[0].username, uploaded_at: yesterday.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[2].id, type: 'child_profile', name: '幼儿档案卡', content: '小刚，小二班，牛奶过敏史', uploaded_by: users[0].username, uploaded_at: yesterday.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[3].id, type: 'registration', name: '晨检登记表', content: '体温36.7℃，正常', uploaded_by: users[0].username, uploaded_at: fiveDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[4].id, type: 'child_profile', name: '幼儿档案卡', content: '小丽，小二班，无过敏史', uploaded_by: users[0].username, uploaded_at: fiveDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[4].id, type: 'registration', name: '晨检登记表', content: '体温36.9℃，轻微咳嗽', uploaded_by: users[0].username, uploaded_at: today.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[4].id, type: 'abnormal_notice', name: '异常情况通知书', content: '轻微咳嗽，建议家长观察', uploaded_by: users[0].username, uploaded_at: today.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[4].id, type: 'child_profile', name: '幼儿档案卡', content: '小强，中一班，海鲜过敏史', uploaded_by: users[0].username, uploaded_at: today.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[5].id, type: 'registration', name: '晨检登记表', content: '体温36.6℃，正常', uploaded_by: users[0].username, uploaded_at: twoDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[5].id, type: 'child_profile', name: '幼儿档案卡', content: '小明，小一班，花生过敏史', uploaded_by: users[0].username, uploaded_at: twoDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[5].id, type: 'registration', name: '晨检登记表', content: '体温36.6℃，正常', uploaded_by: users[0].username, uploaded_at: twoDaysAgo.toISOString()
    }
  ];

  const insertAttachment = db.prepare(
    'INSERT INTO attachments (id, record_id, type, name, content, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  attachments.forEach(a => insertAttachment.run(a.id, a.record_id, a.type, a.name, a.content, a.uploaded_by, a.uploaded_at));

  const logs = [
    {
      id: uuidv4(), record_id: sampleRecords[0].id, action: 'submit',
      action_by: users[0].username, action_by_role: users[0].role, action_by_name: users[0].name,
      previous_status: null, new_status: 'pending_review', remark: '提交晨检记录',
      correction_reason: null, reject_reason: null,
      evidence_summary: '已上传晨检登记表、幼儿档案卡',
      created_at: threeDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[1].id, action: 'submit',
      action_by: users[0].username, action_by_role: users[0].role, action_by_name: users[0].name,
      previous_status: null, new_status: 'pending_review', remark: '提交晨检记录',
      correction_reason: null, reject_reason: null,
      evidence_summary: '已上传晨检登记表、幼儿档案卡',
      created_at: twoDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[1].id, action: 'accept',
      action_by: users[1].username, action_by_role: users[1].role, action_by_name: users[1].name,
      previous_status: 'pending_review', new_status: 'accepted', remark: '审核通过',
      correction_reason: null, reject_reason: null,
      evidence_summary: '材料齐全，审核通过',
      created_at: yesterday.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[2].id, action: 'submit',
      action_by: users[0].username, action_by_role: users[0].role, action_by_name: users[0].name,
      previous_status: null, new_status: 'pending_review', remark: '提交晨检记录',
      correction_reason: null, reject_reason: null,
      evidence_summary: '已上传晨检登记表、幼儿档案卡',
      created_at: yesterday.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[2].id, action: 'reject',
      action_by: users[1].username, action_by_role: users[1].role, action_by_name: users[1].name,
      previous_status: 'pending_review', new_status: 'pending_registrar_correction', remark: '退回补正',
      correction_reason: null, reject_reason: '体温异常需补充医院诊断证明',
      evidence_summary: '缺少诊断证明缺失',
      created_at: today.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[3].id, action: 'submit',
      action_by: users[0].username, action_by_role: users[0].role, action_by_name: users[0].name,
      previous_status: null, new_status: 'pending_review', remark: '提交晨检记录',
      correction_reason: null, reject_reason: null,
      evidence_summary: '已上传晨检登记表、幼儿档案卡',
      created_at: fiveDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[4].id, action: 'submit',
      action_by: users[0].username, action_by_role: users[0].role, action_by_name: users[0].name,
      previous_status: null, new_status: 'pending_registration', remark: '发起晨检记录（异常）',
      correction_reason: null, reject_reason: null,
      evidence_summary: '已上传晨检登记表、幼儿档案卡、异常通知书',
      created_at: today.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[5].id, action: 'submit',
      action_by: users[0].username, action_by_role: users[0].role, action_by_name: users[0].name,
      previous_status: null, new_status: 'pending_review', remark: '提交晨检记录',
      correction_reason: null, reject_reason: null,
      evidence_summary: '已上传晨检登记表、幼儿档案卡',
      created_at: twoDaysAgo.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[5].id, action: 'accept',
      action_by: users[1].username, action_by_role: users[1].role, action_by_name: users[1].name,
      previous_status: 'pending_review', new_status: 'accepted', remark: '审核通过',
      correction_reason: null, reject_reason: null,
      evidence_summary: '材料齐全',
      created_at: yesterday.toISOString()
    },
    {
      id: uuidv4(), record_id: sampleRecords[5].id, action: 'verify',
      action_by: users[2].username, action_by_role: users[2].role, action_by_name: users[2].name,
      previous_status: 'accepted', new_status: 'verified', remark: '复核通过，归档',
      correction_reason: null, reject_reason: null,
      evidence_summary: '复核通过，已归档',
      created_at: yesterday.toISOString()
    }
  ];

  const insertLog = db.prepare(
    `INSERT INTO processing_logs
      (id, record_id, action, action_by, action_by_role, action_by_name, previous_status, new_status, remark, correction_reason, reject_reason, evidence_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  logs.forEach(l => insertLog.run(
    l.id, l.record_id, l.action, l.action_by, l.action_by_role, l.action_by_name,
    l.previous_status, l.new_status, l.remark, l.correction_reason, l.reject_reason, l.evidence_summary, l.created_at
  ));

  const auditNotes = [
    {
      id: uuidv4(), record_id: sampleRecords[2].id, note: '体温异常记录，需要重点关注', noted_by: users[1].name, created_at: today.toISOString()
    }
  ];

  const insertAudit = db.prepare(
    'INSERT INTO audit_notes (id, record_id, note, noted_by, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  auditNotes.forEach(a => insertAudit.run(a.id, a.record_id, a.note, a.noted_by, a.created_at));

  db.close();
  console.log('数据库初始化完成！');
  console.log('演示账号:');
  console.log('  晨检登记员: registrar / 123456');
  console.log('  晨检审核主管: supervisor / 123456');
  console.log('  幼儿园复核负责人: principal / 123456');
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase, DB_PATH };
